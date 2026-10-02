import "server-only";

// ------------------------------------------------------------
//  WhatsApp sending via the PeningBot Baileys gateway.
//  Speaks the same API as Whacenter (same /api/send route, same
//  params, same {status,data,message} response) — only the domain
//  differs. Auth is the device instance UUID itself (no API key).
//  Both are env-overridable so the host can change without a redeploy.
//  NOTE: this gateway does NOT auto-convert 0xxxx → 60xxxx — numbers
//  must already be 60XXXXXXXXX (we normalise via normalizeMsPhone).
// ------------------------------------------------------------

const SEND_URL =
  process.env.WHATSAPP_SEND_URL ||
  "https://dev-muse-automaton-production.up.railway.app/api/send";
const DEVICE_ID =
  process.env.WHACENTER_DEVICE_ID || "3afd5364-87e7-4466-ae7f-55e9035fdd40";

export interface SendResult {
  ok: boolean;
  number: string;
  error?: string;
}

// Send one WhatsApp message. `number` must already be in 60XXXXXXXXX format.
export async function sendWhatsApp(
  number: string,
  message: string,
  opts?: { file?: string; schedule?: string }
): Promise<SendResult> {
  if (!number) return { ok: false, number, error: "no number" };
  const body = new URLSearchParams({ device_id: DEVICE_ID, number, message });
  if (opts?.file) body.set("file", opts.file);
  if (opts?.schedule) body.set("schedule", opts.schedule);

  try {
    const res = await fetch(SEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (data?.status === true) return { ok: true, number };
    return { ok: false, number, error: data?.message || `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, number, error: (e as Error).message };
  }
}

// Send the same message to many numbers (small batches so we never
// exceed Whacenter's comfortable burst size). Blank numbers are skipped.
export async function sendWhatsAppMany(
  targets: { number: string; message: string }[]
): Promise<SendResult[]> {
  const valid = targets.filter((t) => t.number);
  const results: SendResult[] = [];
  const BATCH = 20;
  for (let i = 0; i < valid.length; i += BATCH) {
    const slice = valid.slice(i, i + BATCH);
    const r = await Promise.all(slice.map((t) => sendWhatsApp(t.number, t.message)));
    results.push(...r);
  }
  return results;
}
