import type { Priority, Recurrence, Session, Status, TaskType } from "@/lib/types";
import { PRIORITY_LABEL, RECURRENCE_LABEL, SESSION_LABEL, STATUS_LABEL, ROLE_COLORS } from "@/lib/types";

export function SessionChip({ s }: { s: Session | null }) {
  if (!s) return null;
  const map: Record<Session, [string, string]> = {
    pagi: ["#b45309", "#fffbeb"],
    tengahari: ["#c2410c", "#fff7ed"],
    petang: ["#7c3aed", "#f5f3ff"],
    malam: ["#1e3a8a", "#eef2ff"],
  };
  const emoji: Record<Session, string> = { pagi: "🌅", tengahari: "☀️", petang: "🌇", malam: "🌙" };
  const [color, bg] = map[s];
  return (
    <span className="chip" style={{ color, background: bg }}>
      {emoji[s]} {SESSION_LABEL[s]}
    </span>
  );
}

export function Avatar({ name, color, size = 36 }: { name: string; color: string; size?: number }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className="grid place-items-center rounded-full text-white font-bold shrink-0"
      style={{ background: color, width: size, height: size, fontSize: size * 0.4 }}
      title={name}
    >
      {initials}
    </div>
  );
}

export function PriorityChip({ p }: { p: Priority }) {
  const map: Record<Priority, [string, string, string]> = {
    high: ["#dc2626", "#fef2f2", "🔴"],
    medium: ["#ea580c", "#fff7ed", "🟠"],
    low: ["#16a34a", "#f0fdf4", "🟢"],
  };
  const [color, bg, dot] = map[p];
  return (
    <span className="chip" style={{ color, background: bg }}>
      {dot} {PRIORITY_LABEL[p]}
    </span>
  );
}

export function StatusChip({ s }: { s: Status }) {
  const map: Record<Status, [string, string]> = {
    todo: ["#475569", "#f1f5f9"],
    priority: ["#dc2626", "#fef2f2"],
    in_progress: ["#2563eb", "#eff6ff"],
    done: ["#16a34a", "#f0fdf4"],
    on_hold: ["#7c3aed", "#f5f3ff"],
  };
  const [color, bg] = map[s];
  return (
    <span className="chip" style={{ color, background: bg }}>
      {STATUS_LABEL[s]}
    </span>
  );
}

export function TypeChip({ t }: { t: TaskType }) {
  const isInternal = t === "internal";
  return (
    <span
      className="chip"
      style={{
        color: isInternal ? "#7c3aed" : "#0891b2",
        background: isInternal ? "#f5f3ff" : "#ecfeff",
      }}
    >
      {isInternal ? "🏢 Internal" : "🌐 External"}
    </span>
  );
}

export function RecurrenceChip({ r }: { r: Recurrence }) {
  if (r === "once") return null;
  const emoji = r === "daily" ? "☀️" : r === "weekly" ? "📅" : "🗓️";
  return (
    <span className="chip" style={{ color: "#b45309", background: "#fffbeb" }}>
      🔁 {emoji} {RECURRENCE_LABEL[r]}
    </span>
  );
}

export function RoleChip({ role }: { role: string }) {
  const color = (ROLE_COLORS as Record<string, string>)[role] ?? "#64748b";
  return (
    <span className="chip" style={{ color, background: color + "1a" }}>
      {role}
    </span>
  );
}

export function ProgressBar({ value, overdue = false }: { value: number; overdue?: boolean }) {
  const v = Math.max(0, Math.min(100, value));
  const color = v >= 100 ? "#22c55e" : overdue ? "#ef4444" : "#2563eb";
  return (
    <div
      className="w-full rounded-full overflow-hidden"
      style={{ height: 8, background: "var(--surface-alt)" }}
    >
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${v}%`, background: color }}
      />
    </div>
  );
}
