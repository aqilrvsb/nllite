import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { loadData, scopeTasks, isLeader as isLeaderFn } from "@/lib/store";
import { isOverdue } from "@/lib/tasks";
import { RECURRENCE_LABEL, STATUS_LABEL, ROLES } from "@/lib/types";
import { RoleChip } from "@/components/ui";
import ReportsClient from "@/components/ReportsClient";
import DeptFilter from "@/components/DeptFilter";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { dept?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const leader = isLeaderFn(user);
  if (!user.is_admin && !leader) redirect("/dashboard");

  const { staff, tasks: allTasks } = await loadData();
  // Boss → all; Leader → their team only.
  const scopedTasks = scopeTasks(allTasks, staff, user);
  const scopedStaff = leader
    ? staff.filter((s) => s.active && (s.leader_id === user.id || s.id === user.id))
    : staff.filter((s) => s.active);

  // Department filter (?dept=)
  const dept = ROLES.includes(searchParams.dept as never) ? (searchParams.dept as string) : "all";
  const presentDepts = ROLES.filter((r) => scopedStaff.some((s) => s.role === r));
  const reportStaff = dept === "all" ? scopedStaff : scopedStaff.filter((s) => s.role === dept);
  const staffIds = new Set(reportStaff.map((s) => s.id));
  const tasks = dept === "all" ? scopedTasks : scopedTasks.filter((t) => t.assignee_id && staffIds.has(t.assignee_id));

  const nameOf = (id: string | null) => staff.find((s) => s.id === id)?.name ?? "Unassigned";

  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  const overdue = tasks.filter((t) => isOverdue(t)).length;
  const completion = total ? Math.round((done / total) * 100) : 0;

  const perStaff = reportStaff
    .map((s) => {
      const mine = tasks.filter((t) => t.assignee_id === s.id);
      const d = mine.filter((t) => t.status === "done").length;
      const od = mine.filter((t) => isOverdue(t)).length;
      const missed = mine.reduce((a, t) => a + (t.missed_count || 0), 0);
      return { s, assigned: mine.length, done: d, overdue: od, missed, rate: mine.length ? Math.round((d / mine.length) * 100) : 0 };
    })
    .sort((a, b) => b.assigned - a.assigned);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold">Reports</h1>
          <p className="text-muted text-sm mt-0.5">
            NLLITE · NL Legacy · generated {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kuala_Lumpur" })} (Malaysia time)
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DeptFilter value={dept} present={presentDepts} />
          <ReportsClient tasks={tasks} staff={reportStaff} />
        </div>
      </div>
      {dept !== "all" && (
        <p className="text-xs text-muted -mt-3">Filtered to department: <b>{dept}</b> · {tasks.length} task{tasks.length === 1 ? "" : "s"}, {reportStaff.length} staff</p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Summary label="Total Tasks" value={total} />
        <Summary label="Completed" value={`${done} (${completion}%)`} color="#22c55e" />
        <Summary label="Overdue" value={overdue} color="#ef4444" />
        <Summary label={leader ? "My Team" : "Team Members"} value={reportStaff.length} />
      </div>

      <div className="card p-5">
        <h2 className="font-bold mb-4">👥 Staff Performance</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-faint" style={{ background: "var(--surface-alt)" }}>
                <th className="px-3 py-2">Name</th><th className="px-3 py-2">Role</th>
                <th className="px-3 py-2 text-center">Assigned</th><th className="px-3 py-2 text-center">Done</th>
                <th className="px-3 py-2 text-center">Overdue</th><th className="px-3 py-2 text-center">Missed</th>
                <th className="px-3 py-2 text-center">Completion</th>
              </tr>
            </thead>
            <tbody>
              {perStaff.map(({ s, assigned, done, overdue, missed, rate }) => (
                <tr key={s.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-3 py-2 font-semibold">{s.name}</td>
                  <td className="px-3 py-2"><RoleChip role={s.role} /></td>
                  <td className="px-3 py-2 text-center">{assigned}</td>
                  <td className="px-3 py-2 text-center text-green-600">{done}</td>
                  <td className="px-3 py-2 text-center" style={{ color: overdue ? "#ef4444" : undefined }}>{overdue || "—"}</td>
                  <td className="px-3 py-2 text-center">{missed || "—"}</td>
                  <td className="px-3 py-2 text-center font-bold" style={{ color: rate >= 70 ? "#22c55e" : rate >= 40 ? "#f97316" : "#ef4444" }}>{rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-bold mb-4">🗂️ All Tasks ({tasks.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-faint" style={{ background: "var(--surface-alt)" }}>
                <th className="px-3 py-2">Task</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">PIC</th>
                <th className="px-3 py-2">Status</th><th className="px-3 py-2">Routine</th>
                <th className="px-3 py-2">Deadline</th><th className="px-3 py-2 text-center">Progress</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-3 py-2 font-medium">
                    {isOverdue(t) && <span className="text-red-500">⚠ </span>}{t.title}
                  </td>
                  <td className="px-3 py-2 capitalize">{t.type}</td>
                  <td className="px-3 py-2">
                    {nameOf(t.assignee_id)}
                    {t.jv_ids.length > 0 && (
                      <span className="block text-[11px]" style={{ color: "#0d9488" }}>🤝 JV: {t.jv_ids.map((id) => nameOf(id)).join(", ")}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{STATUS_LABEL[t.status]}</td>
                  <td className="px-3 py-2">{RECURRENCE_LABEL[t.recurrence]}</td>
                  <td className="px-3 py-2" style={{ color: isOverdue(t) ? "#ef4444" : undefined }}>{t.due_date ?? "—"}</td>
                  <td className="px-3 py-2 text-center">{t.progress}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Summary({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-semibold text-muted uppercase">{label}</div>
      <div className="text-2xl font-extrabold mt-1" style={{ color }}>{value}</div>
    </div>
  );
}
