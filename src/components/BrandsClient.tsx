"use client";

import { useState, useTransition } from "react";
import { createBrand, updateBrand, deleteBrand } from "@/lib/actions";
import { confirmAction, toast } from "@/lib/swal";
import type { Brand } from "@/lib/types";

function EditModal({ brand, onClose }: { brand: Brand; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onClose}>
      <div className="card w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Edit Brand</h2>
          <button className="btn btn-ghost !px-2 !py-1" onClick={onClose}>✕</button>
        </div>
        <form
          action={async (fd) => {
            await updateBrand(fd);
            onClose();
            toast("Brand updated");
          }}
          className="space-y-4"
        >
          <input type="hidden" name="id" value={brand.id} />
          <div>
            <label className="label">Brand name</label>
            <input name="name" className="input" required defaultValue={brand.name} />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span>Status</span>
            <select name="active" className="input !w-auto !py-1" defaultValue={brand.active ? "on" : "off"}>
              <option value="on">Active</option>
              <option value="off">Inactive (hidden from task dropdown)</option>
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" className="btn btn-ghost flex-1" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary flex-1">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function BrandsClient({
  brands,
  counts,
}: {
  brands: Brand[];
  counts: Record<string, number>;
}) {
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<Brand | null>(null);
  const [pending, start] = useTransition();

  function add() {
    const clean = name.trim();
    if (!clean) return;
    start(async () => {
      const fd = new FormData();
      fd.set("name", clean);
      await createBrand(fd);
      setName("");
      toast("Brand added");
    });
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold">🏷️ Brands</h1>
        <p className="text-muted text-sm mt-0.5">
          {brands.length} brands · used as an optional tag when creating tasks.
        </p>
      </div>

      {/* Add */}
      <div className="card p-4 mb-5 flex flex-wrap gap-2 items-center">
        <input
          className="input flex-1 min-w-[200px]"
          placeholder="New brand name…"
          value={name}
          disabled={pending}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        />
        <button className="btn btn-primary" disabled={pending || !name.trim()} onClick={add}>
          ＋ Add brand
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-faint" style={{ background: "var(--surface-alt)" }}>
                <th className="px-4 py-3 font-semibold">Brand</th>
                <th className="px-4 py-3 font-semibold">Tasks</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {brands.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-faint">No brands yet — add one above.</td></tr>
              )}
              {brands.map((b) => (
                <tr key={b.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-4 py-3 font-semibold">🏷️ {b.name}</td>
                  <td className="px-4 py-3 text-muted">{counts[b.id] ?? 0}</td>
                  <td className="px-4 py-3">
                    {b.active ? (
                      <span className="chip" style={{ color: "#16a34a", background: "#f0fdf4" }}>● Active</span>
                    ) : (
                      <span className="chip" style={{ color: "#94a3b8", background: "var(--surface-alt)" }}>○ Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button className="btn btn-ghost !px-2 !py-1" onClick={() => setEditing(b)}>✏️</button>
                      <button
                        className="btn btn-danger !px-2 !py-1"
                        disabled={pending}
                        onClick={async () => {
                          const ok = await confirmAction({
                            title: `Delete "${b.name}"?`,
                            text: (counts[b.id] ?? 0) > 0 ? `${counts[b.id]} task(s) will lose this brand tag.` : undefined,
                            danger: true,
                            confirmText: "Delete",
                          });
                          if (ok) start(async () => { await deleteBrand(b.id); toast("Brand deleted"); });
                        }}
                      >🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && <EditModal brand={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
