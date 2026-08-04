// ============================================================
//  NL Legacy TaskFlow — shared types & constants
// ============================================================

export type Role =
  | "CEO / Boss"
  | "Director"
  | "Leader"
  | "Human Resources"
  | "IT Department"
  | "Admin"
  | "Marketer (PIC)"
  | "Team Sale"
  | "Content Creator"
  | "Editor"
  | "Live Host"
  | "AI Lead"
  | "Marketer";

// The full role list (order = presentation order)
export const ROLES: Role[] = [
  "CEO / Boss",
  "Director",
  "Leader",
  "Human Resources",
  "IT Department",
  "Admin",
  "Marketer (PIC)",
  "Marketer",
  "Team Sale",
  "Content Creator",
  "Editor",
  "AI Lead",
  "Live Host",
];

// Roles that manage a team (their own reporting staff) — Leader & Director behave the same.
export const MANAGER_ROLES: Role[] = ["Director", "Leader"];
export function isManagerRole(role: Role | string | undefined): boolean {
  return !!role && MANAGER_ROLES.includes(role as Role);
}

// Whether a person leads a team: either a manager ROLE (Leader/Director) OR the
// is_manager flag set (so e.g. an "Admin" department person can also lead a team).
export function isTeamLead(u: { role?: string; is_admin?: boolean; is_manager?: boolean; is_overseer?: boolean }): boolean {
  if (u.is_admin || u.is_overseer) return false; // admins & company-viewers aren't team managers
  return u.is_manager === true || isManagerRole(u.role);
}

// Sees the whole company (Dashboard/All Tasks/Reports): full admin OR a viewer/overseer.
export function seesAllCompany(u: { is_admin?: boolean; is_overseer?: boolean }): boolean {
  return !!u.is_admin || !!u.is_overseer;
}

// Roles that get admin powers by default. For now ONLY the CEO / Boss is admin;
// Leader / HR / Admin start as regular staff until the boss grants them admin
// access manually on the Staff page.
export const ADMIN_ROLES: Role[] = ["CEO / Boss"];

// A colour per role for badges / avatars
export const ROLE_COLORS: Record<Role, string> = {
  "CEO / Boss": "#8b5cf6",
  Director: "#4f46e5",
  Leader: "#2563eb",
  "Human Resources": "#ec4899",
  "IT Department": "#0ea5e9",
  Admin: "#f97316",
  "Marketer (PIC)": "#22c55e",
  Marketer: "#16a34a",
  "Team Sale": "#eab308",
  "Content Creator": "#14b8a6",
  Editor: "#a855f7",
  "AI Lead": "#c026d3",
  "Live Host": "#ef4444",
};

export type TaskType = "internal" | "external";
export type Priority = "low" | "medium" | "high";
export type Status = "todo" | "priority" | "in_progress" | "done" | "on_hold";
export type Recurrence = "once" | "daily" | "weekly" | "monthly";
// Session of the day — only used for DAILY tasks
export type Session = "pagi" | "tengahari" | "petang" | "malam";

export interface Staff {
  id: string;
  staff_id: string; // login ID, format NL-001 (auto-increments)
  name: string;
  password_hash: string;
  role: Role;
  is_admin: boolean;
  is_manager: boolean; // leads a team (independent of department role)
  is_overseer: boolean; // company-wide VIEWER — sees everyone, but can't manage/delete staff
  leader_id: string | null; // the Leader this staff reports to (team)
  whatsapp: string; // WhatsApp number, normalised MY format e.g. 60123456789 ("" = none)
  avatar_color: string;
  active: boolean;
  created_at: string;
}

// Boss-controlled WhatsApp notification schedule/config.
export interface NotifySettings {
  enabled: boolean;
  times: string[]; // KL times "HH:MM" to auto-send the daily summaries
  last_sent: Record<string, string>; // slot "HH:MM" → last date sent "YYYY-MM-DD" (dedupe)
}

export const DEFAULT_NOTIFY: NotifySettings = { enabled: false, times: [], last_sent: {} };

export interface Brand {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
}

