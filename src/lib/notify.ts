import "server-only";

import type { DB, Staff, Task, Session } from "./types";
import { isTeamLead, SESSION_LABEL } from "./types";

// A "Ready" send is scoped to either all To Do items or one session of the day.
export type ReadyScope = "all" | Session;
import { isOverdue, klToday } from "./tasks";
import { sendWhatsApp, sendWhatsAppMany, type SendResult } from "./whatsapp";

// ---- Per-staff task counts (assigned tasks only) ----

interface Counts {
  todo: number; // To Do List + Priority (not started)
  inProgress: number;
  onHold: number;
  done: number;
  overdue: number;
  open: number; // everything not done
}

function countFor(tasks: Task[], staffId: string): Counts {
  const mine = tasks.filter((t) => t.assignee_id === staffId);
  const c: Counts = { todo: 0, inProgress: 0, onHold: 0, done: 0, overdue: 0, open: 0 };
  for (const t of mine) {
    if (t.status === "done") { c.done++; continue; }
    c.open++;
    if (isOverdue(t)) c.overdue++;
    if (t.status === "in_progress") c.inProgress++;
    else if (t.status === "on_hold") c.onHold++;
    else c.todo++; // todo / priority
  }
  return c;
}

// A task's still-open To Do / Priority tasks for today.
function todoTasks(tasks: Task[], staffId: string, limit = 12): Task[] {
  return tasks
    .filter(
      (t) =>
        t.assignee_id === staffId &&
        t.status !== "done" &&
        (t.status === "todo" || t.status === "priority")
    )
    .slice(0, limit);
}

// One WhatsApp bullet: the title, plus the description underneath when set.
function bullet(t: Task): string {
  const desc = (t.description || "").trim().replace(/\s+/g, " ");
  if (!desc) return `• ${t.title}`;
  const short = desc.length > 200 ? desc.slice(0, 200) + "…" : desc;
  return `• *${t.title}*\n   ${short}`;
}

// ---- Message builders (Bahasa Malaysia) ----

function line(c: Counts): string {
  return `${c.todo} to do · ${c.inProgress} in progress · ${c.onHold} on hold · ${c.open} left${c.overdue ? ` · ⚠ ${c.overdue} overdue` : ""}`;
}

export function personalMessage(staff: Staff, tasks: Task[]): string {
  const c = countFor(tasks, staff.id);
  const items = todoTasks(tasks, staff.id);
  const name = staff.name.split(" ")[0];
  const list = items.length
    ? "\n" + items.map(bullet).join("\n")
    : "\n(Tiada tugasan tertunggak — bagus! 🎉)";
  return (
    `🔔 *Peringatan To Do List* — ${klToday()}\n` +
    `Assalamualaikum ${name}, ringkasan tugasan anda:\n` +
    `${line(c)}\n` +
    `\n📋 To Do:${list}\n` +
    `\n_NLLITE • NL Legacy_`
  );
}

export function leaderMessage(leader: Staff, team: Staff[], tasks: Task[]): string {
  const members = team.filter((s) => s.active);
  const rows = members
    .map((m) => `• *${m.name}* — ${line(countFor(tasks, m.id))}`)
    .join("\n");
  // team totals
  const tot = members.reduce(
    (a, m) => {
      const c = countFor(tasks, m.id);
      a.todo += c.todo; a.inProgress += c.inProgress; a.onHold += c.onHold; a.open += c.open; a.overdue += c.overdue; a.done += c.done;
      return a;
    },
    { todo: 0, inProgress: 0, onHold: 0, done: 0, overdue: 0, open: 0 } as Counts
  );
  return (
    `👔 *Ringkasan Team* — ${klToday()}\n` +
    `Hi ${leader.name.split(" ")[0]}, status ${members.length} ahli team anda:\n\n` +
    `${rows || "(Tiada ahli team)"}\n\n` +
    `*JUMLAH TEAM:* ${line(tot)}\n` +
    `\n_NLLITE • NL Legacy_`
  );
}

export function bossMessage(staff: Staff[], tasks: Task[]): string {
  const active = staff.filter((s) => s.active);
  const leaders = active.filter((s) => isTeamLead(s));
  const blocks: string[] = [];

  for (const leader of leaders) {
    const team = active.filter((s) => s.leader_id === leader.id);
    const tot = [leader, ...team].reduce(
      (a, m) => {
        const c = countFor(tasks, m.id);
        a.todo += c.todo; a.inProgress += c.inProgress; a.onHold += c.onHold; a.open += c.open; a.overdue += c.overdue; a.done += c.done;
        return a;
      },
      { todo: 0, inProgress: 0, onHold: 0, done: 0, overdue: 0, open: 0 } as Counts
    );
    blocks.push(`🔹 *${leader.name}* (${team.length} ahli)\n   ${line(tot)}`);
  }

  // Company-wide totals across every active staff
  const grand = active.reduce(
    (a, m) => {
      const c = countFor(tasks, m.id);
      a.todo += c.todo; a.inProgress += c.inProgress; a.onHold += c.onHold; a.open += c.open; a.overdue += c.overdue; a.done += c.done;
      return a;
    },
    { todo: 0, inProgress: 0, onHold: 0, done: 0, overdue: 0, open: 0 } as Counts
  );

  return (
    `🏢 *Ringkasan BOS* — ${klToday()}\n\n` +
    `${blocks.join("\n\n") || "(Tiada team lead)"}\n\n` +
    `━━━━━━━━━━━━━\n` +
    `*SELURUH SYARIKAT:* ${line(grand)}\n` +
    `(${active.length} staff aktif)\n` +
    `\n_NLLITE • NL Legacy_`
  );
}

