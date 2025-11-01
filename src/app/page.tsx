"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { LoginButton } from "@/components/auth/LoginButton";
import { Button } from "@/components/ui";

export default function Home() {
  const { user } = useAuth();

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
        <div className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-4 py-2 mb-8">
          <span className="inline-block h-2 w-2 rounded-full bg-brand animate-pulse" />
          <span className="text-sm font-medium text-brand">Real-time competitive math battles</span>
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-ink mb-6 tracking-tight">
          Master Math Through
          <span className="block text-brand">Real Competition</span>
        </h1>

        <p className="text-lg sm:text-xl text-ink-soft max-w-2xl mx-auto mb-12">
          Face off in lightning-fast 1v1 math battles. Climb the leaderboard with your Elo rating. 
          Sharpen your skills in real-time against players worldwide.
        </p>

        <div className="flex flex-col items-center justify-center gap-6">
          {user ? (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Button size="lg" className="w-full sm:w-auto text-lg px-8 py-6" asChild>
                <Link href="/play">
                  Enter Arena
                  <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg px-8 py-6" asChild>
                <Link href="/social">
                  View Leaderboard
                </Link>
              </Button>
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

        {/* Features grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20">
          <div className="p-6 rounded-2xl bg-surface border border-border hover:border-brand/50 transition">
            <div className="h-12 w-12 rounded-xl bg-brand/10 flex items-center justify-center mb-4 mx-auto">
              <svg className="w-6 h-6 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="font-semibold text-ink mb-2">Lightning Fast</h3>
            <p className="text-sm text-ink-soft">Real-time battles with instant matching and live opponent tracking</p>
          </div>

          <div className="p-6 rounded-2xl bg-surface border border-border hover:border-brand/50 transition">
            <div className="h-12 w-12 rounded-xl bg-brand/10 flex items-center justify-center mb-4 mx-auto">
              <svg className="w-6 h-6 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="font-semibold text-ink mb-2">Elo Ranking</h3>
            <p className="text-sm text-ink-soft">Fair competitive rating system tracks your skill progression</p>
          </div>

          <div className="p-6 rounded-2xl bg-surface border border-border hover:border-brand/50 transition">
            <div className="h-12 w-12 rounded-xl bg-brand/10 flex items-center justify-center mb-4 mx-auto">
              <svg className="w-6 h-6 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <h3 className="font-semibold text-ink mb-2">Multiple Modes</h3>
            <p className="text-sm text-ink-soft">Practice solo or compete in ranked battles with varied difficulty</p>
          </div>
        </div>
      </div>
    </div>
  );
}
