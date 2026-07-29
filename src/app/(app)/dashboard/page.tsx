import { getCurrentUser } from "@/lib/session";
import { loadData, isLeader as isLeaderFn } from "@/lib/store";
import { isOverdue, isDueToday, dueLabel, currentMonthStart, currentMonthEnd, klToday } from "@/lib/tasks";
import { ROLES } from "@/lib/types";
import { Avatar, ProgressBar, RoleChip, RecurrenceChip } from "@/components/ui";
import DashboardDateFilter from "@/components/DashboardDateFilter";

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  sub,
  color,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  icon: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted uppercase tracking-wide">{label}</span>
        <span
          className="h-8 w-8 grid place-items-center rounded-lg text-lg"
          style={{ background: color + "1a" }}
        >
          {icon}
        </span>
      </div>
      <div className="text-3xl font-extrabold mt-2" style={{ color }}>
        {value}
      </div>
      {sub && <div className="text-xs text-faint mt-0.5">{sub}</div>}
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string; field?: string };
}) {
  const user = await getCurrentUser();
  const { staff, tasks: allTasks } = await loadData();
  const isAdmin = !!user?.is_admin;
  const seesAll = isAdmin || !!user?.is_overseer; // admin or company-viewer → whole company
  const leader = !!user && isLeaderFn(user);
  const canSeeTeam = seesAll || leader; // company (boss/overseer) or team (leader)

  // Company-viewers/admins → all; Leaders → their team's tasks; Staff → only their own.
  const teamIds = leader && user ? new Set(staff.filter((s) => s.leader_id === user.id).map((s) => s.id).concat(user.id)) : null;
  const scoped = seesAll
    ? allTasks
    : leader && teamIds
    ? allTasks.filter((t) => t.assignee_id && teamIds.has(t.assignee_id))
    : allTasks.filter((t) => t.assignee_id === user?.id);

  // Which staff appear in "Team Performance"
  const perfStaff = seesAll
    ? staff.filter((s) => s.active)
    : leader && user
    ? staff.filter((s) => s.active && s.leader_id === user.id)
    : [];

  // Date-range filter (Malaysia time / YYYY-MM-DD).
  // field = "due" (deadline, default) or "created" (when the task was created).
  // Default range = the current month (1st → last day).
  const field = searchParams.field === "created" ? "created" : "due";
  const from = (searchParams.from || currentMonthStart()).trim();
  const to = (searchParams.to || currentMonthEnd()).trim();
  const tasks = scoped.filter((t) => {
    const d = field === "created" ? klToday(new Date(t.created_at)) : t.due_date;
    if (!d) return false; // no date on this field → excluded from a dated range
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });

  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const overdue = tasks.filter((t) => isOverdue(t));
  const dueToday = tasks.filter((t) => isDueToday(t) && t.status !== "done");
  const routines = tasks.filter((t) => t.recurrence !== "once").length;
  const internal = tasks.filter((t) => t.type === "internal").length;
  const external = tasks.filter((t) => t.type === "external").length;
  const completion = total ? Math.round((done / total) * 100) : 0;

  // per-staff performance (team members the viewer can monitor)
  const perStaff = perfStaff
    .map((s) => {
      const mine = tasks.filter((t) => t.assignee_id === s.id);
      const md = mine.filter((t) => t.status === "done").length;
      const mo = mine.filter((t) => isOverdue(t)).length;
      const missed = mine.reduce((a, t) => a + (t.missed_count || 0), 0);
      const rate = mine.length ? Math.round((md / mine.length) * 100) : 0;
      return { staff: s, assigned: mine.length, done: md, overdue: mo, missed, rate };
    })
    .sort((a, b) => b.assigned - a.assigned);

  // per-role summary
  const perRole = ROLES.map((role) => {
    const ids = new Set(staff.filter((s) => s.role === role).map((s) => s.id));
    const mine = tasks.filter((t) => t.assignee_id && ids.has(t.assignee_id));
    const md = mine.filter((t) => t.status === "done").length;
    const mo = mine.filter((t) => isOverdue(t)).length;
    return { role, count: staff.filter((s) => s.role === role).length, tasks: mine.length, done: md, overdue: mo };
  }).filter((r) => r.count > 0 || r.tasks > 0);

  const attention = [...overdue, ...dueToday.filter((t) => !overdue.includes(t))].slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Dashboard</h1>
        <p className="text-muted text-sm mt-0.5">
          Welcome back, {user?.name.split(" ")[0]} · {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kuala_Lumpur" })}
        </p>
      </div>

      <DashboardDateFilter from={from} to={to} field={field} />
      <p className="text-xs text-muted -mt-3">
        📅 {field === "created" ? "Created" : "Deadline"} from <b>{from}</b> to <b>{to}</b> · {tasks.length} task{tasks.length === 1 ? "" : "s"}
      </p>

      {/* stat cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-6">
        <StatCard label="Total Tasks" value={total} color="#2563eb" icon="🗂️" sub={`${internal} internal · ${external} external`} />
        <StatCard label="Completed" value={done} color="#22c55e" icon="✅" sub={`${completion}% completion`} />
        <StatCard label="In Progress" value={inProgress} color="#f97316" icon="⏳" sub="being worked on" />
        <StatCard label="Overdue" value={overdue.length} color="#ef4444" icon="⚠️" sub="past deadline" />
        <StatCard label="Due Today" value={dueToday.length} color="#8b5cf6" icon="📆" sub="finish today" />
        <StatCard label="Routine Tasks" value={routines} color="#0ea5e9" icon="🔁" sub="daily/weekly/monthly" />
      </div>

      {/* completion overview bar */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold">{canSeeTeam ? "Overall Team Completion" : "My Completion"}</h2>
          <span className="font-extrabold text-brand text-lg">{completion}%</span>
        </div>
        <ProgressBar value={completion} />
        <div className="flex gap-4 mt-3 text-xs text-muted flex-wrap">
          <span>✅ {done} done</span>
          <span>⏳ {inProgress} in progress</span>
          <span>📋 {total - done - inProgress} to do</span>
          <span className="text-red-500">⚠️ {overdue.length} overdue</span>
        </div>
      </div>

      <div className={`grid gap-6 ${canSeeTeam ? "lg:grid-cols-3" : "grid-cols-1"}`}>
        {/* team performance — boss (whole company) or leader (their team) */}
        {canSeeTeam && (
        <div className="card p-5 lg:col-span-2">
          <h2 className="font-bold mb-4">👥 {leader ? "My Team" : "Team"} Performance</h2>
          <div className="space-y-3">
            {perStaff.map(({ staff: s, assigned, done, overdue, missed, rate }) => (
              <div key={s.id} className="flex items-center gap-3">
                <Avatar name={s.name} color={s.avatar_color} size={38} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-sm truncate">
                      {s.name} <span className="text-faint font-normal">· {s.role}</span>
                    </div>
                    <span className="text-xs font-bold" style={{ color: rate >= 70 ? "#22c55e" : rate >= 40 ? "#f97316" : "#ef4444" }}>
                      {rate}%
                    </span>
                  </div>
                  <div className="mt-1">
                    <ProgressBar value={rate} overdue={overdue > 0} />
                  </div>
                  <div className="flex gap-3 mt-1 text-[11px] text-faint">
                    <span>{assigned} assigned</span>
                    <span className="text-green-500">{done} done</span>
                    {overdue > 0 && <span className="text-red-500">{overdue} overdue</span>}
                    {missed > 0 && <span className="text-red-400">missed ×{missed}</span>}
                  </div>
                </div>
              </div>
            ))}
            {perStaff.length === 0 && <p className="text-muted text-sm">No staff yet.</p>}
          </div>
        </div>
        )}

        {/* needs attention */}
        <div className="card p-5">
          <h2 className="font-bold mb-4">{canSeeTeam ? "🚨 Needs Attention" : "🚨 My Deadlines"}</h2>
          {attention.length === 0 ? (
            <p className="text-muted text-sm">🎉 Nothing overdue. Great job!</p>
          ) : (
            <div className="space-y-3">
              {attention.map((t) => {
                const a = staff.find((s) => s.id === t.assignee_id);
                const od = isOverdue(t);
                return (
                  <div key={t.id} className="pb-3 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="chip"
                        style={{ color: "#fff", background: od ? "#ef4444" : "#8b5cf6" }}
                      >
                        {od ? (t.carried_days > 0 ? `⏩ CARRIED ${t.carried_days}d` : "⚠ OVERDUE") : "📆 TODAY"}
                      </span>
                      <RecurrenceChip r={t.recurrence} />
                    </div>
                    <div className="font-medium text-sm leading-tight">{t.title}</div>
                    <div className="flex items-center justify-between mt-1 text-[11px] text-faint">
                      <span>{a ? a.name : "Unassigned"}</span>
                      <span className={od ? "text-red-500" : ""}>{dueLabel(t)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* by role — company-wide viewers (admin/overseer) only */}
      {seesAll && (
      <div className="card p-5">
        <h2 className="font-bold mb-4">🏷️ Tasks by Role / Department</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {perRole.map((r) => (
            <div key={r.role} className="surface rounded-xl p-3 border" style={{ borderColor: "var(--border)" }}>
              <RoleChip role={r.role} />
              <div className="mt-2 text-2xl font-extrabold">{r.tasks}</div>
              <div className="text-[11px] text-faint">
                {r.count} staff · {r.done} done
                {r.overdue > 0 && <span className="text-red-500"> · {r.overdue} overdue</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
      )}
    </div>
  );
}
