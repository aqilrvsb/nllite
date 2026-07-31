"use client";

import { useFormState, useFormStatus } from "react-dom";
import { updateOwnProfile } from "@/lib/actions";
import type { SafeStaff } from "@/lib/types";
import { Avatar, RoleChip } from "./ui";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}

export default function ProfileForm({ user }: { user: SafeStaff }) {
  const [state, action] = useFormState(updateOwnProfile, {});
  return (
    <div className="max-w-lg space-y-6">
      <div className="card p-5 flex items-center gap-4">
        <Avatar name={user.name} color={user.avatar_color} size={56} />
        <div>
          <div className="font-bold text-lg">{user.name}</div>
          <div className="text-muted text-sm mb-1">🆔 {user.staff_id}</div>
          <RoleChip role={user.role} />
          {user.is_admin && (
            <span className="chip ml-1" style={{ color: "#7c3aed", background: "#f5f3ff" }}>Admin</span>
          )}
        </div>
      </div>

      <form action={action} className="card p-5 space-y-4">
        <h2 className="font-bold">Edit profile</h2>
        <div>
          <label className="label">Display name</label>
          <input name="name" className="input" defaultValue={user.name} />
        </div>
        <div>
          <label className="label">📱 WhatsApp number</label>
          <input
            name="whatsapp"
            type="tel"
            inputMode="tel"
            className="input"
            defaultValue={user.whatsapp ?? ""}
            placeholder="60123456789 (Malaysia)"
          />
          <p className="text-[11px] text-faint mt-1">Used for To Do reminders & summaries. Start with 60 — symbols are removed automatically.</p>
        </div>

        <div className="pt-2 border-t" style={{ borderColor: "var(--border)" }}>
          <p className="text-sm font-semibold mt-2 mb-3">Change password</p>
          <div className="space-y-3">
            <div>
              <label className="label">Current password</label>
              <input name="current_password" type="password" className="input" placeholder="Required only to change password" autoComplete="current-password" />
            </div>
            <div>
              <label className="label">New password</label>
              <input name="new_password" type="password" className="input" placeholder="Leave blank to keep current" autoComplete="new-password" />
            </div>
          </div>
        </div>

        {state?.error && <p className="text-sm text-red-500 font-medium">{state.error}</p>}
        {state?.ok && <p className="text-sm text-green-600 font-medium">✓ {state.ok}</p>}
        <SaveButton />
      </form>

      <p className="text-xs text-faint">
        Your role and admin access are managed by an administrator. To change them, ask your admin.
      </p>
    </div>
  );
}
