import "server-only";
import crypto from "crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { readDb } from "./db";
import type { SafeStaff } from "./types";
import { toSafeStaff } from "./types";

const COOKIE = "nll_session";
const SECRET = process.env.SESSION_SECRET || "nl-legacy-taskflow-local-dev-secret-change-me";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

function sign(payload: object): string {
  const body = b64url(JSON.stringify(payload));
  const mac = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${mac}`;
}

function verify(token: string): { sub: string; exp: number } | null {
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  if (
    mac.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))
  ) {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof data.exp === "number" && data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

export function setSessionCookie(staffId: string): void {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const token = sign({ sub: staffId, exp });
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export function clearSessionCookie(): void {
  cookies().set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export const getCurrentUser = cache(async (): Promise<SafeStaff | null> => {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  const data = verify(token);
  if (!data) return null;
  const db = await readDb();
  const staff = db.staff.find((s) => s.id === data.sub && s.active);
  return staff ? toSafeStaff(staff) : null;
});
