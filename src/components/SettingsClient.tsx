"use client";

import { useState, useTransition } from "react";
import { updateNotifySettings, sendNotificationsNow, sendTestNotification } from "@/lib/actions";
import { displayPhone, type NotifySettings } from "@/lib/types";
import { toast } from "@/lib/swal";

export default function SettingsClient({
  settings,
  bosses,
  stats,
}: {
  settings: NotifySettings;
  bosses: { name: string; whatsapp: string }[];
  stats: { staffWithPhone: number; activeStaff: number };
}) {
  const [enabled, setEnabled] = useState(settings.enabled);
  const [statusAlerts, setStatusAlerts] = useState(settings.status_alerts !== false);
  const [times, setTimes] = useState<string[]>(settings.times);
  const [newTime, setNewTime] = useState("");
  const [testNum, setTestNum] = useState("");
  const [savePending, startSave] = useTransition();
  const [sendPending, startSend] = useTransition();
  const [testPending, startTest] = useTransition();

  function addTime() {
    if (!/^\d{1,2}:\d{2}$/.test(newTime)) return;
    const [h, m] = newTime.split(":");
    const t = `${h.padStart(2, "0")}:${m}`;
    if (!times.includes(t)) setTimes([...times, t].sort());
    setNewTime("");
  }
  function removeTime(t: string) {
    setTimes(times.filter((x) => x !== t));
  }

  function save() {
    const fd = new FormData();
    if (enabled) fd.set("enabled", "on");
    if (statusAlerts) fd.set("status_alerts", "on");
    fd.set("times", times.join(","));
    startSave(async () => {
      await updateNotifySettings(fd);
      toast("✅ Tetapan notifikasi disimpan");
    });
  }

  function sendNow() {
    startSend(async () => {
      const r = await sendNotificationsNow();
      toast(`📤 Dihantar — staff:${r.personal} · leader:${r.leaders} · boss:${r.boss}`);
    });
  }

  function sendTestMsg() {
    if (!testNum.trim()) return;
    startTest(async () => {
      const r = await sendTestNotification(testNum.trim());
      toast(r.ok ? "✅ Mesej ujian dihantar" : `❌ Gagal: ${r.error ?? "unknown"}`);
    });
  }

  const bossHasPhone = bosses.some((b) => b.whatsapp);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">⚙️ WhatsApp Notifications</h1>
        <p className="text-muted text-sm mt-0.5">
          Atur peringatan automatik To Do List &amp; ringkasan tugasan.
        </p>
      </div>

      {/* Boss number status */}
      <div className="card p-5">
        <h2 className="font-bold mb-2">🏢 Nombor WhatsApp Boss</h2>
        {bosses.length === 0 ? (
          <p className="text-sm text-faint">Tiada akaun boss (admin) aktif.</p>
        ) : (
          <div className="space-y-1.5">
            {bosses.map((b) => (
              <div key={b.name} className="flex items-center justify-between text-sm">
                <span className="font-medium">{b.name}</span>
                {b.whatsapp ? (
                  <span className="chip" style={{ color: "#16a34a", background: "#f0fdf4" }}>📱 {displayPhone(b.whatsapp)}</span>
                ) : (
                  <span className="chip" style={{ color: "#dc2626", background: "#fef2f2" }}>❌ Belum diisi</span>
                )}
              </div>
            ))}
          </div>
        )}
        {!bossHasPhone && (
          <p className="text-[12px] text-red-500 mt-2">
            Isi nombor WhatsApp boss di halaman <b>Staff</b> atau <b>My Profile</b> supaya ringkasan boleh dihantar.
          </p>
        )}
        <p className="text-[12px] text-faint mt-2">
          {stats.staffWithPhone}/{stats.activeStaff} staff aktif sudah ada nombor WhatsApp.
        </p>
      </div>

      {/* Schedule */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold">🔔 Jadual Automatik</h2>
            <p className="text-[12px] text-faint">Setiap masa di bawah akan menghantar peringatan sekali sehari.</p>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="accent-brand w-5 h-5" />
            {enabled ? "Aktif" : "Off"}
          </label>
        </div>

        <div>
          <label className="label">Masa hantar (waktu Malaysia)</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {times.length === 0 && <span className="text-xs text-faint">Belum ada masa ditetapkan.</span>}
            {times.map((t) => (
              <span key={t} className="chip" style={{ background: "var(--surface-alt)" }}>
                🕒 {t}
                <button className="ml-1.5 text-red-500 font-bold" onClick={() => removeTime(t)} title="Buang">×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="time"
              className="input !w-auto"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
            />
            <button className="btn btn-ghost" onClick={addTime}>＋ Tambah masa</button>
          </div>
          <p className="text-[12px] text-faint mt-2">
            Bilangan masa = berapa kali notifikasi sehari. Contoh: <b>09:00</b> &amp; <b>17:00</b> = 2 kali sehari.
          </p>
        </div>

        <div className="pt-3 border-t flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
          <div>
            <p className="font-bold text-sm">🔄 Alert tukar status</p>
            <p className="text-[12px] text-faint">WhatsApp ke staff + leader + boss setiap kali tugasan pindah status (drag). Matikan jika terlalu banyak mesej.</p>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer shrink-0">
            <input type="checkbox" checked={statusAlerts} onChange={(e) => setStatusAlerts(e.target.checked)} className="accent-brand w-5 h-5" />
            {statusAlerts ? "On" : "Off"}
          </label>
        </div>

        <button className="btn btn-primary" disabled={savePending} onClick={save}>
          {savePending ? "Menyimpan…" : "Simpan tetapan"}
        </button>
      </div>

      {/* Manual send */}
      <div className="card p-5 space-y-3">
        <h2 className="font-bold">📤 Hantar sekarang</h2>
        <p className="text-[12px] text-faint">
          Hantar semua ringkasan serta-merta: peringatan ke setiap staff, ringkasan team ke setiap leader, ringkasan penuh ke boss.
        </p>
        <button className="btn" style={{ background: "#16a34a", color: "#fff" }} disabled={sendPending} onClick={sendNow}>
          {sendPending ? "Menghantar…" : "Hantar ringkasan sekarang"}
        </button>
      </div>

      {/* Test */}
      <div className="card p-5 space-y-3">
        <h2 className="font-bold">🧪 Uji sambungan</h2>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="60123456789"
            value={testNum}
            onChange={(e) => setTestNum(e.target.value)}
          />
          <button className="btn btn-ghost" disabled={testPending} onClick={sendTestMsg}>
            {testPending ? "…" : "Hantar ujian"}
          </button>
        </div>
      </div>
    </div>
  );
}
