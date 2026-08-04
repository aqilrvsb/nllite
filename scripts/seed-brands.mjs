// Idempotent brand seeder: adds the company's brand list into the EXISTING
// app_state blob without touching staff/tasks. Run: node scripts/seed-brands.mjs
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import fs from "fs";

for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m) process.env[m[1]] = m[2];
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const NAMES = [
  "AURA WHITE", "AUREFIYA EXCLUSIVE", "AVOKI", "BABANYONYA", "CANDYTA",
  "CANTIK GOLD", "COSRX", "DOLCEA", "DR AINA", "GB GLOWING", "Gluvera",
  "HARIKA", "KIYORA", "MASTER ALEYH", "MOMMY HANA", "NEUPRODUCTION",
  "NUBHAN", "PANNA LAB", "PRODUK MAKANAN", "RAJA PERFUME", "RISSA SKIN",
  "SOMEBYME", "SOULMATE", "SYIFA GOLD", "VERONIQ", "ZZADMINMANAGE",
];

const { data, error } = await supabase.from("app_state").select("value").eq("key", "db").maybeSingle();
if (error) { console.error("read failed:", error.message); process.exit(1); }
if (!data) { console.error("no db blob found — app not seeded yet."); process.exit(1); }

const db = data.value;
if (!Array.isArray(db.brands)) db.brands = [];

const existing = new Set(db.brands.map((b) => b.name.toLowerCase()));
let added = 0;
for (const name of NAMES) {
  if (existing.has(name.toLowerCase())) continue;
  db.brands.push({ id: crypto.randomUUID(), name, active: true, created_at: new Date().toISOString() });
  existing.add(name.toLowerCase());
  added++;
}

const { error: werr } = await supabase
  .from("app_state")
  .upsert({ key: "db", value: db, updated_at: new Date().toISOString() });
if (werr) { console.error("write failed:", werr.message); process.exit(1); }

console.log(`Brands: +${added} added, ${db.brands.length} total.`);
