"use client";

import { useFormState, useFormStatus } from "react-dom";
import { login } from "@/lib/actions";
import { useState } from "react";
import { Logo } from "./Logo";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary w-full" disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

const DEMO = [
  { label: "CEO / Boss", sid: "HQNL", pw: "HQNL" },
  { label: "Leader", sid: "NL-002", pw: "password123" },
  { label: "Marketer (PIC)", sid: "NL-006", pw: "password123" },
  { label: "Live Host", sid: "NL-010", pw: "password123" },
];

export default function LoginForm() {
  const [state, formAction] = useFormState(login, {});
  const [sid, setSid] = useState("HQNL");
  const [pw, setPw] = useState("HQNL");

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="mx-auto mb-4 w-16 shadow-brand rounded-2xl">
          <Logo size={64} />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">NLLITE</h1>
        <p className="text-muted text-sm mt-1">Staff task, routine & team tracking</p>
      </div>

      <form action={formAction} className="card p-6 space-y-4">
        <div>
          <label className="label">Staff ID</label>
          <input
            name="staff_id"
            type="text"
            className="input"
            value={sid}
            onChange={(e) => setSid(e.target.value)}
            placeholder="NL-001"
            autoComplete="username"
            autoCapitalize="characters"
          />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            name="password"
            type="password"
            className="input"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </div>
        {state?.error && (
          <p className="text-sm text-red-500 font-medium">{state.error}</p>
        )}
        <SubmitButton />
      </form>

      <div className="mt-6">
        <p className="text-center text-xs text-faint mb-2">Quick demo logins</p>
        <div className="grid grid-cols-2 gap-2">
          {DEMO.map((d) => (
            <button
              key={d.sid}
              type="button"
              onClick={() => {
                setSid(d.sid);
                setPw(d.pw);
              }}
              className="chip surface justify-center py-2 hover:border-brand"
              style={{ borderRadius: "0.6rem" }}
            >
              {d.label} <span className="text-faint">({d.sid})</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
