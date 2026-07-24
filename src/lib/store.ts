import "server-only";
import { cache } from "react";
import { mutateDb, readDb } from "./db";
import type { DB, Staff, Task } from "./types";
import { toSafeStaff, type SafeStaff } from "./types";
import { currentPeriodKey, currentPeriodEnd, klToday, daysBetween } from "./tasks";

// Apply routine rollover + overdue carry-forward to an in-memory db.
// Returns true if anything changed.
function applyRollover(db: DB): boolean {
  const now = new Date();
  const today = klToday(now);
  let changed = false;
  for (const t of db.tasks) {
    if (t.recurrence === "once") {
      // Carry forward an overdue one-time task: roll its deadline to today
      // and track how many days late it is (from the ORIGINAL deadline).
      if (t.status !== "done" && t.due_date && t.due_date < today) {
        if (!t.original_due) t.original_due = t.due_date;
        t.carried_days = daysBetween(t.original_due, today);
        t.due_date = today;
        t.updated_at = now.toISOString();
        changed = true;
      }
      continue;
    }
    const key = currentPeriodKey(t.recurrence, now);
    if (t.period_key === key) continue;
    if (t.period_key !== null && t.status !== "done") {
      t.missed_count = (t.missed_count || 0) + 1;
    }
    t.status = "todo";
    t.progress = 0;
    t.completed_at = null;
    t.period_key = key;
    t.due_date = currentPeriodEnd(t.recurrence, now);
    t.updated_at = now.toISOString();
    changed = true;
  }
  return changed;
}

// Roll routine tasks into the current period — only writes when something changed.
export async function rolloverRoutines(): Promise<void> {
  const db = await readDb();
  if (!applyRollover(db)) return; // nothing to do → no write
  await mutateDb((fresh) => {
    applyRollover(fresh);
  });
}

export interface LoadedData {
  staff: SafeStaff[];
  tasks: Task[];
}

// Load everything, rolling routines to the current period first.
// Wrapped in React cache(): the (app) layout AND the page both call this,
// but it only hits Supabase ONCE per request (and writes only on a real rollover).
export const loadData = cache(async (): Promise<LoadedData> => {
  const db = await readDb();
  if (applyRollover(db)) {
    await mutateDb((fresh) => {
      applyRollover(fresh);
    });
  }
  return { staff: db.staff.map(toSafeStaff), tasks: db.tasks };
});

export function staffMap(staff: SafeStaff[]): Map<string, SafeStaff> {
  return new Map(staff.map((s) => [s.id, s]));
}

export function nameOf(staff: SafeStaff[], id: string | null): string {
  if (!id) return "Unassigned";
  return staff.find((s) => s.id === id)?.name ?? "Unknown";
}

// ---- Team / hierarchy scoping ----

// A Leader manages a team (staff whose leader_id points to them).
export function isLeader(user: { role?: string; is_admin: boolean }): boolean {
  return !user.is_admin && user.role === "Leader";
}

// IDs of a leader's team members + the leader themselves.
export function teamMemberIds(staff: SafeStaff[], leaderId: string): Set<string> {
  const ids = new Set(staff.filter((s) => s.leader_id === leaderId).map((s) => s.id));
  ids.add(leaderId);
  return ids;
}

// Tasks a user is allowed to see/monitor:
//  admin → all · leader → their team · staff → only their own.
export function scopeTasks(
  tasks: Task[],
  staff: SafeStaff[],
  user: { id: string; role?: string; is_admin: boolean }
): Task[] {
  if (user.is_admin) return tasks;
  if (isLeader(user)) {
    const ids = teamMemberIds(staff, user.id);
    return tasks.filter((t) => t.assignee_id && ids.has(t.assignee_id));
  }
  return tasks.filter((t) => t.assignee_id === user.id);
}

// Staff a user can assign tasks to:
//  admin → everyone · leader → their team · staff → just themselves.
export function assignableStaff(
  staff: SafeStaff[],
  user: { id: string; role?: string; is_admin: boolean }
): SafeStaff[] {
  const active = staff.filter((s) => s.active);
  if (user.is_admin) return active;
  if (isLeader(user)) {
    const ids = teamMemberIds(staff, user.id);
    return active.filter((s) => ids.has(s.id));
  }
  return active.filter((s) => s.id === user.id);
}
