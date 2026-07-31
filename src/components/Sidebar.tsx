"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logout } from "@/lib/actions";
import { Avatar } from "./ui";
import { Logo } from "./Logo";
import { isTeamLead, seesAllCompany } from "@/lib/types";
import type { SafeStaff } from "@/lib/types";

export interface Alert {
  id: string;
  title: string;
  overdue: boolean;
}

export default function Sidebar({ user, alerts }: { user: SafeStaff; alerts: Alert[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const overdueCount = alerts.filter((a) => a.overdue).length;

  const isBoss = user.role === "CEO / Boss";
  const isLeaderUser = isTeamLead(user);
  const seesAll = seesAllCompany(user); // admin or company-viewer (overseer)
  const canMonitorTeam = seesAll || isLeaderUser; // sees tasks/reports + notifications

  const items = [
    { href: "/dashboard", label: "Dashboard", icon: "📊", show: true },
    { href: "/my-tasks", label: "My Tasks", icon: "✅", show: !isBoss },
    { href: "/tasks", label: isLeaderUser && !seesAll ? "Team Tasks" : "All Tasks", icon: "🗂️", show: canMonitorTeam },
    { href: "/reports", label: "Reports", icon: "📈", show: canMonitorTeam },
    // Staff management is for admins + team leads only — a company-viewer (overseer) can't manage staff
    { href: "/staff", label: isLeaderUser ? "My Team" : "Staff", icon: "👥", show: user.is_admin || isLeaderUser },
    { href: "/settings", label: "Notifications", icon: "🔔", show: user.is_admin },
    { href: "/profile", label: "My Profile", icon: "⚙️", show: true },
  ].filter((n) => n.show);

  return (
    <>
      {/* mobile top bar */}
      <div className="md:hidden flex items-center justify-between p-4 surface border-b sticky top-0 z-30">
        <div className="flex items-center gap-2 font-extrabold">
          <Logo size={32} />
          NLLITE
        </div>
        <button className="btn btn-ghost" onClick={() => setOpen((o) => !o)}>
          ☰
        </button>
      </div>

      <aside
        className={`${
          open ? "block" : "hidden"
        } md:block fixed md:sticky top-0 z-40 h-screen w-64 shrink-0 surface border-r p-4 flex flex-col`}
      >
        <div className="flex items-center gap-2 px-2 py-3 mb-2">
          <Logo size={38} />
          <div className="leading-tight font-extrabold text-lg flex-1">
            NLLITE
            <div className="text-[11px] font-medium text-faint">NL Legacy</div>
          </div>
          {canMonitorTeam && (
            <button
              onClick={() => setShowAlerts((s) => !s)}
              className="relative h-9 w-9 rounded-lg grid place-items-center hover:bg-[var(--surface-alt)]"
              title="Notifications"
            >
              🔔
              {alerts.length > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white grid place-items-center"
                  style={{ background: overdueCount > 0 ? "#ef4444" : "#f97316" }}
                >
                  {alerts.length}
                </span>
              )}
            </button>
          )}
        </div>

        {showAlerts && (
          <div className="card p-3 mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-sm">🔔 My Alerts</span>
              <button className="text-faint text-xs" onClick={() => setShowAlerts(false)}>✕</button>
            </div>
            {alerts.length === 0 ? (
              <p className="text-xs text-faint">🎉 Nothing due. You're clear!</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {alerts.map((a) => (
                  <Link
                    key={a.id}
                    href="/my-tasks"
                    onClick={() => { setShowAlerts(false); setOpen(false); }}
                    className="block surface rounded-lg px-2.5 py-2 border hover:border-brand"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <span
                      className="chip mb-1"
                      style={{ color: "#fff", background: a.overdue ? "#ef4444" : "#f97316" }}
                    >
                      {a.overdue ? "⚠ OVERDUE" : "📆 Due today"}
                    </span>
                    <div className="text-xs font-medium leading-tight">{a.title}</div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        <nav className="flex-1 space-y-1">
          {items.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition ${
                  active
                    ? "bg-brand text-white shadow-brand"
                    : "hover:bg-[var(--surface-alt)] text-[var(--text-medium)]"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="pt-3 border-t space-y-2" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3 px-1 py-1">
            <Avatar name={user.name} color={user.avatar_color} />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm truncate">{user.name}</div>
              <div className="text-[11px] text-faint truncate">{user.role}</div>
            </div>
          </div>
          <form action={logout}>
            <button type="submit" className="btn btn-ghost w-full text-red-500">
              ⏻ Log out
            </button>
          </form>
        </div>
      </aside>
      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/30 z-30"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
