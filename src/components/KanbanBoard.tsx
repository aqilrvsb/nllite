"use client";

import { useState, useTransition } from "react";
import { setTaskStatus, addComment, deleteTask } from "@/lib/actions";
import { dueLabel, isOverdue, progressOf } from "@/lib/tasks";
import { canComment, canDeleteTask, canEditTask, canProgressTask } from "@/lib/perms";
import { confirmAction, toast } from "@/lib/swal";
import type { Actor, SafeStaff, Status, Task } from "@/lib/types";
import { Avatar, PriorityChip, ProgressBar, RecurrenceChip, SessionChip } from "./ui";

const COLUMNS: { key: Status; label: string; color: string }[] = [
  { key: "todo", label: "To Do List", color: "#64748b" },
  { key: "priority", label: "Priority Task", color: "#ef4444" },
  { key: "in_progress", label: "In Progress", color: "#2563eb" },
  { key: "done", label: "Completed", color: "#22c55e" },
  { key: "on_hold", label: "On Hold", color: "#a855f7" },
];

export default function KanbanBoard({
  tasks,
  staff,
  me,
  onOpen,
  onEdit,
}: {
  tasks: Task[];
  staff: SafeStaff[];
  me: Actor;
  onOpen: (t: Task) => void;
  onEdit: (t: Task) => void;
}) {
  const [, start] = useTransition();
  const [dragOver, setDragOver] = useState<Status | null>(null);

  function drop(status: Status) {
    return (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(null);
      const id = e.dataTransfer.getData("text/plain");
      const task = tasks.find((t) => t.id === id);
      if (!task || task.status === status) return;
      if (!canProgressTask(me, task)) return;
      start(() => setTaskStatus(id, status));
    };
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-3 -mx-1 px-1">
      {COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.key);
        const over = dragOver === col.key;
        return (
          <div
            key={col.key}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(col.key);
            }}
            onDragLeave={() => setDragOver((s) => (s === col.key ? null : s))}
            onDrop={drop(col.key)}
            className={`flex-1 min-w-[240px] rounded-2xl p-3 transition ${over ? "ring-2 ring-brand" : ""}`}
            style={{ background: "var(--surface-alt)", minHeight: 200 }}
          >
            <div className="flex items-center gap-2 px-1 pb-3">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: col.color }} />
              <span className="font-bold text-sm">{col.label}</span>
              <span
                className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: col.color + "22", color: col.color }}
              >
                {colTasks.length}
              </span>
            </div>

            <div className="space-y-3">
              {colTasks.map((t) => (
                <BoardCard key={t.id} task={t} staff={staff} me={me} onOpen={onOpen} onEdit={onEdit} />
              ))}
              {colTasks.length === 0 && (
                <p className="text-xs text-faint text-center py-6">Drop tasks here</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BoardCard({
  task,
  staff,
  me,
  onOpen,
  onEdit,
}: {
  task: Task;
  staff: SafeStaff[];
  me: Actor;
  onOpen: (t: Task) => void;
  onEdit: (t: Task) => void;
}) {
  const assignee = staff.find((s) => s.id === task.assignee_id);
  const overdue = isOverdue(task);
  const canDrag = canProgressTask(me, task);
  const done = task.status === "done";
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const nameOf = (id: string) => staff.find((s) => s.id === id)?.name ?? "Someone";

  function addProgress() {
    const text = note.trim();
    if (!text) return;
    start(async () => {
      await addComment(task.id, text);
      setNote("");
    });
  }

  return (
    <div
      draggable={canDrag}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", task.id)}
      className={`card p-3 ${canDrag ? "cursor-grab active:cursor-grabbing" : ""}`}
      style={overdue ? { boxShadow: "0 0 0 1px #fca5a5" } : undefined}
    >
      <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
        {overdue && <span className="chip" style={{ color: "#fff", background: "#ef4444" }}>{task.carried_days > 0 ? `⏩ CARRIED ${task.carried_days}d` : "⚠ OVERDUE"}</span>}
        <RecurrenceChip r={task.recurrence} />
        <SessionChip s={task.session} />
        {task.jv_ids.length > 0 && (
          <span className="chip" style={{ color: "#0d9488", background: "#f0fdfa" }}>🤝 {task.jv_ids.includes(me.id) ? "JV (you)" : `JV ${task.jv_ids.length}`}</span>
        )}
        {task.attachments.length > 0 && (
          <span className="chip" style={{ color: "#0891b2", background: "#ecfeff" }}>📎 {task.attachments.length}</span>
        )}
      </div>

      <button
        onClick={() => onOpen(task)}
        className={`text-left font-semibold text-sm leading-tight hover:text-brand ${done ? "line-through text-faint" : ""}`}
      >
        {task.title}
      </button>

      <div className="flex items-center gap-1.5 flex-wrap mt-2">
        <PriorityChip p={task.priority} />
        <span className="chip" style={{ color: overdue ? "#dc2626" : "var(--text-medium)", background: "var(--surface-alt)" }}>
          ⏰ {dueLabel(task)}
        </span>
      </div>

      <div className="mt-2">
        <ProgressBar value={progressOf(task)} overdue={overdue} />
      </div>

      {/* Comments / progress notes — anyone who can see the card (boss, leader, PIC, JV) can comment & read */}
      {(task.comments.length > 0 || canComment(me)) && (
        <div className="mt-2.5 pt-2.5 border-t" style={{ borderColor: "var(--border)" }}>
          <div className="text-[11px] font-bold text-muted mb-1.5">💬 Comments</div>
          {task.comments.length > 0 && (
            <div className="space-y-1 mb-1.5">
              {task.comments.map((c) => (
                <div key={c.id} className="text-[11px] text-muted leading-snug">
                  <span className="font-semibold" style={{ color: "var(--text)" }}>{nameOf(c.staff_id)}:</span> {c.text}
                </div>
              ))}
            </div>
          )}
          {canComment(me) && (
            <div className="flex gap-1">
              <input
                className="input !py-1 !text-xs"
                placeholder="Write a comment…"
                value={note}
                disabled={pending}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addProgress(); } }}
              />
              <button className="btn btn-primary !px-2 !py-1 text-xs" disabled={pending || !note.trim()} onClick={addProgress}>
                ＋
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mt-2.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {assignee ? (
            <>
              <Avatar name={assignee.name} color={assignee.avatar_color} size={24} />
              <div className="min-w-0 leading-tight">
                <div className="text-[11px] font-semibold truncate">{assignee.name}</div>
                <div className="text-[10px] text-faint truncate">{assignee.role}</div>
              </div>
            </>
          ) : (
            <span className="text-[11px] text-faint">Unassigned</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button className="text-xs chip" style={{ background: "var(--surface-alt)" }} onClick={() => onOpen(task)}>
            💬 {task.comments.length}
          </button>
          {canEditTask(me, task) && (
            <button className="btn btn-ghost !px-1.5 !py-0.5 text-xs" title="Edit" onClick={() => onEdit(task)}>✏️</button>
          )}
          {canDeleteTask(me, task) && (
            <button
              className="btn btn-danger !px-1.5 !py-0.5 text-xs"
              title="Delete"
              disabled={pending}
              onClick={async () => {
                const ok = await confirmAction({ title: "Delete this task?", text: task.title, danger: true, confirmText: "Delete" });
                if (ok) start(async () => { await deleteTask(task.id); toast("Task deleted"); });
              }}
            >🗑️</button>
          )}
        </div>
      </div>
    </div>
  );
}
