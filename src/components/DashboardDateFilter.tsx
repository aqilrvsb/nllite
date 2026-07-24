"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DashboardDateFilter({
  from,
  to,
  field,
}: {
  from: string;
  to: string;
  field: "due" | "created";
}) {
  const router = useRouter();
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  const [fld, setFld] = useState<"due" | "created">(field);

  function apply() {
    const params = new URLSearchParams();
    if (f) params.set("from", f);
    if (t) params.set("to", t);
    if (fld !== "due") params.set("field", fld);
    const qs = params.toString();
    router.push(qs ? `/dashboard?${qs}` : "/dashboard");
  }
  function thisMonth() {
    if (fld !== "due") router.push(`/dashboard?field=${fld}`);
    else router.push("/dashboard");
  }

  return (
    <div className="card p-3 flex flex-wrap items-end gap-3">
      <div>
        <label className="label">Filter by</label>
        <select
          className="input !w-auto"
          value={fld}
          onChange={(e) => setFld(e.target.value as "due" | "created")}
        >
          <option value="due">🎯 Deadline</option>
          <option value="created">🆕 Created date</option>
        </select>
      </div>
      <div>
        <label className="label">From</label>
        <input type="date" className="input !w-auto" value={f} onChange={(e) => setF(e.target.value)} />
      </div>
      <div>
        <label className="label">To</label>
        <input type="date" className="input !w-auto" value={t} onChange={(e) => setT(e.target.value)} />
      </div>
      <button className="btn btn-primary" onClick={apply}>Apply filter</button>
      <button className="btn btn-ghost" onClick={thisMonth}>This month</button>
      <span className="text-xs text-faint ml-auto self-center">🇲🇾 Malaysia time (GMT+8) · defaults to current month</span>
    </div>
  );
}
