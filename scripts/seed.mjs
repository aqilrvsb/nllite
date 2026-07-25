// One-off seeder: writes the initial { staff, tasks } blob into Supabase app_state.
// Mirrors src/lib/db.ts seed(). Run: node scripts/seed.mjs
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import fs from "fs";

// load .env.local
for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m) process.env[m[1]] = m[2];
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const ROLE_COLORS = {
  "CEO / Boss": "#8b5cf6", Leader: "#2563eb", "Human Resources": "#ec4899",
  "IT Department": "#0ea5e9", Admin: "#f97316", "Marketer (PIC)": "#22c55e",
  "Team Sale": "#eab308", "Content Creator": "#14b8a6", Editor: "#a855f7", "Live Host": "#ef4444",
};
const iso = (d) => d.toISOString();
const dateOnly = (d) => d.toISOString().slice(0, 10);
const addDays = (b, n) => { const d = new Date(b); d.setDate(d.getDate() + n); return d; };

const now = new Date();
const pw = await bcrypt.hash("password123", 10);
const bossPw = await bcrypt.hash("admin123", 10);
const mk = (name, role, hash, is_admin) => ({
  id: crypto.randomUUID(), staff_id: "", name, password_hash: hash, role,
  is_admin, leader_id: null, avatar_color: ROLE_COLORS[role], active: true, created_at: iso(now),
});
const boss = mk("Naim (Boss)", "CEO / Boss", bossPw, true);
const leader = mk("Aiman", "Leader", pw, false);
const hr = mk("Siti", "Human Resources", pw, false);
const it = mk("Firdaus", "IT Department", pw, false);
const admin = mk("Nadia", "Admin", pw, false);
const marketer = mk("Zul (PIC)", "Marketer (PIC)", pw, false);
const sale = mk("Farah", "Team Sale", pw, false);
const creator = mk("Iman", "Content Creator", pw, false);
const editor = mk("Haziq", "Editor", pw, false);
const host = mk("Aisyah", "Live Host", pw, false);
const staff = [boss, leader, hr, it, admin, marketer, sale, creator, editor, host];
staff.forEach((s, i) => (s.staff_id = `NL-${String(i + 1).padStart(3, "0")}`));
boss.staff_id = "HQNL";
for (const s of [marketer, sale, creator, editor, host]) s.leader_id = leader.id;
// Every staff's password == their Staff ID
for (const s of staff) s.password_hash = await bcrypt.hash(s.staff_id, 10);

const mkTask = (t) => ({
  id: crypto.randomUUID(), title: t.title, description: t.description ?? "", type: t.type ?? "internal",
  assignee_id: t.assignee_id ?? null, jv_ids: [], created_by: boss.id, priority: t.priority ?? "medium",
  status: t.status ?? "todo", progress: t.progress ?? 0, due_date: t.due_date ?? null,
  original_due: t.due_date ?? null, carried_days: 0,
  recurrence: t.recurrence ?? "once", session: t.session ?? null, period_key: t.period_key ?? null,
  missed_count: 0, completed_at: t.completed_at ?? null, comments: [],
  activity: [{ id: crypto.randomUUID(), staff_id: boss.id, action: "created this task", created_at: iso(now) }],
  attachments: [], created_at: iso(now), updated_at: iso(now),
});
const tasks = [
  mkTask({ title: "Post 3 TikTok live-host clips", description: "Daily content routine — upload to NL Legacy TikTok before 5pm.", assignee_id: host.id, priority: "high", recurrence: "daily", session: "pagi", due_date: dateOnly(now) }),
  mkTask({ title: "Reply all customer DMs & WhatsApp", description: "Clear the inbox every day. Target: 0 unread by 6pm.", type: "external", assignee_id: sale.id, priority: "high", recurrence: "daily", session: "petang", progress: 40, status: "in_progress", due_date: dateOnly(now) }),
  mkTask({ title: "Weekly ads performance report", description: "Compile Meta Ads spend, ROAS and leads for the leader review.", assignee_id: marketer.id, recurrence: "weekly", due_date: dateOnly(addDays(now, 3)) }),
  mkTask({ title: "Edit 5 product videos for launch", description: "External vendor deliverable. Deadline is firm.", type: "external", assignee_id: editor.id, priority: "high", progress: 20, status: "in_progress", due_date: dateOnly(addDays(now, -1)) }),
  mkTask({ title: "Monthly staff payroll & claims", description: "Process salary, commissions and claims for all staff.", assignee_id: hr.id, priority: "high", recurrence: "monthly", due_date: dateOnly(addDays(now, 6)) }),
  mkTask({ title: "Design 10 poster templates (Raya campaign)", description: "Content creator deliverable for the seasonal campaign.", assignee_id: creator.id, progress: 60, status: "in_progress", due_date: dateOnly(addDays(now, 4)) }),
  mkTask({ title: "Fix login bug on order website", description: "IT — customers cannot checkout on mobile. Urgent.", assignee_id: it.id, priority: "high", due_date: dateOnly(addDays(now, 1)) }),
  mkTask({ title: "Onboard 2 new sales staff", description: "HR — prepare contracts, accounts and training schedule.", assignee_id: hr.id, status: "done", progress: 100, completed_at: iso(addDays(now, -2)), due_date: dateOnly(addDays(now, -1)) }),
  mkTask({ title: "Close 5 external distributor deals", description: "Team Sale — follow up leads and close distributor agreements.", type: "external", assignee_id: sale.id, priority: "high", recurrence: "weekly", progress: 50, status: "in_progress", due_date: dateOnly(addDays(now, 2)) }),
  mkTask({ title: "Backup database & rotate keys", description: "IT security routine — end of month.", assignee_id: it.id, recurrence: "monthly", due_date: dateOnly(addDays(now, 10)) }),
];

const { error } = await supabase.from("app_state").upsert({ key: "db", value: { staff, tasks }, updated_at: iso(now) });
if (error) { console.error("SEED FAILED:", error.message); process.exit(1); }
console.log(`Seeded: ${staff.length} staff, ${tasks.length} tasks -> Supabase app_state.`);
