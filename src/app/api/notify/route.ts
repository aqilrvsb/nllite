import { NextResponse } from "next/server";
import { readDb, mutateDb } from "@/lib/db";
import { runDailyNotifications } from "@/lib/notify";
import { klToday } from "@/lib/tasks";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Current wall-clock time in Kuala Lumpur as minutes-since-midnight + "HH:MM".
function klNowHM(): { minutes: number; hhmm: string } {
  const s = new Date().toLocaleString("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const [h, m] = s.split(":").map((x) => parseInt(x, 10));
  return { minutes: h * 60 + m, hhmm: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` };
}

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured → allow (dev / manual)
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true; // Vercel cron sends this
  const url = new URL(req.url);
  return url.searchParams.get("key") === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const db = await readDb();
  const settings = db.settings;
  if (!settings?.enabled) {
    return NextResponse.json({ ok: true, skipped: "disabled" });
  }

  const today = klToday();
  const { minutes: nowMin, hhmm } = klNowHM();

  // A slot is "due" if it's already past for today and hasn't been sent yet.
  const dueSlots = (settings.times || []).filter((t) => {
    const [h, m] = t.split(":").map((x) => parseInt(x, 10));
    const slotMin = h * 60 + m;
    return settings.last_sent?.[t] !== today && nowMin >= slotMin;
  });

  if (dueSlots.length === 0) {
    return NextResponse.json({ ok: true, now: hhmm, due: [], sent: null });
  }

  const sent = await runDailyNotifications(db);

  // Mark the fired slots as sent for today so they don't repeat.
  await mutateDb((fresh) => {
    if (!fresh.settings) return;
    fresh.settings.last_sent = fresh.settings.last_sent || {};
    for (const t of dueSlots) fresh.settings.last_sent[t] = today;
  });

  return NextResponse.json({ ok: true, now: hhmm, due: dueSlots, sent });
}

// Allow POST too (manual triggers / some cron providers use POST).
export async function POST(req: Request) {
  return GET(req);
}
