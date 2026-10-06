import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GeoDraw — Animated Route Replays & Video Export",
  description:
    "Turn real-world journeys into animated route replays, high-resolution shareable cards, and short video reels.",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#090d16",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full antialiased bg-slate-950 text-slate-100">
      <body className="h-full w-full overflow-hidden flex flex-col">{children}</body>
    </html>
  );
}
