import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Kitchen Sound Detectives | RummageLab",
  description:
    "A seeded, parent-led sound investigation using safe everyday kitchen objects.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
