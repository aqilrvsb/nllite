"use client";

import Swal from "sweetalert2";

const brand = "#2563eb";

// Confirm dialog (replaces window.confirm). Resolves true if confirmed.
export async function confirmAction(opts: {
  title: string;
  text?: string;
  confirmText?: string;
  icon?: "warning" | "question" | "info";
  danger?: boolean;
}): Promise<boolean> {
  const res = await Swal.fire({
    title: opts.title,
    text: opts.text,
    icon: opts.icon ?? "warning",
    showCancelButton: true,
    confirmButtonText: opts.confirmText ?? "Yes",
    cancelButtonText: "Cancel",
    confirmButtonColor: opts.danger ? "#ef4444" : brand,
    cancelButtonColor: "#94a3b8",
    reverseButtons: true,
    buttonsStyling: true,
    focusCancel: true,
    customClass: { popup: "swal-nll" },
  });
  return res.isConfirmed;
}

// Small success toast (top-right).
export function toast(message: string, icon: "success" | "error" | "info" = "success") {
  Swal.fire({
    toast: true,
    position: "top-end",
    timer: 2200,
    timerProgressBar: true,
    showConfirmButton: false,
    icon,
    title: message,
    customClass: { popup: "swal-nll-toast" },
  });
}
