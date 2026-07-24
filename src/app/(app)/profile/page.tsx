import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import ProfileForm from "@/components/ProfileForm";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-1">My Profile</h1>
      <p className="text-muted text-sm mb-6">Manage your name and password</p>
      <ProfileForm user={user} />
    </div>
  );
}