// ---- Recipients ----

function admins(staff: Staff[]): Staff[] {
  return staff.filter((s) => s.active && s.is_admin && s.whatsapp);
}

// ---- Runners ----

// The full daily push: reminder to each staff, team summary to each leader,
// company summary to the boss(es). Returns how many messages of each kind went out.
export async function runDailyNotifications(db: DB): Promise<{ personal: number; leaders: number; boss: number }> {
  const active = db.staff.filter((s) => s.active);

  // 1) personal reminder to every staff who has a number
  const personalTargets = active
    .filter((s) => s.whatsapp)
    .map((s) => ({ number: s.whatsapp, message: personalMessage(s, db.tasks) }));

  // 2) team summary to every leader with a number
  const leaderTargets = active
    .filter((s) => isTeamLead(s) && s.whatsapp)
    .map((leader) => ({
      number: leader.whatsapp,
      message: leaderMessage(leader, active.filter((m) => m.leader_id === leader.id), db.tasks),
    }));

  // 3) company summary to the boss(es)
  const bossTargets = admins(db.staff).map((b) => ({
    number: b.whatsapp,
    message: bossMessage(db.staff, db.tasks),
  }));

  const [p, l, b] = await Promise.all([
    sendWhatsAppMany(personalTargets),
    sendWhatsAppMany(leaderTargets),
    sendWhatsAppMany(bossTargets),
  ]);
  const ok = (r: SendResult[]) => r.filter((x) => x.ok).length;
  return { personal: ok(p), leaders: ok(l), boss: ok(b) };
}

// The staff's still-open To Do / Priority tasks, optionally narrowed to one session.
function readyPool(tasks: Task[], staffId: string, scope: ReadyScope): Task[] {
  return tasks.filter(
    (t) =>
      t.assignee_id === staffId &&
      t.status !== "done" &&
      (t.status === "todo" || t.status === "priority") &&
      (scope === "all" || t.session === scope)
  );
}

// A staff clicked "Ready": send their To Do summary (all, or one session)
// to THEMSELVES + their leader + the boss(es).
export async function sendReadyNotice(
  db: DB,
  userId: string,
  scope: ReadyScope = "all"
): Promise<{ sent: number; skipped: string[]; count: number }> {
  const me = db.staff.find((s) => s.id === userId);
  if (!me) return { sent: 0, skipped: ["staff not found"], count: 0 };

  const pool = readyPool(db.tasks, me.id, scope);
  const items = pool.slice(0, 25);
  const scopeLabel = scope === "all" ? "Semua To Do" : SESSION_LABEL[scope];
  const list = items.length ? "\n" + items.map(bullet).join("\n") : "\n(kosong)";
  const body = `📋 ${pool.length} tugasan To Do:${list}\n\n_NLLITE • NL Legacy_`;
  // staff gets a first-person confirmation; leader/boss get a third-person notice
  const selfMsg = `✅ Anda sudah READY — *${scopeLabel}* — ${klToday()}\n${body}`;
  const teamMsg = `✅ *${me.name}* sudah READY — *${scopeLabel}* — ${klToday()}\n${body}`;

  // Build recipient → message, de-duplicated by number (staff copy wins).
  const byNumber = new Map<string, string>();
  const skipped: string[] = [];

  // the staff themselves
  if (me.whatsapp) byNumber.set(me.whatsapp, selfMsg);
  else skipped.push(`${me.name} (no WhatsApp)`);

  // their leader
  const leader = me.leader_id ? db.staff.find((s) => s.id === me.leader_id) : null;
  if (leader?.whatsapp) { if (!byNumber.has(leader.whatsapp)) byNumber.set(leader.whatsapp, teamMsg); }
  else if (leader) skipped.push(`${leader.name} (no WhatsApp)`);

  // the boss(es)
  const bosses = admins(db.staff);
  for (const b of bosses) if (!byNumber.has(b.whatsapp)) byNumber.set(b.whatsapp, teamMsg);
  if (bosses.length === 0) skipped.push("boss (no WhatsApp)");

  const targets = [...byNumber.entries()].map(([number, message]) => ({ number, message }));
  const results = await sendWhatsAppMany(targets);
  return { sent: results.filter((r) => r.ok).length, skipped, count: pool.length };
}

// A quick self-test send (used by the boss "test" button).
export async function sendTest(number: string): Promise<SendResult> {
  return sendWhatsApp(number, `🔔 Ujian notifikasi NLLITE — ${klToday()}. Jika anda terima mesej ini, sambungan WhatsApp berjaya ✅`);
}
