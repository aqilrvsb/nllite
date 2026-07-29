"use client";

import { useState, useTransition } from "react";
import { createStaff, updateStaff, deleteStaff } from "@/lib/actions";
import { ROLES, isTeamLead, type SafeStaff } from "@/lib/types";
import { Avatar, RoleChip } from "./ui";
import { confirmAction, toast } from "@/lib/swal";

function StaffModal({
  staff,
  leaders,
  adminManager,
  onClose,
}: {
  staff?: SafeStaff | null;
  leaders: SafeStaff[];
  adminManager: boolean;
  onClose: () => void;
}) {
  const editing = !!staff;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="card w-full max-w-md p-6 my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{editing ? "Edit Staff" : "Add Staff"}</h2>
          <button className="btn btn-ghost !px-2 !py-1" onClick={onClose}>✕</button>
        </div>
        <form
          action={async (fd) => {
            if (editing) await updateStaff(fd);
            else await createStaff(fd);
            onClose();
            toast(editing ? "Staff updated" : "Staff added");
          }}
          className="space-y-4"
        >
          {editing && <input type="hidden" name="id" value={staff!.id} />}
          <div>
            <label className="label">Full name *</label>
            <input name="name" className="input" required defaultValue={staff?.name} placeholder="e.g. Aiman" />
          </div>
          {editing ? (
            <div>
              <label className="label">Staff ID</label>
              <input className="input" value={staff?.staff_id} disabled readOnly />
            </div>
          ) : (
            <p className="text-xs text-faint surface rounded-lg px-3 py-2 border" style={{ borderColor: "var(--border)" }}>
              🆔 A Staff ID (e.g. <b>NL-011</b>) will be generated automatically.
            </p>
          )}
          <div>
            <label className="label">Role</label>
            <select name="role" className="input" defaultValue={staff?.role ?? "Marketer (PIC)"}>
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          {adminManager ? (
            <div>
              <label className="label">Reports to (Leader / Team)</label>
              <select name="leader_id" className="input" defaultValue={staff?.leader_id ?? ""}>
                <option value="">— None (reports to Boss) —</option>
                {leaders
                  .filter((l) => l.id !== staff?.id)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} · {l.staff_id}
                    </option>
                  ))}
              </select>
            </div>
          ) : (
            <p className="text-xs text-faint surface rounded-lg px-3 py-2 border" style={{ borderColor: "var(--border)" }}>
              👥 This staff will be added to <b>your team</b>.
            </p>
          )}
          <div>
            <label className="label">{editing ? "New password (leave blank to keep)" : "Password (blank = same as Staff ID)"}</label>
            <input name="password" type="text" className="input" placeholder={editing ? "•••••• (unchanged)" : "default: their Staff ID (e.g. NL-011)"} />
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            {adminManager && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="is_admin" defaultChecked={staff?.is_admin} className="accent-brand w-4 h-4" />
                Admin access
              </label>
            )}
            {adminManager && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="is_manager" defaultChecked={staff?.is_manager} className="accent-brand w-4 h-4" />
                Team leader
              </label>
            )}
            {adminManager && (
              <label className="flex items-center gap-2 text-sm" title="Sees everyone's tasks/reports but can't manage staff">
                <input type="checkbox" name="is_overseer" defaultChecked={staff?.is_overseer} className="accent-brand w-4 h-4" />
                Company viewer
              </label>
            )}
            {editing && (
              <div className="flex items-center gap-2 text-sm">
                <span>Status</span>
                <select name="active" className="input !w-auto !py-1" defaultValue={staff?.active === false ? "off" : "on"}>
                  <option value="on">Active</option>
                  <option value="off">Inactive</option>
                </select>
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" className="btn btn-ghost flex-1" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary flex-1">{editing ? "Save" : "Add staff"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function StaffClient({
  staff,
  currentUserId,
  manage = true,
  adminManager = true,
  title = "Staff",
  subtitle,
}: {
  staff: SafeStaff[];
  currentUserId: string;
  manage?: boolean;
  adminManager?: boolean;
  title?: string;
  subtitle?: string;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SafeStaff | null>(null);
  const [pending, start] = useTransition();
  const leaders = staff.filter((s) => isTeamLead(s)); // Leaders, Directors, or flagged team-leads
  const leaderName = (id: string | null) => (id ? staff.find((s) => s.id === id)?.name ?? "—" : "—");

  return (
    <div>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-5">
        <div>
          <h1 className="text-2xl font-extrabold">{title}</h1>
          <p className="text-muted text-sm mt-0.5">{subtitle ?? `${staff.length} team members across all departments`}</p>
        </div>
        {manage && (
          <button className="btn btn-primary" onClick={() => { setEditing(null); setOpen(true); }}>
            ＋ Add Staff
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-faint" style={{ background: "var(--surface-alt)" }}>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Staff ID</th>
                <th className="px-4 py-3 font-semibold">Reports to</th>
                <th className="px-4 py-3 font-semibold">Access</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                {manage && <th className="px-4 py-3 font-semibold text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={s.name} color={s.avatar_color} size={34} />
                      <span className="font-semibold">
                        {s.name}
                        {s.id === currentUserId && <span className="text-faint font-normal"> (you)</span>}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><RoleChip role={s.role} /></td>
                  <td className="px-4 py-3"><span className="chip" style={{ color: "#2563eb", background: "#eff6ff" }}>🆔 {s.staff_id}</span></td>
                  <td className="px-4 py-3 text-muted">{leaderName(s.leader_id)}</td>
                  <td className="px-4 py-3">
                    {s.is_admin ? (
                      <span className="chip" style={{ color: "#7c3aed", background: "#f5f3ff" }}>Admin</span>
                    ) : s.is_overseer ? (
                      <span className="chip" style={{ color: "#0d9488", background: "#f0fdfa" }}>👁 Viewer</span>
                    ) : isTeamLead(s) ? (
                      <span className="chip" style={{ color: "#2563eb", background: "#eff6ff" }}>Team Lead</span>
                    ) : (
                      <span className="chip" style={{ color: "#64748b", background: "var(--surface-alt)" }}>Staff</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {s.active ? (
                      <span className="chip" style={{ color: "#16a34a", background: "#f0fdf4" }}>● Active</span>
                    ) : (
                      <span className="chip" style={{ color: "#94a3b8", background: "var(--surface-alt)" }}>○ Inactive</span>
                    )}
                  </td>
                  {manage && (
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <button className="btn btn-ghost !px-2 !py-1" onClick={() => { setEditing(s); setOpen(true); }}>✏️</button>
                        {s.id !== currentUserId && (
                          <button
                            className="btn btn-danger !px-2 !py-1"
                            disabled={pending}
                            onClick={async () => {
                              const ok = await confirmAction({ title: `Remove ${s.name}?`, text: `Staff ID ${s.staff_id}`, danger: true, confirmText: "Remove" });
                              if (ok) start(async () => { await deleteStaff(s.id); toast("Staff removed"); });
                            }}
                          >🗑️</button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {open && manage && <StaffModal staff={editing} leaders={leaders} adminManager={adminManager} onClose={() => setOpen(false)} />}
    </div>
  );
}
