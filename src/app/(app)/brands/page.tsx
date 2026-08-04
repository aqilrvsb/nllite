import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { loadData } from "@/lib/store";
import { isTeamLead } from "@/lib/types";
import BrandsClient from "@/components/BrandsClient";

export const dynamic = "force-dynamic";

export default async function BrandsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.is_admin && !isTeamLead(user)) redirect("/dashboard"); // boss or leader only

  const { brands, tasks } = await loadData();
  // how many tasks reference each brand (shown next to each row)
  const counts: Record<string, number> = {};
  for (const t of tasks) if (t.brand_id) counts[t.brand_id] = (counts[t.brand_id] || 0) + 1;

  const sorted = [...brands].sort((a, b) => a.name.localeCompare(b.name));
  return <BrandsClient brands={sorted} counts={counts} />;
}
