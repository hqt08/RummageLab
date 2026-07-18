import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "RummageLab | Everyday discovery for ages 0–6",
  description:
    "A parent-led, age-banded demo that turns confirmed everyday objects into short discovery activities.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
