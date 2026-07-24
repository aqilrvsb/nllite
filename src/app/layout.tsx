import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NLLITE",
  description: "NLLITE — staff task, routine & team tracking for NL Legacy",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <body>{children}</body>
    </html>
  );
}
