import "./globals.css";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Fraunces, DM_Sans, DM_Mono } from "next/font/google";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["300", "500"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap"
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-dm-sans",
  display: "swap"
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-dm-mono",
  display: "swap"
});

export const metadata: Metadata = {
  title: "ClassHop",
  description: "Discover interesting UC Berkeley lectures that fit your free time.",
  viewport: "width=device-width, initial-scale=1",
  themeColor: "#002855"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fraunces.variable} ${dmSans.variable} ${dmMono.variable} dark`}
    >
      <body>{children}</body>
    </html>
  );
}
