"use client";

import { useState, useTransition } from "react";
import { deleteTask, setTaskProgress, setTaskStatus } from "@/lib/actions";
import { confirmAction, toast } from "@/lib/swal";
import { dueLabel, isOverdue, progressOf } from "@/lib/tasks";
import { canDeleteTask, canEditTask, canProgressTask } from "@/lib/perms";
import type { Actor, Brand, SafeStaff, Task } from "@/lib/types";
import {
  Avatar,
  BrandChip,
  PriorityChip,
  ProgressBar,
  RecurrenceChip,
  SessionChip,
  StatusChip,
} from "./ui";

export default function TaskCard({
  task,
  staff,
  brands = [],
  me,
  onEdit,
  onOpen,
}: {
  task: Task;
  staff: SafeStaff[];
  brands?: Brand[];
  me: Actor;
  onEdit: (t: Task) => void;
  onOpen: (t: Task) => void;
}) {
  const [pending, start] = useTransition();
  const [localProg, setLocalProg] = useState(progressOf(task));
  const assignee = staff.find((s) => s.id === task.assignee_id);
  const brand = brands.find((b) => b.id === task.brand_id);
  const overdue = isOverdue(task);
  const done = task.status === "done";

  const mayEdit = canEditTask(me, task);
  const mayDelete = canDeleteTask(me, task);
  const mayProgress = canProgressTask(me, task);

  return (
    <div
      className={`card p-4 flex flex-col ${overdue ? "!border-red-300" : ""}`}
      style={overdue ? { boxShadow: "0 0 0 1px #fca5a5" } : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {overdue && (
              <span className="chip" style={{ color: "#fff", background: "#ef4444" }}>
                {task.carried_days > 0 ? `⏩ CARRIED ${task.carried_days}d` : "⚠ OVERDUE"}
              </span>
            )}
            <RecurrenceChip r={task.recurrence} />
            <SessionChip s={task.session} />
            {brand && <BrandChip name={brand.name} />}
            {task.jv_ids.length > 0 && (
              <span className="chip" style={{ color: "#0d9488", background: "#f0fdfa" }}>
                🤝 {task.jv_ids.includes(me.id) ? "JV (you)" : `JV ${task.jv_ids.length}`}
              </span>
            )}
          </div>
          <button
            onClick={() => onOpen(task)}
            className={`text-left font-semibold leading-tight hover:text-brand transition ${
              done ? "line-through text-faint" : ""
            }`}
          >
            {task.title}
          </button>
          {task.description && (
            <p className="text-sm text-muted mt-1 line-clamp-2">{task.description}</p>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          {mayEdit && (
            <button className="btn btn-ghost !px-2 !py-1" title="Edit" onClick={() => onEdit(task)}>
              ✏️
            </button>
          )}
          {mayDelete && (
            <button
              className="btn btn-danger !px-2 !py-1"
              title="Delete"
              disabled={pending}
              onClick={async () => {
                const ok = await confirmAction({ title: "Delete this task?", text: task.title, danger: true, confirmText: "Delete" });
                if (ok) start(async () => { await deleteTask(task.id); toast("Task deleted"); });
              }}
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap mt-3">
        <PriorityChip p={task.priority} />
        <StatusChip s={task.status} />
        <span
          className="chip"
          style={{
            color: overdue ? "#dc2626" : "var(--text-medium)",
            background: "var(--surface-alt)",
          }}
        >
          ⏰ {dueLabel(task)}
        </span>
        {task.missed_count > 0 && (
          <span className="chip" style={{ color: "#b91c1c", background: "#fef2f2" }}>
            missed ×{task.missed_count}
          </span>
        )}
        <button
          className="chip hover:opacity-80"
          style={{ color: "var(--text-medium)", background: "var(--surface-alt)" }}
          onClick={() => onOpen(task)}
          title="Open details & comments"
        >
          💬 {task.comments.length}
        </button>
        {task.attachments.length > 0 && (
          <button className="chip hover:opacity-80" style={{ color: "#0891b2", background: "#ecfeff" }} onClick={() => onOpen(task)}>
            📎 {task.attachments.length}
          </button>
        )}
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-muted mb-1">
          <span>Progress</span>
          <span className="font-semibold">{localProg}%</span>
        </div>
        <ProgressBar value={localProg} overdue={overdue} />
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={localProg}
          disabled={pending || !mayProgress}
          onChange={(e) => setLocalProg(Number(e.target.value))}
          onPointerUp={() => mayProgress && start(() => setTaskProgress(task.id, localProg))}
          onKeyUp={() => mayProgress && start(() => setTaskProgress(task.id, localProg))}
          className="w-full mt-2 accent-brand cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        />
        {!mayProgress && (
          <p className="text-[11px] text-faint mt-1">Only the assignee or an admin can update this.</p>
        )}
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2 min-w-0">
          {assignee ? (
            <>
              <Avatar name={assignee.name} color={assignee.avatar_color} size={28} />
              <div className="min-w-0 leading-tight">
                <div className="text-xs font-semibold truncate">{assignee.name}</div>
                <div className="text-[11px] text-faint truncate">{assignee.role}</div>
              </div>
            </>
          ) : (
            <span className="text-xs text-faint">Unassigned</span>
          )}
        </div>
        {mayProgress && (
          <div className="flex gap-1">
            {!done ? (
              <button
                className="btn btn-primary !py-1.5 !px-3 text-xs"
                disabled={pending}
                onClick={() => {
                  setLocalProg(100);
                  start(() => setTaskStatus(task.id, "done"));
                }}
              >
                ✓ Done
              </button>
            ) : (
              <button
                className="btn btn-ghost !py-1.5 !px-3 text-xs"
                disabled={pending}
                onClick={() => {
                  setLocalProg(0);
                  start(() => setTaskStatus(task.id, "todo"));
                }}
              >
                ↺ Reopen
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
