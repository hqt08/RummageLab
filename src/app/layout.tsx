import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "RummageLab | Everyday learning adventures",
  description: "Turn the things around you into 15-minute learning adventures.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
