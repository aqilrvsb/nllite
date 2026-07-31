import "server-only";

// ------------------------------------------------------------
//  WhatsApp sending via Whacenter.
//  Auth is the device instance UUID itself (no API key). The
//  UUID is read from WHACENTER_DEVICE_ID (falls back to the
//  admin instance so it works even before the env var is set).
// ------------------------------------------------------------

const WHACENTER_URL = "https://api.whacenter.com/api/send";
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
    const res = await fetch(WHACENTER_URL, {
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
