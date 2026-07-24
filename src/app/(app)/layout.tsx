import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { loadData } from "@/lib/store";
import { isOverdue, isDueToday } from "@/lib/tasks";
import Sidebar, { type Alert } from "@/components/Sidebar";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { tasks } = await loadData();
  const alerts: Alert[] = tasks
    .filter((t) => t.assignee_id === user.id && t.status !== "done" && (isOverdue(t) || isDueToday(t)))
    .map((t) => ({ id: t.id, title: t.title, overdue: isOverdue(t) }))
    .sort((a, b) => Number(b.overdue) - Number(a.overdue));

  return (
    <div className="md:flex min-h-screen">
      <Sidebar user={user} alerts={alerts} />
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
