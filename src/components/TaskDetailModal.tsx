"use client";

import { useState, useTransition } from "react";
import { addComment } from "@/lib/actions";
import { dueLabel, isOverdue } from "@/lib/tasks";
import type { Actor, SafeStaff, Task } from "@/lib/types";
import { RECURRENCE_LABEL } from "@/lib/types";
import { Avatar, PriorityChip, ProgressBar, RecurrenceChip, StatusChip } from "./ui";

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const s = Math.max(0, Math.round((now - then) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-GB");
}

export default function TaskDetailModal({
  task,
  staff,
  me,
  onClose,
}: {
  task: Task;
  staff: SafeStaff[];
  me: Actor;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const nameOf = (id: string | null) => staff.find((s) => s.id === id)?.name ?? "Someone";
  const colorOf = (id: string | null) => staff.find((s) => s.id === id)?.avatar_color ?? "#64748b";
  const assignee = staff.find((s) => s.id === task.assignee_id);
  const creator = staff.find((s) => s.id === task.created_by);
  const overdue = isOverdue(task);

  const timeline = [...task.comments.map((c) => ({ kind: "comment" as const, ...c })),
    ...task.activity.map((a) => ({ kind: "activity" as const, ...a }))]
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  function submit() {
    const clean = text.trim();
    if (!clean) return;
    start(async () => {
      await addComment(task.id, clean);
      setText("");
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="card w-full max-w-2xl p-0 my-8 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="p-5 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {overdue && <span className="chip" style={{ color: "#fff", background: "#ef4444" }}>⚠ OVERDUE</span>}
              <PriorityChip p={task.priority} />
              <StatusChip s={task.status} />
              <RecurrenceChip r={task.recurrence} />
            </div>
            <button className="btn btn-ghost !px-2 !py-1" onClick={onClose}>✕</button>
          </div>
          <h2 className="text-xl font-bold mt-3">{task.title}</h2>
          {task.description && <p className="text-muted text-sm mt-1 whitespace-pre-wrap">{task.description}</p>}
        </div>

        {/* meta grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 border-b" style={{ borderColor: "var(--border)" }}>
          <Meta label="PIC (assignee)">
            {assignee ? (
              <span className="flex items-center gap-2">
                <Avatar name={assignee.name} color={assignee.avatar_color} size={22} />
                <span className="leading-tight">{assignee.name}<span className="block text-[11px] text-faint">{assignee.role}</span></span>
              </span>
            ) : <span className="text-faint">Unassigned</span>}
          </Meta>
          <Meta label="Deadline">
            <span className={overdue ? "text-red-500 font-semibold" : ""}>{dueLabel(task)}</span>
            {task.due_date && <span className="text-faint block text-[11px]">{task.due_date}</span>}
          </Meta>
          <Meta label="Routine">{RECURRENCE_LABEL[task.recurrence]}{task.missed_count > 0 && <span className="text-red-500"> · missed ×{task.missed_count}</span>}</Meta>
          <Meta label="Created by">{creator?.name ?? "—"}</Meta>
        </div>

        {task.jv_ids.length > 0 && (
          <div className="px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
            <div className="text-[11px] uppercase tracking-wide text-faint font-semibold mb-1.5">🤝 JV Helpers</div>
            <div className="flex flex-wrap gap-2">
              {task.jv_ids.map((id) => (
                <span key={id} className="chip" style={{ background: "#f0fdfa", color: "#0d9488" }}>
                  <Avatar name={nameOf(id)} color={colorOf(id)} size={18} /> {nameOf(id)}
                  <span className="text-faint">· {staff.find((s) => s.id === id)?.role ?? ""}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* progress */}
        <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between text-xs text-muted mb-1">
            <span>Progress</span><span className="font-semibold">{task.progress}%</span>
          </div>
          <ProgressBar value={task.progress} overdue={overdue} />
        </div>

        {/* attachments */}
        {task.attachments.length > 0 && (
          <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
            <h3 className="font-bold text-sm mb-2">📎 Attachments ({task.attachments.length})</h3>
            <div className="flex flex-wrap gap-2">
              {task.attachments.map((a) =>
                a.kind === "image" ? (
                  <a key={a.id} href={a.url} target="_blank" rel="noreferrer" title={a.name}>
                    <img
                      src={a.url}
                      alt={a.name}
                      className="h-20 w-20 object-cover rounded-lg border"
                      style={{ borderColor: "var(--border)" }}
                    />
                  </a>
                ) : (
                  <a
                    key={a.id}
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="chip hover:border-brand"
                    style={{ background: "var(--surface-alt)", color: "var(--text)", border: "1px solid var(--border)" }}
                  >
                    {a.kind === "pdf" ? "📄" : "🔗"} {a.name.slice(0, 30)}
                  </a>
                )
              )}
            </div>
          </div>
        )}

        {/* timeline */}
        <div className="p-5 max-h-72 overflow-y-auto">
          <h3 className="font-bold text-sm mb-3">💬 Comments & Activity</h3>
          {timeline.length === 0 ? (
            <p className="text-faint text-sm">No comments or activity yet.</p>
          ) : (
            <div className="space-y-3">
              {timeline.map((item) =>
                item.kind === "comment" ? (
                  <div key={item.id} className="flex gap-2">
                    <Avatar name={nameOf(item.staff_id)} color={colorOf(item.staff_id)} size={30} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs">
                        <span className="font-semibold">{nameOf(item.staff_id)}</span>
                        <span className="text-faint"> · {timeAgo(item.created_at)}</span>
                      </div>
                      <div className="surface rounded-lg px-3 py-2 mt-1 text-sm border" style={{ borderColor: "var(--border)" }}>
                        {item.text}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div key={item.id} className="flex gap-2 items-center text-xs text-faint pl-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-current inline-block" />
                    <span><b className="text-muted font-semibold">{nameOf(item.staff_id)}</b> {item.action} · {timeAgo(item.created_at)}</span>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* add comment */}
        <div className="p-4 border-t flex gap-2" style={{ borderColor: "var(--border)" }}>
          <input
            className="input flex-1"
            placeholder="Write a comment…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          />
          <button className="btn btn-primary" disabled={pending || !text.trim()} onClick={submit}>
            {pending ? "…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-faint font-semibold mb-0.5">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}