// The company's product brands — seeded on first run, then boss/leader manage.
export const DEFAULT_BRAND_NAMES: string[] = [
  "AURA WHITE", "AUREFIYA EXCLUSIVE", "AVOKI", "BABANYONYA", "CANDYTA",
  "CANTIK GOLD", "COSRX", "DOLCEA", "DR AINA", "GB GLOWING", "Gluvera",
  "HARIKA", "KIYORA", "MASTER ALEYH", "MOMMY HANA", "NEUPRODUCTION",
  "NUBHAN", "PANNA LAB", "PRODUK MAKANAN", "RAJA PERFUME", "RISSA SKIN",
  "SOMEBYME", "SOULMATE", "SYIFA GOLD", "VERONIQ", "ZZADMINMANAGE",
];

export interface Comment {
  id: string;
  staff_id: string;
  text: string;
  created_at: string;
}

export interface Activity {
  id: string;
  staff_id: string;
  action: string; // human-readable, e.g. "marked as Done"
  created_at: string;
}

export interface Attachment {
  id: string;
  kind: "image" | "pdf" | "link";
  name: string;
  url: string; // /uploads/... for files, or the external URL for links
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  brand_id: string | null; // optional product brand this task is for
  assignee_id: string | null; // PIC (main person in charge)
  jv_ids: string[]; // JV helpers — other staff asked to help the PIC on this task
  created_by: string | null;
  priority: Priority;
  status: Status;
  progress: number; // 0-100
  due_date: string | null; // ISO date (YYYY-MM-DD) — the ACTIVE deadline (carries forward)
  original_due: string | null; // the first deadline set, before any carry-forward
  carried_days: number; // days an overdue one-time task has been carried past its original deadline
  recurrence: Recurrence;
  session: Session | null; // Sesi Pagi/Tengahari/Petang — daily tasks only
  period_key: string | null; // current period token for routines
  missed_count: number;
  completed_at: string | null;
  comments: Comment[];
  activity: Activity[];
  attachments: Attachment[];
  created_at: string;
  updated_at: string;
}

// Minimal actor used for permission checks (client-safe)
export interface Actor {
  id: string;
  is_admin: boolean;
  is_leader?: boolean; // a Leader who manages a team
  is_overseer?: boolean; // company viewer/coordinator (assigns to anyone, no staff mgmt)
}

export interface DB {
  staff: Staff[];
  tasks: Task[];
  brands?: Brand[];
  settings?: NotifySettings;
}

// Public-safe staff shape (no password hash) for passing to the client
export type SafeStaff = Omit<Staff, "password_hash">;
export function toSafeStaff(s: Staff): SafeStaff {
  const { password_hash, ...rest } = s;
  return rest;
}

// Normalise a Malaysian WhatsApp number to Whacenter format (60XXXXXXXXX):
//  strips spaces/dashes/+/() and any other non-digits, then:
//   "60123456789" → unchanged · "0123456789" → "60123456789"
//   "123456789"   → "60123456789" · already-"6…" kept.
// Returns "" for empty/invalid input.
export function normalizeMsPhone(input: string): string {
  const digits = (input || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("60")) return digits;
  if (digits.startsWith("0")) return "6" + digits; // 0123456789 → 60123456789
  if (digits.startsWith("6")) return digits; // 6xxxxxxxx already country-coded
  return "60" + digits; // bare local like 123456789
}

// Pretty display of a stored number: 60123456789 → 60 12-345 6789 (best-effort)
export function displayPhone(p: string): string {
  if (!p) return "—";
  return p.replace(/^(60)(\d{2,3})(\d{3,4})(\d+)$/, "$1 $2-$3 $4");
}

// Normalise user-typed Staff IDs: "nl1", "NL-1", "1", "nl001" → "NL-001"
export function normalizeStaffId(input: string): string {
  const raw = (input || "").trim().toUpperCase().replace(/\s+/g, "");
  const m = /(\d+)/.exec(raw);
  if (!m) return raw;
  return `NL-${m[1].padStart(3, "0")}`;
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const STATUS_LABEL: Record<Status, string> = {
  todo: "To Do List",
  priority: "Priority Task",
  in_progress: "In Progress",
  done: "Completed",
  on_hold: "On Hold",
};

export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  once: "One-time",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

export const SESSION_LABEL: Record<Session, string> = {
  pagi: "Sesi Pagi",
  tengahari: "Sesi Tengahari",
  petang: "Sesi Petang",
  malam: "Sesi Malam",
};

export const SESSIONS: Session[] = ["pagi", "tengahari", "petang", "malam"];
