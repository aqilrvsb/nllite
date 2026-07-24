import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { loadData, assignableStaff, isLeader as isLeaderFn } from "@/lib/store";
import TasksClient from "@/components/TasksClient";

export const dynamic = "force-dynamic";

export default async function MyTasksPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { staff, tasks } = await loadData();
  const mine = tasks.filter((t) => t.assignee_id === user.id);
  const activeStaff = staff.filter((s) => s.active);
  const assignable = assignableStaff(staff, user);
  return (
    <TasksClient
      tasks={mine}
      staff={activeStaff}
      assignable={assignable}
      me={{ id: user.id, is_admin: user.is_admin, is_leader: isLeaderFn(user) }}
      title="My Tasks"
      subtitle={`Hi ${user.name.split(" ")[0]} — here's what's assigned to you`}
    />
  );
}
