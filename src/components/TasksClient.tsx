"use client";

import { useMemo, useState } from "react";
import type { Actor, Recurrence, SafeStaff, Task } from "@/lib/types";
import { ROLES } from "@/lib/types";
import { isOverdue } from "@/lib/tasks";
import { canCreateTask } from "@/lib/perms";
import TaskCard from "./TaskCard";
import TaskModal from "./TaskModal";
import TaskDetailModal from "./TaskDetailModal";
import KanbanBoard from "./KanbanBoard";

export default function TasksClient({
  tasks,
  staff,
  assignable,
  me,
  title = "All Tasks",
  subtitle,
}: {
  tasks: Task[];
  staff: SafeStaff[];
  assignable?: SafeStaff[];
  me: Actor;
  title?: string;
  subtitle?: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [recur, setRecur] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [dept, setDept] = useState("all");
  const [view, setView] = useState<"board" | "list">("board");

  const roleOf = (id: string | null) => staff.find((s) => s.id === id)?.role;
  // People/department filters are scoped to who the viewer may assign to:
  // boss/viewer → everyone · leader → their team · staff → just themselves.
  const filterStaff = assignable ?? staff;
  const showPeopleFilters = filterStaff.length > 1; // a plain staff (self only) gets no people/dept filter
  const depts = ROLES.filter((r) => filterStaff.some((s) => s.role === r));

  const counts = useMemo(
    () => ({
      all: tasks.length,
      internal: tasks.filter((t) => t.type === "internal").length,
      external: tasks.filter((t) => t.type === "external").length,
    }),
    [tasks]
  );

  // routine counts respect the selected Internal/External tab
  const recurCounts = useMemo(() => {
    const base = type === "all" ? tasks : tasks.filter((t) => t.type === type);
    return {
      all: base.length,
      daily: base.filter((t) => t.recurrence === "daily").length,
      weekly: base.filter((t) => t.recurrence === "weekly").length,
      monthly: base.filter((t) => t.recurrence === "monthly").length,
      once: base.filter((t) => t.recurrence === "once").length,
    };
  }, [tasks, type]);

  const filtered = useMemo(() => {
    return tasks
      .filter((t) => {
        if (q && !`${t.title} ${t.description}`.toLowerCase().includes(q.toLowerCase()))
          return false;
        if (type !== "all" && t.type !== type) return false;
        if (recur !== "all" && t.recurrence !== recur) return false;
        if (assignee !== "all" && t.assignee_id !== assignee) return false;
        if (dept !== "all" && roleOf(t.assignee_id) !== dept) return false;
        // status filter only applies in list view (board has status columns)
        if (view === "list") {
          if (status === "overdue") return isOverdue(t);
          if (status !== "all" && t.status !== status) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // overdue first, then by due date, then priority
        const ao = isOverdue(a) ? 0 : 1;
        const bo = isOverdue(b) ? 0 : 1;
        if (ao !== bo) return ao - bo;
        const ad = a.due_date ?? "9999";
        const bd = b.due_date ?? "9999";
        return ad.localeCompare(bd);
      });
  }, [tasks, q, type, status, recur, assignee, dept, view]);

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(t: Task) {
    setEditing(t);
    setModalOpen(true);
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-5">
        <div>
          <h1 className="text-2xl font-extrabold">{title}</h1>
          {subtitle && <p className="text-muted text-sm mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {/* Board / List view toggle */}
          <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "var(--border)" }}>
            <button
              className={`px-3 py-2 text-sm font-semibold ${view === "board" ? "bg-brand text-white" : "text-muted"}`}
              onClick={() => setView("board")}
            >
              ▦ Board
            </button>
            <button
              className={`px-3 py-2 text-sm font-semibold ${view === "list" ? "bg-brand text-white" : "text-muted"}`}
              onClick={() => setView("list")}
            >
              ☰ List
            </button>
          </div>
          {canCreateTask(me) && (
            <button className="btn btn-primary" onClick={openNew}>
              ＋ New {["daily", "weekly", "monthly"].includes(recur) ? recur.charAt(0).toUpperCase() + recur.slice(1) + " " : ""}Task
            </button>
          )}
        </div>
      </div>

      {/* Internal / External tabs */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {([
          { key: "all", label: "All Tasks", icon: "🗂️" },
          { key: "internal", label: "Internal", icon: "🏢" },
          { key: "external", label: "External", icon: "🌐" },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setType(tab.key)}
            className={`px-4 py-2 rounded-xl font-semibold text-sm transition border ${
              type === tab.key ? "bg-brand text-white border-brand shadow-brand" : "surface"
            }`}
            style={type === tab.key ? undefined : { borderColor: "var(--border)" }}
          >
            {tab.icon} {tab.label}
            <span
              className="ml-2 text-xs px-1.5 py-0.5 rounded-full"
              style={{
                background: type === tab.key ? "rgba(255,255,255,0.25)" : "var(--surface-alt)",
              }}
            >
              {counts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Routine sub-tabs (Daily / Weekly / Monthly) */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <span className="text-xs text-faint font-semibold mr-1">Routine:</span>
        {([
          { key: "all", label: "All", icon: "•" },
          { key: "daily", label: "Daily", icon: "🌅" },
          { key: "weekly", label: "Weekly", icon: "📅" },
          { key: "monthly", label: "Monthly", icon: "🗓️" },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setRecur(tab.key)}
            className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition border ${
              recur === tab.key ? "bg-brand text-white border-brand" : "surface"
            }`}
            style={recur === tab.key ? undefined : { borderColor: "var(--border)" }}
          >
            {tab.icon} {tab.label}
            <span
              className="ml-1.5 px-1.5 py-0.5 rounded-full"
              style={{ background: recur === tab.key ? "rgba(255,255,255,0.25)" : "var(--surface-alt)" }}
            >
              {recurCounts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      <div className="card p-3 mb-5 flex flex-wrap gap-2 items-center">
        <input
          className="input flex-1 min-w-[180px]"
          placeholder="🔍 Search tasks…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {view === "list" && (
          <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All status</option>
            <option value="todo">To Do List</option>
            <option value="priority">Priority Task</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Completed</option>
            <option value="on_hold">On Hold</option>
            <option value="overdue">⚠ Overdue</option>
          </select>
        )}
        {showPeopleFilters && (
          <select
            className="input w-auto"
            value={dept}
            onChange={(e) => setDept(e.target.value)}
          >
            <option value="all">🏷️ All departments</option>
            {depts.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        )}
        {showPeopleFilters && (
          <select
            className="input w-auto"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
          >
            <option value="all">Everyone</option>
            {filterStaff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {view === "board" ? (
        <KanbanBoard tasks={filtered} staff={staff} me={me} onOpen={setOpenTask} onEdit={openEdit} />
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center text-muted">
          <div className="text-4xl mb-2">🗂️</div>
          No tasks match your filters.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              staff={staff}
              me={me}
              onEdit={openEdit}
              onOpen={setOpenTask}
            />
          ))}
        </div>
      )}

      {modalOpen && (
        <TaskModal
          staff={assignable ?? staff}
          jvStaff={staff}
          task={editing}
          me={me}
          defaultRecurrence={["daily", "weekly", "monthly"].includes(recur) ? (recur as "daily" | "weekly" | "monthly") : undefined}
          defaultType={type === "internal" || type === "external" ? type : undefined}
          onClose={() => setModalOpen(false)}
        />
      )}
      {openTask && (
        <TaskDetailModal
          task={tasks.find((t) => t.id === openTask.id) ?? openTask}
          staff={staff}
          me={me}
          onClose={() => setOpenTask(null)}
        />
      )}
    </div>
  );
}
