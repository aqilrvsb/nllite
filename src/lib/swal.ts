"use client";

// SweetAlert is loaded on first use (dynamic import) so it stays OUT of the
// initial page bundle — pages load faster; the ~40KB lib arrives only when
// a confirm/toast is actually triggered.
type SwalModule = typeof import("sweetalert2")["default"];
let swalPromise: Promise<SwalModule> | null = null;
function getSwal(): Promise<SwalModule> {
  if (!swalPromise) swalPromise = import("sweetalert2").then((m) => m.default);
  return swalPromise;
}

const brand = "#2563eb";

export async function confirmAction(opts: {
  title: string;
  text?: string;
  confirmText?: string;
  icon?: "warning" | "question" | "info";
  danger?: boolean;
}): Promise<boolean> {
  const Swal = await getSwal();
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
    focusCancel: true,
    customClass: { popup: "swal-nll" },
  });
  return res.isConfirmed;
}

export function toast(message: string, icon: "success" | "error" | "info" = "success") {
  getSwal().then((Swal) =>
    Swal.fire({
      toast: true,
      position: "top-end",
      timer: 2200,
      timerProgressBar: true,
      showConfirmButton: false,
      icon,
      title: message,
      customClass: { popup: "swal-nll-toast" },
    })
  );
}
