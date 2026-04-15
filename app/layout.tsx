import "./globals.css";
import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ClassHop",
  description: "Discover interesting UC Berkeley lectures that fit your free time."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white">
        <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-5 sm:px-8">
          <header className="flex items-center justify-between py-4 sm:py-5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#003262]">
                <span className="text-[11px] font-bold tracking-wider text-[#FDB515]">CH</span>
              </div>
              <span className="text-[15px] font-semibold tracking-tight text-slate-900">
                ClassHop
              </span>
            </div>
            <span className="text-[11px] font-medium text-slate-400">
              Spring 2025
            </span>
          </header>

          <main className="flex-1 py-6 sm:py-8">{children}</main>

          <footer className="border-t border-slate-100 py-5 text-[11px] text-slate-400 flex items-center justify-between">
            <span>ClassHop · UC Berkeley</span>
            <span>Times are approximations.</span>
          </footer>
        </div>
      </body>
    </html>
  );
}
