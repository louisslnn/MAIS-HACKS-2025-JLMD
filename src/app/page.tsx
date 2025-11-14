"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { doc, onSnapshot } from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { LoginButton } from "@/components/auth/LoginButton";
import { Button } from "@/components/ui";

export default function Home() {
  const { user, loading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<string>("");

  const tournamentDate = useMemo(() => {
    const timeZone = "America/Toronto";
    const now = new Date();
    const tzNow = new Date(now.toLocaleString("en-US", { timeZone }));
    const currentDay = tzNow.getDay();
    const daysUntilNextSunday = currentDay === 0 ? 7 : 7 - currentDay;
    const daysUntilTournament = daysUntilNextSunday + 7;
    const target = new Date(tzNow);
    target.setDate(target.getDate() + daysUntilTournament);
    target.setHours(12, 0, 0, 0);

    const year = target.getFullYear();
    const month = target.getMonth() + 1;
    const dayOfMonth = target.getDate();

    const pad = (value: number) => value.toString().padStart(2, "0");

    const sampleUtcDate = new Date(Date.UTC(year, month - 1, dayOfMonth, 12, 0, 0));
    const timezoneParts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(sampleUtcDate);
    const tzName = timezoneParts.find((part) => part.type === "timeZoneName")?.value ?? "GMT-04";
    const match = tzName.match(/GMT([+-]\d{1,2})(?::?(\d{2}))?/);
    const sign = match?.[1]?.startsWith("-") ? "-" : "+";
    const offsetHours = match ? Math.abs(parseInt(match[1], 10)) : 4;
    const offsetMinutes = match?.[2] ? parseInt(match[2], 10) : 0;
    const offsetString = `${sign}${offsetHours.toString().padStart(2, "0")}:${offsetMinutes
      .toString()
      .padStart(2, "0")}`;

    return new Date(`${year}-${pad(month)}-${pad(dayOfMonth)}T12:00:00${offsetString}`);
  }, []);

  // Fix hydration mismatch - only render after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch user rating from Firestore
  useEffect(() => {
    if (!user || !firestore) {
      setUserRating(null);
      return;
    }

    const userDocRef = doc(firestore, "users", user.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserRating(data.rating || 1000);
      }
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const diff = tournamentDate.getTime() - now.getTime();
      if (diff <= 0) {
        setCountdown("Tournament day!");
        return;
      }
      const totalSeconds = Math.floor(diff / 1000);
      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      setCountdown(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    };

    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [tournamentDate]);

  if (!mounted) {
    return (
      <div className="relative min-h-[calc(100vh-200px)] flex items-center justify-center">
        <div className="flex items-center gap-3 text-ink-soft">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent"></div>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-200px)] flex items-center justify-center overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand/5 via-transparent to-brand-secondary/5" />
      
      {/* Animated circles */}
      <div className="absolute inset-0 flex items-center justify-center opacity-30">
        <div className="absolute h-64 w-64 rounded-full border-2 border-brand/20 animate-ping" style={{ animationDuration: '3s' }} />
        <div className="absolute h-96 w-96 rounded-full border border-brand/10 animate-pulse" style={{ animationDuration: '4s' }} />
      </div>

      {/* Hero content */}
      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
        <div className="mb-6 inline-flex flex-col items-center gap-3 rounded-2xl border border-brand/30 bg-white/80 px-6 py-4 text-center text-ink shadow-md backdrop-blur-sm">
          <span className="text-xs font-semibold uppercase tracking-widest text-brand">Tournament Alert</span>
          <h2 className="text-lg font-semibold">
            Cash-prize MathClash Tournament — Sign-ups opening soon!
          </h2>
          <p className="text-sm text-ink-soft">
            Winner earns <strong className="text-brand">$100 CAD</strong>; the rest of the podium takes <strong className="text-brand">$50 CAD</strong>.
          </p>
          <div className="flex flex-col items-center">
            <span className="text-2xl font-mono font-bold text-ink">{countdown}</span>
          </div>
        </div>
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-ink mb-12 tracking-tight">
          Master Math Through
          <span className="block text-brand">Real Competition</span>
        </h1>

        <div className="flex flex-col items-center justify-center gap-6">
          {loading ? (
            <div className="flex items-center gap-3 text-ink-soft">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent"></div>
              <span>Loading...</span>
            </div>
          ) : user ? (
            <div className="flex flex-col items-center gap-6">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <Link
                  href="/play"
                  className="inline-flex items-center justify-center gap-3 h-16 rounded-full px-12 py-8 text-2xl font-bold bg-brand text-white shadow-lg hover:bg-brand/90 transition-all hover:scale-105 cursor-pointer"
                >
                  Quick Match
                  <svg className="ml-2 w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </Link>
                <Link 
                  href="/play"
                  className="inline-flex items-center justify-center gap-3 h-16 rounded-full px-12 py-8 text-2xl font-bold border-2 border-brand text-brand hover:bg-brand/10 transition-all hover:scale-105 cursor-pointer"
                >
                  Practice
                  <svg className="ml-2 w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </Link>
              </div>
              
              {/* Player ELO Display */}
              {userRating !== null && (
                <div className="flex items-center gap-3 px-6 py-3 rounded-full bg-gradient-to-r from-brand/10 to-brand-secondary/10 border border-brand/30">
                  <svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <div className="text-center">
                    <span className="text-sm text-ink-soft">Your ELO:</span>
                    <span className="ml-2 text-xl font-bold text-brand">{userRating}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-gradient-to-br from-brand/10 to-brand-secondary/10 border-2 border-brand/30">
                <div className="text-center space-y-3">
                  <h3 className="text-xl font-bold text-ink">Ready to Battle?</h3>
                  <p className="text-ink-soft">Create a free account to start competing</p>
                </div>
                <LoginButton />
              </div>
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg px-6 py-4" asChild>
                <Link href="/social">
                  View Leaderboard
                </Link>
              </Button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
