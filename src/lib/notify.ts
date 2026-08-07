import "server-only";

import type { DB, Staff, Task, Session } from "./types";
import { isTeamLead, SESSION_LABEL, RECURRENCE_LABEL, STATUS_LABEL } from "./types";
import { isOverdue, klToday } from "./tasks";
import { sendWhatsApp, sendWhatsAppMany, type SendResult } from "./whatsapp";

// A "Ready" send is scoped to either all To Do items or one session of the day.
export type ReadyScope = "all" | Session;

// Context to resolve names/brands inside detailed task bullets.
interface Ctx {
  staff: Staff[];
  brands: { id: string; name: string }[];
}
function nameById(staff: Staff[], id: string): string {
  return staff.find((s) => s.id === id)?.name ?? "?";
}

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

// One WhatsApp bullet: the title + every detail filled in on the task
// (brand, routine, session, date, PIC, JV helpers, attachments, description).
function bullet(t: Task, ctx: Ctx): string {
  const lines: string[] = [`• *${t.title}*`];

  const meta: string[] = [];
  const brand = ctx.brands.find((b) => b.id === t.brand_id);
  if (brand) meta.push(`🏷️ ${brand.name}`);
  if (t.recurrence !== "once") meta.push(`🔁 ${RECURRENCE_LABEL[t.recurrence]}`);
  if (t.session) meta.push(`⏰ ${SESSION_LABEL[t.session]}`);
  meta.push(`📌 ${STATUS_LABEL[t.status]}`);
  if (meta.length) lines.push(`   ${meta.join(" · ")}`);

  if (t.due_date) lines.push(`   📅 ${t.due_date}${isOverdue(t) ? " ⚠ OVERDUE" : ""}`);

  const jv = (t.jv_ids || []).map((id) => nameById(ctx.staff, id)).filter((n) => n !== "?");
  if (jv.length) lines.push(`   🤝 JV: ${jv.join(", ")}`);

  const att = t.attachments || [];
  if (att.length) {
    const links = att.filter((a) => a.kind === "link").map((a) => a.url);
    lines.push(`   📎 ${att.length} lampiran${links.length ? ": " + links.join(", ") : ""}`);
  }

  const desc = (t.description || "").trim().replace(/\s+/g, " ");
  if (desc) lines.push(`   📝 ${desc.length > 300 ? desc.slice(0, 300) + "…" : desc}`);

  return lines.join("\n");
}

// ---- Message builders (Bahasa Malaysia) ----

function line(c: Counts): string {
  return `${c.todo} to do · ${c.inProgress} in progress · ${c.onHold} on hold · ${c.open} left${c.overdue ? ` · ⚠ ${c.overdue} overdue` : ""}`;
}

export function personalMessage(staff: Staff, db: DB): string {
  const tasks = db.tasks;
  const ctx: Ctx = { staff: db.staff, brands: db.brands ?? [] };
  const c = countFor(tasks, staff.id);
  const items = todoTasks(tasks, staff.id);
  const name = staff.name.split(" ")[0];
  const list = items.length
    ? "\n" + items.map((t) => bullet(t, ctx)).join("\n")
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

// Company-wide recipients of boss-level notifications: the Boss (is_admin),
// any Company Viewer / overseer, AND anyone explicitly flagged "receive all
// notifications" (notify_all) — they all get the company summary, every Ready
// notice and every status alert.
function admins(staff: Staff[]): Staff[] {
  return staff.filter(
    (s) => s.active && (s.is_admin || s.is_overseer || s.notify_all) && s.whatsapp
  );
}

// ---- Runners ----

// The full daily push: reminder to each staff, team summary to each leader,
// company summary to the boss(es). Returns how many messages of each kind went out.
export async function runDailyNotifications(db: DB): Promise<{ personal: number; leaders: number; boss: number }> {
  const active = db.staff.filter((s) => s.active);

  // 1) personal reminder to every staff who has a number
  const personalTargets = active
    .filter((s) => s.whatsapp)
    .map((s) => ({ number: s.whatsapp, message: personalMessage(s, db) }));

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
  const ctx: Ctx = { staff: db.staff, brands: db.brands ?? [] };
  const scopeLabel = scope === "all" ? "Semua To Do" : SESSION_LABEL[scope];
  const list = items.length ? "\n" + items.map((t) => bullet(t, ctx)).join("\n") : "\n(kosong)";
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

// A task's status changed (e.g. dragged to another column): notify the
// PIC (assignee) + their leader + the boss(es). Deduplicated by number.
export async function sendStatusChange(
  db: DB,
  actorId: string,
  task: Task,
  from: string,
  to: string
): Promise<number> {
  const actor = db.staff.find((s) => s.id === actorId);
  const assignee = task.assignee_id ? db.staff.find((s) => s.id === task.assignee_id) : null;
  const mover = actor?.name ?? "Seseorang";
  const brand = (db.brands ?? []).find((b) => b.id === task.brand_id);
  const msg =
    `🔄 *Status Tugasan Berubah* — ${klToday()}\n` +
    `*${task.title}*${brand ? `\n🏷️ ${brand.name}` : ""}\n` +
    `${STATUS_LABEL[from as keyof typeof STATUS_LABEL] ?? from} → *${STATUS_LABEL[to as keyof typeof STATUS_LABEL] ?? to}*\n` +
    `👤 Oleh: ${mover}\n` +
    `\n_NLLITE • NL Legacy_`;

  const byNumber = new Map<string, string>();
  if (assignee?.whatsapp) byNumber.set(assignee.whatsapp, msg);
  const leader = assignee?.leader_id ? db.staff.find((s) => s.id === assignee.leader_id) : null;
  if (leader?.whatsapp && !byNumber.has(leader.whatsapp)) byNumber.set(leader.whatsapp, msg);
  for (const b of admins(db.staff)) if (!byNumber.has(b.whatsapp)) byNumber.set(b.whatsapp, msg);

  const targets = [...byNumber.entries()].map(([number, message]) => ({ number, message }));
  const results = await sendWhatsAppMany(targets);
  return results.filter((r) => r.ok).length;
}

// A quick self-test send (used by the boss "test" button).
export async function sendTest(number: string): Promise<SendResult> {
  return sendWhatsApp(number, `🔔 Ujian notifikasi NLLITE — ${klToday()}. Jika anda terima mesej ini, sambungan WhatsApp berjaya ✅`);
}
