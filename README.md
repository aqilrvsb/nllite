# ✅ NL Legacy TaskFlow

Staff task & routine tracking system for **NL Legacy** — built with **Next.js 14 + TypeScript + Tailwind**.
Runs **100% locally**. No cloud, no external database, no internet required.

---

## 🚀 How to run (every time)

Open a terminal in this folder and run:

```bash
npm run dev
```

Then open **http://localhost:3000** in your browser.

> First time only (already done for you): `npm install`

To build a production version: `npm run build` then `npm start`.

---

## 🔑 Login accounts (demo)

Login is by **Staff ID** (format `NL-001`, auto-increments when you add staff).
Click a **Quick demo login** button, or type the Staff ID + password:

| Staff ID | Name | Role | Password |
|------|------|------|----------|
| **NL-001** | Naim (Boss) | CEO / Boss **(admin)** | `admin123` |
| NL-002 | Aiman | Leader | `password123` |
| NL-003 | Siti | Human Resources | `password123` |
| NL-004 | Firdaus | IT Department | `password123` |
| NL-005 | Nadia | Admin | `password123` |
| NL-006 | Zul (PIC) | Marketer (PIC) | `password123` |
| NL-007 | Farah | Team Sale | `password123` |
| NL-008 | Iman | Content Creator | `password123` |
| NL-009 | Haziq | Editor | `password123` |
| NL-010 | Aisyah | Live Host | `password123` |

### Who can do what (permissions)
- **Only NL-001 (Boss) is admin by default.** To make anyone else an admin, log in as
  Boss → **Staff** → ✏️ edit → tick **Admin access**.
- **Admins**: create & assign tasks to anyone, edit/delete any task, see All Tasks
  (whole team), manage staff, view Reports.
- **Staff**: see only **their own** tasks (Board or List), create their **own** tasks
  (auto-assigned to them), drag across the 5 status columns, comment, and manage their
  own profile/password. A personal dashboard shows only their stats.

---

## ✨ Features

### Staff tracking (10 roles / departments)
Leader · Marketer (PIC) · Admin · Editor · Content Creator · Human Resources ·
Team Sale · Live Host · CEO / Boss · IT Department.
Add / edit / deactivate staff, set passwords, grant admin access.

### Tasks & to-do progress
- **Internal** vs **External** tasks
- Assign a **PIC** (person in charge) to every task
- Priority (High / Medium / Low), status (To Do / In Progress / Done)
- **Progress %** slider on each card — live team monitoring
- Target **deadline** with automatic **⚠ OVERDUE** detection ("due date over limit")

### Routine tasks (auto-repeating)
- **Daily / Weekly / Monthly** routines
- Each period the task **auto-resets** to fresh, and its deadline is set automatically
- If a routine period ends without being done, it's counted as **missed ×N**
- Timezone: **Asia/Kuala_Lumpur**

### Dashboard (monitoring)
- Live counts: total, completed, in progress, overdue, due today, routines
- Overall team completion %
- **Team Performance** — completion bar per staff (assigned / done / overdue / missed)
- **Needs Attention** — overdue + due-today list
- **Tasks by Role / Department**

### Collaboration & tracking
- **Task detail view** — click any task title to open it: full info, progress,
  **comments thread**, and an **activity log** (who did what, when).
- **Notifications** — 🔔 bell in the sidebar shows a badge with *your* overdue + due-today
  tasks; click for the list.

### Reports & export (admin)
- **Reports** page: team summary, staff performance table, full task table.
- **Export to CSV** (opens in Excel) for both tasks and staff performance.
- **Print / Save as PDF** — clean printable layout (sidebar hidden).

### Self-service
- **My Profile** — every staff member can change their own display name and password
  (role/admin access stays with admins).

### Extras
- 🌙 Light / Dark mode
- Search + filter by type, status, routine, assignee
- Responsive (works on phone/tablet for the demo)

---

## 🗄️ Where is the data?

Everything is stored locally in **`data/db.json`** (created on first run).

- **Back it up:** just copy that file.
- **Reset to fresh sample data:** delete `data/db.json` and restart `npm run dev`.
- **Start empty for real use:** delete `data/db.json`, then edit `src/lib/db.ts`
  (the `seed()` function) to keep only your CEO account, or just delete the sample
  staff/tasks from the Staff and Tasks pages after logging in.

---

## 🛠️ Tech / structure

```
src/
  app/
    login/            Login page
    (app)/
      dashboard/      Monitoring dashboard
      my-tasks/       Tasks assigned to me
      tasks/          All team tasks
      staff/          Staff management (admin only)
  lib/
    db.ts             Local JSON database + seed data
    types.ts          Roles, task types, constants
    tasks.ts          Routine period / overdue logic (KL timezone)
    store.ts          Rollover engine + data loader
    session.ts        Cookie login session
    actions.ts        All server actions (create/update/delete)
  components/         UI: Sidebar, TaskCard, TaskModal, StaffClient, etc.
```

No native modules — fully portable. Passwords are hashed with bcrypt; the login
session is a signed HTTP-only cookie.

---

## ☁️ When you're ready to put it online

Everything is written to move to the cloud easily later (Vercel + a database).
For now it's intentionally local so you can test and modify (`ubah`) freely.
