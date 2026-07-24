import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { loadData, isLeader as isLeaderFn } from "@/lib/store";
import StaffClient from "@/components/StaffClient";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const leader = isLeaderFn(user);
  if (!user.is_admin && !leader) redirect("/dashboard");

  const { staff } = await loadData();

  if (leader) {
    // Leader manages (add/edit/delete) only their own team — no admin powers.
    const team = staff
      .filter((s) => s.leader_id === user.id)
      .sort((a, b) => a.name.localeCompare(b.name));
    return (
      <StaffClient
        staff={team}
        currentUserId={user.id}
        manage={true}
        adminManager={false}
        title="My Team"
        subtitle={`${team.length} staff report to you`}
      />
    );
  }

  const sorted = [...staff].sort((a, b) => a.name.localeCompare(b.name));
  return <StaffClient staff={sorted} currentUserId={user.id} />;
}
