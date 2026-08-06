"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { mutateDb, readDb, newId, nextStaffId } from "./db";
import { supabase, ATTACHMENTS_BUCKET } from "./supabase";
import type { Attachment } from "./types";
import { normalizeStaffId, normalizeMsPhone, isTeamLead } from "./types";
import { runDailyNotifications, sendReadyNotice, sendStatusChange, sendTest, type ReadyScope } from "./notify";
import { getCurrentUser, setSessionCookie, clearSessionCookie } from "./session";
import { rolloverRoutines } from "./store";
import {
  ADMIN_ROLES,
  ROLE_COLORS,
  ROLES,
  type Priority,
  type Recurrence,
  type Role,
  type Session,
  type Status,
  type TaskType,
} from "./types";
import { currentPeriodEnd, currentPeriodKey } from "./tasks";
import { canDeleteTask, canEditTask, canProgressTask } from "./perms";
import { STATUS_LABEL } from "./types";

function logActivity(task: { activity: { id: string; staff_id: string; action: string; created_at: string }[] }, staffId: string, action: string) {
  task.activity.push({ id: newId(), staff_id: staffId, action, created_at: new Date().toISOString() });
}

// Save uploaded images/PDFs to /public/uploads and collect link URLs.
async function saveAttachments(formData: FormData): Promise<Attachment[]> {
  const out: Attachment[] = [];
  const now = new Date().toISOString();

  // Links (one URL per line)
  const linksRaw = String(formData.get("links") || "");
  for (const line of linksRaw.split(/[\n,]+/)) {
    let url = line.trim();
    if (!url) continue;
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    out.push({ id: newId(), kind: "link", name: url.replace(/^https?:\/\//, ""), url, created_at: now });
  }

  // Files (images + pdf) → Supabase Storage
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  for (const file of files) {
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    const isImage = file.type.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/i.test(file.name);
    if (!isPdf && !isImage) continue;
    if (file.size > 8 * 1024 * 1024) continue; // 8MB cap
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
    const objectPath = `${newId()}-${safe}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error } = await supabase()
      .storage.from(ATTACHMENTS_BUCKET)
      .upload(objectPath, buf, { contentType: file.type || (isPdf ? "application/pdf" : "image/*"), upsert: false });
    if (error) continue; // skip a file that failed to upload
    const { data } = supabase().storage.from(ATTACHMENTS_BUCKET).getPublicUrl(objectPath);
    out.push({ id: newId(), kind: isPdf ? "pdf" : "image", name: file.name, url: data.publicUrl, created_at: now });
  }
  return out;
}

// Decide the final assignee based on who's acting:
//  admin → anyone · leader → their team (else self) · staff → always self.
function resolveAssignee(
  db: { staff: { id: string; leader_id: string | null }[] },
  user: { id: string; is_admin: boolean; role?: string; is_overseer?: boolean },
  requested: string | null
): string | null {
  if (user.is_admin || user.is_overseer) return requested; // boss & company-viewer → anyone
  if (isTeamLead(user)) {
    const team = new Set(db.staff.filter((s) => s.leader_id === user.id).map((s) => s.id));
    team.add(user.id);
    return requested && team.has(requested) ? requested : user.id;
  }
  return user.id; // plain staff → themselves
}

// JV helpers pool: admin/viewer → any active staff · leader → their team (+self) · staff → none.
function resolveJv(
  db: { staff: { id: string; active: boolean; leader_id: string | null }[] },
  user: { id: string; is_admin: boolean; role?: string; is_overseer?: boolean },
  requested: string[]
): string[] {
  let allowed: Set<string>;
  if (user.is_admin || user.is_overseer) {
    allowed = new Set(db.staff.filter((s) => s.active).map((s) => s.id));
  } else if (isTeamLead(user)) {
    allowed = new Set(db.staff.filter((s) => s.active && s.leader_id === user.id).map((s) => s.id));
    allowed.add(user.id);
  } else {
    return [];
  }
  return [...new Set(requested.filter((id) => allowed.has(id)))];
}

// ---------------- Auth ----------------

export async function login(_prev: unknown, formData: FormData): Promise<{ error?: string }> {
  const staffId = normalizeStaffId(String(formData.get("staff_id") || ""));
  const password = String(formData.get("password") || "");
  if (!staffId || !password) return { error: "Please enter your Staff ID and password." };

  const db = await readDb();
  const staff = db.staff.find((s) => s.staff_id === staffId && s.active);
  if (!staff) return { error: "No account with that Staff ID." };
  const ok = await bcrypt.compare(password, staff.password_hash);
  if (!ok) return { error: "Wrong password." };

  setSessionCookie(staff.id);
  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  clearSessionCookie();
  redirect("/login");
}

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.is_admin) throw new Error("Not authorised.");
  return user;
}

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

// ---------------- Tasks ----------------

export async function createTask(formData: FormData): Promise<void> {
  // Everyone can create a task. Staff tasks auto-assign to themselves;
  // only admins may assign to someone else.
  const user = await requireUser();
  const recurrence = (String(formData.get("recurrence") || "once") as Recurrence);
  const rawDue = String(formData.get("due_date") || "").trim();

  const now = new Date();
  // daily/weekly/monthly → chosen date, else default period end (today for daily); once → chosen date
  const due =
    recurrence === "once"
      ? (rawDue || null)
      : (rawDue || currentPeriodEnd(recurrence, now));
  const period_key = recurrence === "once" ? null : currentPeriodKey(recurrence, now);
  const requestedAssignee = String(formData.get("assignee_id") || "") || null;
  const session =
    recurrence === "daily" ? (String(formData.get("session") || "") as Session) || null : null;
  const attachments = await saveAttachments(formData);

  const requestedJv = formData.getAll("jv_ids").map(String);

  await mutateDb((db) => {
    const assignee_id = resolveAssignee(db, user, requestedAssignee);
    const jv_ids = resolveJv(db, user, requestedJv).filter((id) => id !== assignee_id);
    db.tasks.push({
      id: newId(),
      title: String(formData.get("title") || "").trim() || "Untitled task",
      description: String(formData.get("description") || "").trim(),
      type: (String(formData.get("type") || "internal") as TaskType),
      brand_id: String(formData.get("brand_id") || "") || null,
      assignee_id,
      jv_ids,
      created_by: user.id,
      priority: (String(formData.get("priority") || "medium") as Priority),
      status: "todo",
      progress: 0,
      due_date: due,
      original_due: due,
      carried_days: 0,
      recurrence,
      session,
      period_key,
      missed_count: 0,
      completed_at: null,
      comments: [],
      activity: [
        { id: newId(), staff_id: user.id, action: "created this task", created_at: now.toISOString() },
      ],
      attachments,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    });
  });
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/my-tasks");
}

export async function updateTask(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") || "");
  const recurrence = (String(formData.get("recurrence") || "once") as Recurrence);
  const rawDue = String(formData.get("due_date") || "").trim();
  const now = new Date();
  const newAttachments = await saveAttachments(formData);

  await mutateDb((db) => {
    const t = db.tasks.find((x) => x.id === id);
    if (!t) return;
    if (!canEditTask(user, t)) return; // admins or creator only
    if (newAttachments.length) t.attachments.push(...newAttachments);
    const prevAssignee = t.assignee_id;
    t.title = String(formData.get("title") || t.title).trim();
    t.description = String(formData.get("description") || "").trim();
    t.type = String(formData.get("type") || t.type) as TaskType;
    if (formData.has("brand_id")) t.brand_id = String(formData.get("brand_id") || "") || null;
    // Admins/company-viewers reassign to anyone; leaders within their team; staff can't reassign.
    if (user.is_admin || user.is_overseer || isTeamLead(user)) {
      t.assignee_id = resolveAssignee(db, user, String(formData.get("assignee_id") || "") || null);
      t.jv_ids = resolveJv(db, user, formData.getAll("jv_ids").map(String)).filter((id) => id !== t.assignee_id);
    }
    t.priority = String(formData.get("priority") || t.priority) as Priority;
    if (recurrence !== t.recurrence) {
      t.recurrence = recurrence;
      t.period_key = recurrence === "once" ? null : currentPeriodKey(recurrence, now);
    }
    t.session =
      recurrence === "daily" ? (String(formData.get("session") || "") as Session) || null : null;
    const prevDue = t.due_date;
    t.due_date =
      recurrence === "once"
        ? (rawDue || null)
        : (rawDue || currentPeriodEnd(recurrence, now));
    // editing the deadline restarts the carry-forward clock
    if (t.due_date !== prevDue) {
      t.original_due = t.due_date;
      t.carried_days = 0;
    }
    if (prevAssignee !== t.assignee_id) {
      logActivity(t, user.id, "reassigned this task");
    }
    logActivity(t, user.id, "edited task details");
    t.updated_at = now.toISOString();
  });
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/my-tasks");
}

export async function setTaskStatus(id: string, status: Status): Promise<void> {
  const user = await requireUser();
  const now = new Date();
  let changedFrom: Status | null = null;
  await mutateDb((db) => {
    const t = db.tasks.find((x) => x.id === id);
    if (!t) return;
    if (!canProgressTask(user, t)) return; // assignee, creator or admin
    const prev = t.status;
    t.status = status;
    if (status === "done") {
      t.progress = 100;
      t.completed_at = now.toISOString();
    } else {
      t.completed_at = null;
      if (status === "todo") t.progress = 0;
      if (status === "in_progress" && t.progress >= 100) t.progress = 50;
    }
    if (prev !== status) { logActivity(t, user.id, `marked as ${STATUS_LABEL[status]}`); changedFrom = prev; }
    t.updated_at = now.toISOString();
  });
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/my-tasks");

  // WhatsApp everyone (PIC + leader + boss) about the move, unless boss turned it off.
  if (changedFrom && changedFrom !== status) {
    try {
      const db = await readDb();
      if (db.settings?.status_alerts !== false) {
        const task = db.tasks.find((x) => x.id === id);
        if (task) await sendStatusChange(db, user.id, task, changedFrom, status);
      }
    } catch { /* never let a WhatsApp hiccup break the status change */ }
  }
}

export async function setTaskProgress(id: string, progress: number): Promise<void> {
  const user = await requireUser();
  const now = new Date();
  const p = Math.max(0, Math.min(100, Math.round(progress)));
  await mutateDb((db) => {
    const t = db.tasks.find((x) => x.id === id);
    if (!t) return;
    if (!canProgressTask(user, t)) return;
    const wasDone = t.status === "done";
    t.progress = p;
    if (p >= 100) {
      t.status = "done";
      t.completed_at = now.toISOString();
      if (!wasDone) logActivity(t, user.id, "marked as Done");
    } else if (p > 0) {
      t.status = "in_progress";
      t.completed_at = null;
    } else {
      t.status = "todo";
      t.completed_at = null;
    }
    t.updated_at = now.toISOString();
  });
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/my-tasks");
}

export async function addComment(taskId: string, text: string): Promise<void> {
  const user = await requireUser();
  const clean = text.trim();
  if (!clean) return;
  await mutateDb((db) => {
    const t = db.tasks.find((x) => x.id === taskId);
    if (!t) return;
    t.comments.push({ id: newId(), staff_id: user.id, text: clean, created_at: new Date().toISOString() });
    logActivity(t, user.id, "commented");
  });
  revalidatePath("/tasks");
  revalidatePath("/my-tasks");
}

export async function deleteTask(id: string): Promise<void> {
  const user = await requireUser();
  await mutateDb((db) => {
    const t = db.tasks.find((x) => x.id === id);
    if (!t) return;
    if (!canDeleteTask(user, t)) return; // admins or the creator only
    db.tasks = db.tasks.filter((x) => x.id !== id);
  });
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/my-tasks");
}

// ---------------- Staff ----------------

export async function createStaff(formData: FormData): Promise<void> {
  const user = await requireUser();
  const isLeaderUser = !user.is_admin && isTeamLead(user);
  if (!user.is_admin && !isLeaderUser) return; // only boss or a leader
  const name = String(formData.get("name") || "").trim();
  const role = (String(formData.get("role") || "Marketer (PIC)") as Role);
  const providedPw = String(formData.get("password") || "").trim();
  // Leaders can only add plain staff under themselves (never admins, never other teams).
  const isAdmin = user.is_admin
    ? formData.get("is_admin") === "on" || ADMIN_ROLES.includes(role)
    : false;
  const isManager = user.is_admin ? formData.get("is_manager") === "on" : false;
  const isOverseer = user.is_admin ? formData.get("is_overseer") === "on" : false;
  const leader_id = user.is_admin ? String(formData.get("leader_id") || "") || null : user.id;
  if (!name) return;

  await mutateDb(async (db) => {
    const staff_id = nextStaffId(db); // auto NL-00X
    // Default password == the new Staff ID (unless one was explicitly typed).
    const hash = await bcrypt.hash(providedPw || staff_id, 10);
    db.staff.push({
      id: newId(),
      staff_id,
      name,
      password_hash: hash,
      role: ROLES.includes(role) ? role : "Marketer (PIC)",
      is_admin: isAdmin,
      is_manager: isManager,
      is_overseer: isOverseer,
      leader_id,
      whatsapp: normalizeMsPhone(String(formData.get("whatsapp") || "")),
      avatar_color: ROLE_COLORS[role] ?? "#2563eb",
      active: true,
      created_at: new Date().toISOString(),
    });
  });
  revalidatePath("/staff");
}

export async function updateStaff(formData: FormData): Promise<void> {
  const user = await requireUser();
  const isLeaderUser = !user.is_admin && isTeamLead(user);
  if (!user.is_admin && !isLeaderUser) return;
  const id = String(formData.get("id") || "");
  const role = (String(formData.get("role") || "") as Role);
  const password = String(formData.get("password") || "").trim();
  const newHash = password ? await bcrypt.hash(password, 10) : null;

  await mutateDb((db) => {
    const s = db.staff.find((x) => x.id === id);
    if (!s) return;
    // A leader may only edit their own team members.
    if (isLeaderUser && s.leader_id !== user.id) return;
    s.name = String(formData.get("name") || s.name).trim();
    if (ROLES.includes(role)) {
      s.role = role;
      s.avatar_color = ROLE_COLORS[role];
    }
    s.active = formData.get("active") !== "off";
    if (formData.has("whatsapp")) s.whatsapp = normalizeMsPhone(String(formData.get("whatsapp") || ""));
    if (user.is_admin) {
      s.is_admin = formData.get("is_admin") === "on";
      s.is_manager = formData.get("is_manager") === "on";
      s.is_overseer = formData.get("is_overseer") === "on";
      const leaderId = String(formData.get("leader_id") || "") || null;
      s.leader_id = leaderId === s.id ? null : leaderId;
    } else {
      // leader: never grants admin/manager, keeps staff under themselves
      s.is_admin = false;
      s.leader_id = user.id;
    }
    if (newHash) s.password_hash = newHash;
  });
  revalidatePath("/staff");
}

export async function deleteStaff(id: string): Promise<void> {
  const user = await requireUser();
  const isLeaderUser = !user.is_admin && isTeamLead(user);
  if (!user.is_admin && !isLeaderUser) return;
  if (user.id === id) return; // don't delete yourself
  await mutateDb((db) => {
    const s = db.staff.find((x) => x.id === id);
    if (!s) return;
    if (isLeaderUser && s.leader_id !== user.id) return; // only own team
    db.staff = db.staff.filter((x) => x.id !== id);
    // unassign their tasks
    for (const t of db.tasks) if (t.assignee_id === id) t.assignee_id = null;
    // if a leader was deleted, their team reverts to reporting to the Boss (no leader)
    for (const x of db.staff) if (x.leader_id === id) x.leader_id = null;
  });
  revalidatePath("/staff");
}

// ---------------- Self-service profile ----------------

export async function updateOwnProfile(
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string; ok?: string }> {
  const user = await requireUser();
  const name = String(formData.get("name") || "").trim();
  const whatsapp = normalizeMsPhone(String(formData.get("whatsapp") || ""));
  const current = String(formData.get("current_password") || "");
  const next = String(formData.get("new_password") || "").trim();

  const changingPassword = next.length > 0;
  if (changingPassword && next.length < 6) {
    return { error: "New password must be at least 6 characters." };
  }

  const db = await readDb();
  const me = db.staff.find((s) => s.id === user.id);
  if (!me) return { error: "Account not found." };

  if (changingPassword) {
    const ok = await bcrypt.compare(current, me.password_hash);
    if (!ok) return { error: "Current password is incorrect." };
  }
  const newHash = changingPassword ? await bcrypt.hash(next, 10) : null;

  await mutateDb((d) => {
    const s = d.staff.find((x) => x.id === user.id);
    if (!s) return;
    if (name) s.name = name;
    if (formData.has("whatsapp")) s.whatsapp = whatsapp;
    if (newHash) s.password_hash = newHash;
  });
  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { ok: changingPassword ? "Profile & password updated." : "Profile updated." };
}

// ---------------- Brands ----------------

// Boss (admin) or any team lead can manage the shared brand list.
async function requireBrandManager() {
  const user = await requireUser();
  if (!user.is_admin && !isTeamLead(user)) throw new Error("Not authorised.");
  return user;
}

export async function createBrand(formData: FormData): Promise<void> {
  await requireBrandManager();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  await mutateDb((db) => {
    if (!db.brands) db.brands = [];
    // no duplicate names (case-insensitive)
    if (db.brands.some((b) => b.name.toLowerCase() === name.toLowerCase())) return;
    db.brands.push({ id: newId(), name, active: true, created_at: new Date().toISOString() });
  });
  revalidatePath("/brands");
  revalidatePath("/tasks");
  revalidatePath("/my-tasks");
}

export async function updateBrand(formData: FormData): Promise<void> {
  await requireBrandManager();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  await mutateDb((db) => {
    const b = db.brands?.find((x) => x.id === id);
    if (!b) return;
    if (name) b.name = name;
    b.active = formData.get("active") !== "off";
  });
  revalidatePath("/brands");
  revalidatePath("/tasks");
  revalidatePath("/my-tasks");
}

export async function deleteBrand(id: string): Promise<void> {
  await requireBrandManager();
  await mutateDb((db) => {
    if (!db.brands) return;
    db.brands = db.brands.filter((b) => b.id !== id);
    // any task pointing at it becomes brand-less (keeps the task intact)
    for (const t of db.tasks) if (t.brand_id === id) t.brand_id = null;
  });
  revalidatePath("/brands");
  revalidatePath("/tasks");
  revalidatePath("/my-tasks");
}

// ---------------- WhatsApp notifications ----------------

// A staff clicks "Ready": WhatsApp their To Do summary to their leader + boss.
// scope = "all" (whole To Do list) or a session (pagi/tengahari/petang/malam).
export async function submitReady(
  scope: string = "all"
): Promise<{ sent: number; skipped: string[]; count: number }> {
  const user = await requireUser();
  const db = await readDb();
  const valid: ReadyScope[] = ["all", "pagi", "tengahari", "petang", "malam"];
  const s: ReadyScope = (valid as string[]).includes(scope) ? (scope as ReadyScope) : "all";
  return sendReadyNotice(db, user.id, s);
}

// Boss saves the auto-notification schedule (times of day + on/off).
export async function updateNotifySettings(formData: FormData): Promise<void> {
  await requireAdmin();
  const enabled = formData.get("enabled") === "on";
  // times come as a comma/newline separated list of HH:MM
  const raw = String(formData.get("times") || "");
  const times = [...new Set(
    raw
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter((s) => /^\d{1,2}:\d{2}$/.test(s))
      .map((s) => {
        const [h, m] = s.split(":");
        return `${h.padStart(2, "0")}:${m}`;
      })
  )].sort();
  const statusAlerts = formData.get("status_alerts") === "on";
  await mutateDb((db) => {
    db.settings = { enabled, times, last_sent: db.settings?.last_sent ?? {}, status_alerts: statusAlerts };
  });
  revalidatePath("/settings");
}

// Boss presses "Send summaries now" — fire the full daily push immediately.
export async function sendNotificationsNow(): Promise<{ personal: number; leaders: number; boss: number }> {
  await requireAdmin();
  const db = await readDb();
  return runDailyNotifications(db);
}

// Boss "test" — send a single test message to a number.
export async function sendTestNotification(number: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const norm = normalizeMsPhone(number);
  if (!norm) return { ok: false, error: "No valid number" };
  const r = await sendTest(norm);
  return { ok: r.ok, error: r.error };
}

export { rolloverRoutines };
