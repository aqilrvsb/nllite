import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { loadData, scopeTasks, assignableStaff, isLeader as isLeaderFn } from "@/lib/store";
import TasksClient from "@/components/TasksClient";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const leader = isLeaderFn(user);
  if (!user.is_admin && !leader) redirect("/my-tasks"); // pure staff → their own tasks
  const { staff, tasks } = await loadData();
  const scoped = scopeTasks(tasks, staff, user);
  const activeStaff = staff.filter((s) => s.active);
  const assignable = assignableStaff(staff, user);
  return (
    <TasksClient
      tasks={scoped}
      staff={activeStaff}
      assignable={assignable}
      me={{ id: user.id, is_admin: user.is_admin, is_leader: leader }}
      title={leader ? "Team Tasks" : "All Tasks"}
      subtitle={leader ? `${scoped.length} tasks in your team` : `${scoped.length} tasks across the whole team`}
    />
  );
}
