// ============================================================
//  Task period / routine / overdue logic (pure, client-safe)
//  Timezone: Asia/Kuala_Lumpur (UTC+8)
// ============================================================
import type { Recurrence, Task } from "./types";

const TZ = "Asia/Kuala_Lumpur";

// Return a Date whose UTC fields equal the wall-clock time in KL.
function klNow(now: Date = new Date()): Date {
  const s = now.toLocaleString("en-US", { timeZone: TZ });
  return new Date(s);
}

export function klToday(now: Date = new Date()): string {
  const d = klNow(now);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// ISO week number for a KL date
function isoWeek(d: Date): { year: number; week: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: date.getUTCFullYear(), week };
}

// The token that identifies the current period for a routine task.
export function currentPeriodKey(recurrence: Recurrence, now: Date = new Date()): string {
  const d = klNow(now);
  switch (recurrence) {
    case "daily":
      return klToday(now);
    case "weekly": {
      const { year, week } = isoWeek(d);
      return `${year}-W${pad(week)}`;
    }
    case "monthly":
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    default:
      return "once";
  }
}

// The deadline (YYYY-MM-DD) for the current period of a routine task.
export function currentPeriodEnd(recurrence: Recurrence, now: Date = new Date()): string {
  const d = klNow(now);
  switch (recurrence) {
    case "daily":
      return klToday(now);
    case "weekly": {
      // end of ISO week = Sunday
      const dayNum = d.getDay() || 7; // Mon=1..Sun=7
      const end = new Date(d);
      end.setDate(d.getDate() + (7 - dayNum));
      return `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
    }
    case "monthly": {
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
    }
    default:
      return klToday(now);
  }
}

// First day of the current month (Malaysia time), YYYY-MM-DD
export function currentMonthStart(now: Date = new Date()): string {
  const d = klNow(now);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
}

// Last day of the current month (Malaysia time), YYYY-MM-DD
export function currentMonthEnd(now: Date = new Date()): string {
  const d = klNow(now);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
}

// Whole days between two YYYY-MM-DD dates (never negative).
export function daysBetween(fromYMD: string, toYMD: string): number {
  const a = new Date(fromYMD + "T00:00:00Z").getTime();
  const b = new Date(toYMD + "T00:00:00Z").getTime();
  return Math.max(0, Math.round((b - a) / 86400000));
}

// A one-time task that has been carried forward past its original deadline.
export function carriedDays(task: Task): number {
  return task.status === "done" ? 0 : task.carried_days || 0;
}

export function isOverdue(task: Task, now: Date = new Date()): boolean {
  if (task.status === "done") return false;
  if ((task.carried_days || 0) > 0) return true; // carried-forward = still overdue
  if (!task.due_date) return false;
  return task.due_date < klToday(now);
}

export function isDueToday(task: Task, now: Date = new Date()): boolean {
  if (task.status === "done") return false;
  if ((task.carried_days || 0) > 0) return false; // carried-forward counts as overdue, not "due today"
  return task.due_date === klToday(now);
}

export function daysUntilDue(task: Task, now: Date = new Date()): number | null {
  if (!task.due_date) return null;
  const today = new Date(klToday(now) + "T00:00:00Z").getTime();
  const due = new Date(task.due_date + "T00:00:00Z").getTime();
  return Math.round((due - today) / 86400000);
}

export function dueLabel(task: Task, now: Date = new Date()): string {
  if (!task.due_date) return "No deadline";
  const diff = daysUntilDue(task, now);
  if (diff === null) return "No deadline";
  if (task.status === "done") return "Completed";
  if ((task.carried_days || 0) > 0) return `Late ${task.carried_days}d ⏩`;
  if (diff < 0) return `Overdue by ${Math.abs(diff)}d`;
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  return `Due in ${diff}d`;
}

export function progressOf(task: Task): number {
  if (task.status === "done") return 100;
  return Math.max(0, Math.min(100, task.progress || 0));
}
