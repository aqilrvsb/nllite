"use client";

import type { SafeStaff, Task } from "@/lib/types";
import { RECURRENCE_LABEL, STATUS_LABEL } from "@/lib/types";
import { isOverdue, klToday } from "@/lib/tasks";

function download(filename: string, rows: string[][]) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsClient({ tasks, staff }: { tasks: Task[]; staff: SafeStaff[] }) {
  const nameOf = (id: string | null) => staff.find((s) => s.id === id)?.name ?? "Unassigned";
  const roleOf = (id: string | null) => staff.find((s) => s.id === id)?.role ?? "";

  function exportTasks() {
    const header = [
      "Title", "Type", "Assignee (PIC)", "Role", "Priority", "Status",
      "Progress %", "Deadline", "Routine", "Overdue", "Missed", "Comments",
    ];
    const rows = tasks.map((t) => [
      t.title,
      t.type,
      nameOf(t.assignee_id),
      roleOf(t.assignee_id),
      t.priority,
      STATUS_LABEL[t.status],
      String(t.progress),
      t.due_date ?? "",
      RECURRENCE_LABEL[t.recurrence],
      isOverdue(t) ? "YES" : "",
      String(t.missed_count || 0),
      String(t.comments.length),
    ]);
    download(`nllegacy-tasks-${klToday()}.csv`, [header, ...rows]);
  }

  function exportStaff() {
    const header = ["Name", "Role", "Assigned", "Done", "In Progress", "Overdue", "Missed", "Completion %"];
    const rows = staff.map((s) => {
      const mine = tasks.filter((t) => t.assignee_id === s.id);
      const done = mine.filter((t) => t.status === "done").length;
      const ip = mine.filter((t) => t.status === "in_progress").length;
      const od = mine.filter((t) => isOverdue(t)).length;
      const missed = mine.reduce((a, t) => a + (t.missed_count || 0), 0);
      const rate = mine.length ? Math.round((done / mine.length) * 100) : 0;
      return [s.name, s.role, String(mine.length), String(done), String(ip), String(od), String(missed), String(rate)];
    });
    download(`nllegacy-staff-performance-${klToday()}.csv`, [header, ...rows]);
  }

  return (
    <div className="flex gap-2 flex-wrap print:hidden">
      <button className="btn btn-primary" onClick={exportTasks}>⬇️ Export Tasks (CSV)</button>
      <button className="btn btn-ghost" onClick={exportStaff}>⬇️ Export Staff Performance (CSV)</button>
      <button className="btn btn-ghost" onClick={() => window.print()}>🖨️ Print / Save PDF</button>
    </div>
  );
}
