import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#2563eb",
          dark: "#1d4ed8",
          light: "#dbeafe",
          lighter: "#eff6ff",
        },
        ink: {
          DEFAULT: "#1e293b",
          medium: "#475569",
          light: "#94a3b8",
        },
      },
      fontFamily: {
        sans: ["var(--font-poppins)", "Poppins", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 4px 12px rgba(0,0,0,0.08)",
        lift: "0 8px 30px rgba(0,0,0,0.10)",
        brand: "0 4px 15px rgba(37,99,235,0.30)",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
      },
    },
  },
  plugins: [],
};
export default config;
