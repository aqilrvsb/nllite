import "server-only";
import bcrypt from "bcryptjs";
import { supabase } from "./supabase";
import type { DB, Staff, Task } from "./types";
import { ADMIN_ROLES, ROLE_COLORS, type Role } from "./types";

// ------------------------------------------------------------
//  Supabase-backed store. The whole { staff, tasks } object is
//  kept as a single JSONB blob in the `app_state` table
//  (key = 'db'). Serverless-safe (no local filesystem writes).
// ------------------------------------------------------------

const STATE_KEY = "db";
let writeChain: Promise<void> = Promise.resolve();

function iso(d: Date): string {
  return d.toISOString();
}
function dateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function makeStaff(
  name: string,
  role: Role,
  passwordHash: string,
  isAdmin?: boolean
): Staff {
  return {
    id: crypto.randomUUID(),
    staff_id: "", // assigned sequentially after the list is built
    name,
    password_hash: passwordHash,
    role,
    is_admin: isAdmin ?? ADMIN_ROLES.includes(role),
    leader_id: null,
    avatar_color: ROLE_COLORS[role],
    active: true,
    created_at: iso(new Date()),
  };
}

// Next Staff ID in NL-00X format based on the current highest.
export function nextStaffId(db: DB): string {
  let max = 0;
  for (const s of db.staff) {
    const m = /^NL-(\d+)$/.exec(s.staff_id || "");
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `NL-${String(max + 1).padStart(3, "0")}`;
}

async function seed(): Promise<DB> {
  const now = new Date();
  const pw = await bcrypt.hash("password123", 10);
  const bossPw = await bcrypt.hash("admin123", 10);

  const boss = makeStaff("Naim (Boss)", "CEO / Boss", bossPw, true);
  // Leader / HR / Admin start as regular staff — boss grants admin later.
  const leader = makeStaff("Aiman", "Leader", pw, false);
  const hr = makeStaff("Siti", "Human Resources", pw, false);
  const it = makeStaff("Firdaus", "IT Department", pw);
  const admin = makeStaff("Nadia", "Admin", pw, false);
  const marketer = makeStaff("Zul (PIC)", "Marketer (PIC)", pw);
  const sale = makeStaff("Farah", "Team Sale", pw);
  const creator = makeStaff("Iman", "Content Creator", pw);
  const editor = makeStaff("Haziq", "Editor", pw);
  const host = makeStaff("Aisyah", "Live Host", pw);

  const staff: Staff[] = [boss, leader, hr, it, admin, marketer, sale, creator, editor, host];
  staff.forEach((s, i) => (s.staff_id = `NL-${String(i + 1).padStart(3, "0")}`));
  // Demo team: these staff report to Aiman (Leader)
  for (const s of [marketer, sale, creator, editor, host]) s.leader_id = leader.id;

  const mkTask = (t: Partial<Task> & { title: string }): Task => ({
    id: crypto.randomUUID(),
    title: t.title,
    description: t.description ?? "",
    type: t.type ?? "internal",
    assignee_id: t.assignee_id ?? null,
    created_by: boss.id,
    priority: t.priority ?? "medium",
    status: t.status ?? "todo",
    progress: t.progress ?? 0,
    due_date: t.due_date ?? null,
    recurrence: t.recurrence ?? "once",
    session: t.session ?? null,
    period_key: t.period_key ?? null,
    missed_count: t.missed_count ?? 0,
    completed_at: t.completed_at ?? null,
    comments: t.comments ?? [],
    activity: t.activity ?? [
      { id: crypto.randomUUID(), staff_id: boss.id, action: "created this task", created_at: iso(now) },
    ],
    attachments: t.attachments ?? [],
    created_at: iso(now),
    updated_at: iso(now),
  });

  const tasks: Task[] = [
    mkTask({
      title: "Post 3 TikTok live-host clips",
      description: "Daily content routine — upload to NL Legacy TikTok before 5pm.",
      type: "internal",
      assignee_id: host.id,
      priority: "high",
      recurrence: "daily",
      session: "pagi",
      due_date: dateOnly(now),
    }),
    mkTask({
      title: "Reply all customer DMs & WhatsApp",
      description: "Clear the inbox every day. Target: 0 unread by 6pm.",
      type: "external",
      assignee_id: sale.id,
      priority: "high",
      recurrence: "daily",
      session: "petang",
      progress: 40,
      status: "in_progress",
      due_date: dateOnly(now),
    }),
    mkTask({
      title: "Weekly ads performance report",
      description: "Compile Meta Ads spend, ROAS and leads for the leader review.",
      type: "internal",
      assignee_id: marketer.id,
      priority: "medium",
      recurrence: "weekly",
      due_date: dateOnly(addDays(now, 3)),
    }),
    mkTask({
      title: "Edit 5 product videos for launch",
      description: "External vendor deliverable. Deadline is firm.",
      type: "external",
      assignee_id: editor.id,
      priority: "high",
      recurrence: "once",
      progress: 20,
      status: "in_progress",
      due_date: dateOnly(addDays(now, -1)), // overdue sample
    }),
    mkTask({
      title: "Monthly staff payroll & claims",
      description: "Process salary, commissions and claims for all staff.",
      type: "internal",
      assignee_id: hr.id,
      priority: "high",
      recurrence: "monthly",
      due_date: dateOnly(addDays(now, 6)),
    }),
    mkTask({
      title: "Design 10 poster templates (Raya campaign)",
      description: "Content creator deliverable for the seasonal campaign.",
      type: "internal",
      assignee_id: creator.id,
      priority: "medium",
      recurrence: "once",
      progress: 60,
      status: "in_progress",
      due_date: dateOnly(addDays(now, 4)),
    }),
    mkTask({
      title: "Fix login bug on order website",
      description: "IT — customers cannot checkout on mobile. Urgent.",
      type: "internal",
      assignee_id: it.id,
      priority: "high",
      recurrence: "once",
      due_date: dateOnly(addDays(now, 1)),
    }),
    mkTask({
      title: "Onboard 2 new sales staff",
      description: "HR — prepare contracts, accounts and training schedule.",
      type: "internal",
      assignee_id: hr.id,
      priority: "medium",
      recurrence: "once",
      status: "done",
      progress: 100,
      completed_at: iso(addDays(now, -2)),
      due_date: dateOnly(addDays(now, -1)),
    }),
    mkTask({
      title: "Close 5 external distributor deals",
      description: "Team Sale — follow up leads and close distributor agreements.",
      type: "external",
      assignee_id: sale.id,
      priority: "high",
      recurrence: "weekly",
      progress: 50,
      status: "in_progress",
      due_date: dateOnly(addDays(now, 2)),
    }),
    mkTask({
      title: "Backup database & rotate keys",
      description: "IT security routine — end of month.",
      type: "internal",
      assignee_id: it.id,
      priority: "medium",
      recurrence: "monthly",
      due_date: dateOnly(addDays(now, 10)),
    }),
  ];

  return { staff, tasks };
}

function normalize(db: DB): DB {
  if (!db.staff) db.staff = [];
  if (!db.tasks) db.tasks = [];
  for (const s of db.staff) {
    if (s.leader_id === undefined) s.leader_id = null;
  }
  for (const t of db.tasks) {
    if (!Array.isArray(t.comments)) t.comments = [];
    if (!Array.isArray(t.activity)) t.activity = [];
    if (!Array.isArray(t.attachments)) t.attachments = [];
    if (t.session === undefined) t.session = null;
  }
  return db;
}

async function loadRow(): Promise<DB | null> {
  const { data, error } = await supabase()
    .from("app_state")
    .select("value")
    .eq("key", STATE_KEY)
    .maybeSingle();
  if (error) throw new Error(`Supabase read failed: ${error.message}`);
  return data ? (data.value as DB) : null;
}

async function saveRow(db: DB): Promise<void> {
  const { error } = await supabase()
    .from("app_state")
    .upsert({ key: STATE_KEY, value: db, updated_at: new Date().toISOString() });
  if (error) throw new Error(`Supabase write failed: ${error.message}`);
}

async function ensureDb(): Promise<DB> {
  const existing = await loadRow();
  if (existing) return normalize(existing);
  const initial = await seed();
  await saveRow(initial);
  return initial;
}

export async function readDb(): Promise<DB> {
  const existing = await loadRow();
  return existing ? normalize(existing) : ensureDb();
}

// Serialised read-modify-write (per server instance) so concurrent
// actions within the same instance don't clobber each other.
export async function mutateDb<T>(fn: (db: DB) => T | Promise<T>): Promise<T> {
  const run = writeChain.then(async () => {
    const db = await readDb();
    const result = await fn(db);
    await saveRow(db);
    return result;
  });
  writeChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export function newId(): string {
  return crypto.randomUUID();
}
