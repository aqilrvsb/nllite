"use client";

import { useState } from "react";
import { createTask, updateTask } from "@/lib/actions";
import { toast } from "@/lib/swal";
import { type Actor, type SafeStaff, type Task } from "@/lib/types";
import { canAssignOthers } from "@/lib/perms";

export default function TaskModal({
  staff,
  jvStaff,
  task,
  me,
  defaultRecurrence,
  defaultType,
  onClose,
}: {
  staff: SafeStaff[];
  jvStaff?: SafeStaff[];
  task?: Task | null;
  me: Actor;
  defaultRecurrence?: "daily" | "weekly" | "monthly";
  defaultType?: "internal" | "external";
  onClose: () => void;
}) {
  const editing = !!task;
  const [recurrence, setRecurrence] = useState(task?.recurrence ?? defaultRecurrence ?? "daily");
  const showAssignee = canAssignOthers(me);
  // When creating from a specific tab, type + routine are fixed (read-only) by that tab.
  const lockRecur = !editing && !!defaultRecurrence;
  const typeValue = defaultType ?? task?.type ?? "internal";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-lg p-6 my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{editing ? "Edit Task" : "New Task"}</h2>
          <button className="btn btn-ghost !px-2 !py-1" onClick={onClose}>
            ✕
          </button>
        </div>

        <form
          action={async (fd) => {
            if (editing) await updateTask(fd);
            else await createTask(fd);
            onClose();
            toast(editing ? "Task updated" : "Task created");
          }}
          className="space-y-4"
        >
          {editing && <input type="hidden" name="id" value={task!.id} />}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Routine</label>
              {lockRecur ? (
                <>
                  <div className="input flex items-center gap-1 opacity-90" style={{ cursor: "not-allowed" }}>
                    🔁 {recurrence.charAt(0).toUpperCase() + recurrence.slice(1)} <span className="text-faint text-xs">(from tab)</span>
                  </div>
                  <input type="hidden" name="recurrence" value={recurrence} />
                </>
              ) : (
                <select
                  name="recurrence"
                  className="input"
                  value={recurrence}
                  onChange={(e) => setRecurrence(e.target.value as typeof recurrence)}
                >
                  {task?.recurrence === "once" && <option value="once">One-time</option>}
                  <option value="daily">🔁 Daily</option>
                  <option value="weekly">🔁 Weekly</option>
                  <option value="monthly">🔁 Monthly</option>
                </select>
              )}
            </div>
            <div>
              <label className="label">
                {recurrence === "once"
                  ? "Target date"
                  : recurrence === "daily"
                  ? "Deadline (auto)"
                  : "Deadline (set end date)"}
              </label>
              <input
                name="due_date"
                type="date"
                className="input"
                defaultValue={task?.due_date ?? ""}
                disabled={recurrence === "daily"}
              />
            </div>
          </div>
          {recurrence === "daily" && (
            <div>
              <label className="label">Session (Sesi) — daily task</label>
              <select name="session" className="input" defaultValue={task?.session ?? ""}>
                <option value="">— No session —</option>
                <option value="pagi">🌅 Sesi Pagi</option>
                <option value="tengahari">☀️ Sesi Tengahari</option>
                <option value="petang">🌇 Sesi Petang</option>
                <option value="malam">🌙 Sesi Malam</option>
              </select>
            </div>
          )}
          {recurrence !== "once" && (
            <p className="text-xs text-faint -mt-2">
              Routine tasks auto-reset each {recurrence.replace("ly", "")} period and the deadline is
              set automatically. Missed periods are counted.
            </p>
          )}

          <div>
            <label className="label">Task title *</label>
            <input
              name="title"
              className="input"
              required
              defaultValue={task?.title}
              placeholder="e.g. Post 3 TikTok clips"
            />
          </div>

          {/* Description hidden for daily tasks (quick routine) */}
          {recurrence !== "daily" && (
            <div>
              <label className="label">Description</label>
              <textarea
                name="description"
                className="input"
                rows={2}
                defaultValue={task?.description}
                placeholder="Details, target, notes…"
              />
            </div>
          )}

          {/* Task type + Priority are hidden — type comes from the tab, priority defaults to Medium */}
          <input type="hidden" name="type" value={typeValue} />
          <input type="hidden" name="priority" value={task?.priority ?? "medium"} />

          {showAssignee ? (
            <div>
              <label className="label">Assign to (PIC)</label>
              <select name="assignee_id" className="input" defaultValue={task?.assignee_id ?? ""}>
                <option value="">— Unassigned —</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.role}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-xs text-faint surface rounded-lg px-3 py-2 border" style={{ borderColor: "var(--border)" }}>
              👤 This task will be assigned to <b>you</b>.
            </p>
          )}

          {showAssignee && (jvStaff?.length ?? 0) > 0 && (
            <div>
              <label className="label">🤝 JV helpers (optional) — other staff asked to help</label>
              <div className="max-h-36 overflow-y-auto rounded-lg p-2 space-y-1 border" style={{ borderColor: "var(--border)", background: "var(--surface-alt)" }}>
                {jvStaff!.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      name="jv_ids"
                      value={s.id}
                      defaultChecked={task?.jv_ids?.includes(s.id)}
                      className="accent-brand w-4 h-4"
                    />
                    {s.name} <span className="text-faint text-xs">· {s.role}</span>
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-faint mt-1">They&apos;ll see this task in their own “My Tasks” marked as JV.</p>
            </div>
          )}

          {/* Attachments */}
          <div className="pt-2 border-t" style={{ borderColor: "var(--border)" }}>
            <label className="label mt-2">📎 Attachments (staff can view)</label>
            {editing && task!.attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {task!.attachments.map((a) => (
                  <span key={a.id} className="chip" style={{ background: "var(--surface-alt)", color: "var(--text-medium)" }}>
                    {a.kind === "image" ? "🖼️" : a.kind === "pdf" ? "📄" : "🔗"} {a.name.slice(0, 24)}
                  </span>
                ))}
              </div>
            )}
            <input
              name="files"
              type="file"
              multiple
              accept="image/*,application/pdf"
              className="input !py-2 text-sm file:mr-2 file:rounded file:border-0 file:bg-brand file:text-white file:px-2 file:py-1"
            />
            <textarea
              name="links"
              rows={2}
              className="input mt-2"
              placeholder="Paste links (one per line) — e.g. Google Drive, Canva, reference URL"
            />
            <p className="text-[11px] text-faint mt-1">Images & PDFs only (max 8MB each) + links — no video. {editing && "New files/links are added to the existing ones."}</p>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" className="btn btn-ghost flex-1" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary flex-1">
              {editing ? "Save changes" : "Create task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
