export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className="shrink-0 rounded-xl"
      aria-label="NLLITE logo"
    >
      <defs>
        <linearGradient id="nllite-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="26" fill="url(#nllite-g)" />
      <path d="M28 70 V30 h9 l26 27 V30 h9 v40 h-9 L37 43 v27 z" fill="#fff" />
      <circle cx="76" cy="30" r="7" fill="#22c55e" />
    </svg>
  );
}
