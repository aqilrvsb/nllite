"use client";

import { useRouter } from "next/navigation";
import { ROLES } from "@/lib/types";

// Department filter for the Reports page (navigates with ?dept=).
export default function DeptFilter({ value, present }: { value: string; present: string[] }) {
  const router = useRouter();
  const options = ROLES.filter((r) => present.includes(r));
  return (
    <select
      className="input !w-auto print:hidden"
      value={value}
      onChange={(e) => {
        const v = e.target.value;
        router.push(v === "all" ? "/reports" : `/reports?dept=${encodeURIComponent(v)}`);
      }}
    >
      <option value="all">🏷️ All departments</option>
      {options.map((r) => (
        <option key={r} value={r}>
          {r}
        </option>
      ))}
    </select>
  );
}
