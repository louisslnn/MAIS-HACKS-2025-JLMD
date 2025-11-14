import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";

import "./globals.css";
import { Providers } from "./providers";
import { LoginButton } from "@/components/auth/LoginButton";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MathClash — Competitive Math Battles",
  description:
    "Face off in real-time math battles, sharpen your skills in training mode, climb the leaderboard, and connect with friends.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <div className="flex min-h-screen flex-col">
            <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/60">
              <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
                <Link href="/" className="flex items-center gap-2.5 text-lg font-bold text-ink">
                  <Image
                    src="/logo_clashapp.png"
                    alt="MathClash"
                    width={40}
                    height={40}
                    priority
                    className="h-9 w-auto"
                  />
                  <span className="hidden sm:inline">MathClash</span>
                </Link>
                
                <nav className="flex items-center gap-1 text-sm font-medium text-ink-soft">
                  <Link href="/play" className="rounded-lg px-4 py-2 transition hover:bg-surface-muted hover:text-ink">
                    Play
                  </Link>
                  <Link href="/social" className="rounded-lg px-4 py-2 transition hover:bg-surface-muted hover:text-ink">
                    Social
                  </Link>
                  <Link href="/settings" className="rounded-lg px-4 py-2 transition hover:bg-surface-muted hover:text-ink">
                    Settings
                  </Link>
                </nav>

                <div className="flex items-center gap-2">
                  <LoginButton />
                </div>
              </div>
            </header>

            <main className="flex-1">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
