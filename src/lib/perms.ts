// ============================================================
//  Permission rules (pure, shared by client UI and server actions)
//  - Admins (CEO / Leader / HR / Admin) manage everything.
//  - The task creator can edit/delete their own task.
//  - The assignee (PIC) can update progress/status on their task.
//  - Anyone logged in can view and comment.
// ============================================================
import type { Actor, Task } from "./types";

// Everyone can create tasks. Admins can assign to anyone; a staff member's
// new task is always assigned to themselves (enforced server-side).
export function canCreateTask(u: Actor | null): boolean {
  return !!u;
}

// Admins assign to anyone; Leaders assign to their team. Staff self-assign.
export function canAssignOthers(u: Actor | null): boolean {
  return !!u && (u.is_admin || !!u.is_leader);
}

export function canEditTask(u: Actor | null, t: Task): boolean {
  if (!u) return false;
  return u.is_admin || t.created_by === u.id;
}

export function canDeleteTask(u: Actor | null, t: Task): boolean {
  if (!u) return false;
  return u.is_admin || t.created_by === u.id;
}

// Update progress / status / mark done
export function canProgressTask(u: Actor | null, t: Task): boolean {
  if (!u) return false;
  return u.is_admin || t.created_by === u.id || t.assignee_id === u.id;
}

export function canComment(u: Actor | null): boolean {
  return !!u;
}
