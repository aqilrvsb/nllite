import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { readDb } from "@/lib/db";
import { DEFAULT_NOTIFY } from "@/lib/types";
import SettingsClient from "@/components/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.is_admin) redirect("/dashboard"); // boss only

  const db = await readDb();
  const settings = db.settings ?? DEFAULT_NOTIFY;
  const bosses = db.staff
    .filter((s) => s.active && s.is_admin)
    .map((s) => ({ name: s.name, whatsapp: s.whatsapp }));
  const stats = {
    staffWithPhone: db.staff.filter((s) => s.active && s.whatsapp).length,
    activeStaff: db.staff.filter((s) => s.active).length,
  };

  return <SettingsClient settings={settings} bosses={bosses} stats={stats} />;
}
