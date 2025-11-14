"use client";

import { useState, useEffect, useMemo } from "react";

import { Button } from "@/components/ui";
import { useMatch } from "@/contexts/match-context";
import { useAuth } from "@/components/auth/AuthProvider";
import { GameBoard } from "@/components/game/GameBoard";
import { MatchResults } from "@/components/game/MatchResults";
import { MatchmakingLobby } from "@/components/game/MatchmakingLobby";
import { cn } from "@/lib/utils";

const modeOptions = [
  {
    id: "ranked",
    label: "Ranked",
    caption: "Climb the ladder against live opponents.",
  },
  {
    id: "practice",
    label: "Practice",
    caption: "Warm up solo with adaptive rounds.",
  },
] as const;

const problemCategories = [
  {
    id: "addition" as const,
    label: "Addition",
    caption: "Simple math problems",
  },
  {
    id: "integrals" as const,
    label: "Integrals",
    caption: "Calculus problems",
  },
] as const;

type ModeOption = (typeof modeOptions)[number]["id"];
type ProblemCategory = (typeof problemCategories)[number]["id"];

export default function PlayPage() {
  const { user, loading } = useAuth();
  const [selected, setSelected] = useState<ModeOption>("ranked");
  const [problemCategory, setProblemCategory] = useState<ProblemCategory>("addition");
  const [writingMode, setWritingMode] = useState<boolean>(false);
  const { state, startLocalMatch, requestMatch, matchmakingStatus, matchmakingError, cancelMatchmaking, quitMatch } = useMatch();
  const [quickParam, setQuickParam] = useState<string | null>(null);
  const [quickMatchRequested, setQuickMatchRequested] = useState(false);

  const handlePlay = async () => {
    if (!user) {
      return; // Should never happen due to guard, but safety check
    }

    if (selected === "ranked") {
      await requestMatch(problemCategory);
    } else {
      startLocalMatch("solo", { writingMode, problemCategory });
    }
  };

  const activeRoundId = state.match?.activeRoundId;
  const activeRound = activeRoundId
    ? state.rounds.find((round) => round.id === activeRoundId)
    : state.rounds.find((round) => round.status === "active");
  const hasActiveMatch = useMemo(() => {
    if (!state.match || state.match.status !== "active") {
      return false;
    }

    if (state.match.mode === "solo") {
      return true;
    }

    return !state.match.id?.startsWith("mock-") && !state.match.id?.startsWith("ranked-demo-");
  }, [state.match]);

  const isMatchCompleted = state.match?.status === "completed";
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setQuickParam(params.get("quick"));
  }, []);
  
  // Debug logging for match status
  useEffect(() => {
    if (state.match) {
      console.log("[PlayPage] Match status:", state.match.status, "isMatchCompleted:", isMatchCompleted);
    }
  }, [state.match?.status, isMatchCompleted, state.match]);

  useEffect(() => {
    if (quickParam && selected !== "ranked") {
      setSelected("ranked");
    }
  }, [quickParam, selected]);

  useEffect(() => {
    if (!user) return;
    if (!quickParam || (quickParam !== "1" && quickParam.toLowerCase() !== "true")) return;
    if (quickMatchRequested) return;
    if (matchmakingStatus !== "idle") return;
    if (hasActiveMatch) return;

    (async () => {
      try {
        await requestMatch(problemCategory);
      } finally {
        setQuickMatchRequested(true);
      }
    })();
  }, [user, quickParam, quickMatchRequested, matchmakingStatus, hasActiveMatch, requestMatch, problemCategory]);

  const handlePlayAgain = async () => {
    // Reset to mode selection by clearing active match
    await cancelMatchmaking();
  };

  // Require authentication to access this page
  if (loading) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-brand border-t-transparent"></div>
          <p className="text-ink-soft">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-6">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-brand/10 mb-4">
            <svg className="w-10 h-10 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-ink">Sign In Required</h2>
          <p className="text-lg text-ink-soft">
            Create a free account to play competitive math battles and track your progress on the leaderboard.
          </p>
          <div className="pt-4">
            <p className="text-sm text-ink-soft mb-4">Click the &quot;Sign In&quot; button in the top right to get started</p>
          </div>
          <div className="flex flex-col gap-3">
            <Button onClick={() => window.location.href = '/'} size="lg" variant="outline">
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show match results if completed
  if (isMatchCompleted && state.match && user) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center gap-12 px-4 py-16">
        <div className="flex w-full flex-col gap-6 rounded-2xl border border-border bg-surface p-6 shadow-[0_25px_80px_-40px_rgba(15,23,42,0.65)]">
          <div className="text-center">
            <div className="inline-block px-4 py-1 rounded-full bg-surface-muted text-xs uppercase tracking-[0.3em] text-ink-subtle mb-4">
              Match Complete
            </div>
            <h1 className="text-2xl font-semibold text-ink">
              {state.match.mode === "solo" ? "Practice Complete" : "Match Results"}
            </h1>
          </div>
          <MatchResults 
            match={state.match} 
            userId={user.uid} 
            onPlayAgain={handlePlayAgain}
            aiFeedback={state.practiceFeedback}
          />
        </div>
      </div>
    );
  }

  // Check if we have an active match (include practice mode)
  // Show matchmaking lobby (only if not found yet and no active match)
  if (matchmakingStatus === "searching" && !hasActiveMatch) {
    return (
      <MatchmakingLobby 
        category={problemCategory}
        onCancel={cancelMatchmaking}
      />
    );
  }

  if (matchmakingStatus === "error" && !hasActiveMatch) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center gap-8 px-4 py-16">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-semibold text-red-500">Matchmaking Error</h2>
          <p className="text-ink-soft">{matchmakingError || "Failed to start matchmaking"}</p>
          <Button onClick={() => { cancelMatchmaking(); setSelected("ranked"); }} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Show game mode selection if no active match
  if (!hasActiveMatch) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-ink mb-3">Choose Your Battle</h1>
            <p className="text-ink-soft">Select a game mode to begin</p>
          </div>

          {/* Mode Selection */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {modeOptions.map((mode) => {
              const isActive = mode.id === selected;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setSelected(mode.id)}
                  className={cn(
                    "group relative overflow-hidden rounded-2xl p-8 text-left transition-all",
                    "border-2 hover:scale-[1.02] active:scale-[0.98]",
                    isActive
                      ? "border-brand bg-gradient-to-br from-brand/10 to-brand-secondary/10 shadow-lg shadow-brand/20"
                      : "border-border bg-surface hover:border-brand/50"
                  )}
                >
                  <div className="relative z-10">
                    <div className={cn(
                      "inline-flex h-12 w-12 items-center justify-center rounded-xl mb-4 transition",
                      isActive ? "bg-brand text-white" : "bg-surface-muted text-ink-subtle group-hover:bg-brand/10"
                    )}>
                      {mode.id === "ranked" ? (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      )}
                    </div>
                    <h3 className="text-xl font-bold text-ink mb-2">{mode.label}</h3>
                    <p className="text-ink-soft">{mode.caption}</p>
                    {isActive && (
                      <div className="mt-4 flex items-center gap-2 text-brand text-sm font-medium">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Selected
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Problem Category Selection */}
          {(selected === "ranked" || selected === "practice") && (
            <div className="mb-8 p-6 rounded-2xl bg-surface border border-border">
              <h3 className="text-lg font-semibold text-ink mb-4">Choose Problem Type</h3>
              <div className="grid grid-cols-2 gap-4">
                {problemCategories.map((category) => {
                  const isActive = category.id === problemCategory;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setProblemCategory(category.id)}
                      className={cn(
                        "rounded-xl border-2 p-4 text-left transition",
                        isActive
                          ? "border-brand bg-brand/5"
                          : "border-border hover:border-brand/50 bg-surface-muted/50"
                      )}
                    >
                      <p className="font-semibold text-ink">{category.label}</p>
                      <p className="text-sm text-ink-soft mt-1">{category.caption}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Writing Mode Toggle (only for practice) */}
          {selected === "practice" && (
            <div className="mb-8 p-6 rounded-2xl bg-surface border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-ink">📝 Writing Mode</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setWritingMode(!writingMode)}
                  className={cn(
                    "relative inline-flex h-8 w-14 items-center rounded-full transition-colors",
                    writingMode ? "bg-brand" : "bg-gray-300"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-6 w-6 transform rounded-full bg-white transition-transform",
                      writingMode ? "translate-x-7" : "translate-x-1"
                    )}
                  />
                </button>
              </div>
              {writingMode && (
                <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <p className="text-sm text-blue-900">
                    {problemCategory === "addition" 
                      ? "You'll solve 15 addition problems (5 pages of 3 each)"
                      : "You'll solve 3 integral problems (1 per page)"}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Start Button */}
          <div className="text-center">
            <Button 
              size="lg" 
              onClick={handlePlay}
              className="px-12 py-6 text-lg"
            >
              Start {selected === "ranked" ? "Ranked" : "Practice"} Battle
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Button>
            
            {selected === "ranked" && (
              <p className="mt-4 text-sm text-ink-soft">
                You&apos;ll be matched with a player of similar skill level
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show active game (only if we have a real match)
  if (!state.match) {
    return null; // Shouldn't happen, but safety check
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-surface to-surface-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Match Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-xs text-ink-soft">Match ID: {state.match.id.slice(0, 8)}</p>
            </div>
          </div>
          
          {/* Quit Match Button */}
          {state.match.mode !== "solo" && (
            <Button 
              onClick={() => {
                if (confirm("Are you sure you want to quit? This will count as a loss.")) {
                  quitMatch();
                }
              }}
              variant="outline"
              size="sm"
              className="text-red-600 hover:bg-red-50 border-red-200"
            >
              Quit Match
            </Button>
          )}
        </div>

        {/* Player Scores */}
        <div className="grid gap-4 md:grid-cols-2 mb-8">
          {state.match.playerIds.map((playerId) => {
            const player = state.match?.players[playerId];
            if (!player) return null;
            const isCurrentUser = user && playerId === user.uid;

            return (
              <div
                key={playerId}
                className={`rounded-2xl p-6 transition ${
                  isCurrentUser
                    ? 'bg-gradient-to-br from-brand/10 to-brand-secondary/10 border-2 border-brand/30'
                    : 'bg-surface border border-border'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center text-white font-semibold ${
                      isCurrentUser ? 'bg-brand' : 'bg-ink-subtle'
                    }`}>
                      {player.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-ink">
                        {player.displayName}
                        {isCurrentUser && <span className="ml-2 text-xs text-brand">(You)</span>}
                      </p>
                      <p className="text-xs text-ink-soft">
                        {player.correctCount} correct
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-ink">{player.score}</p>
                    <p className="text-xs text-ink-soft">points</p>
                  </div>
                </div>
                
                {/* Progress bar */}
                <div className="w-full bg-surface-muted rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all ${isCurrentUser ? 'bg-brand' : 'bg-ink-subtle'}`}
                    style={{ width: `${(player.correctCount / (state.match?.settings.rounds || 10)) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Game Board */}
        <GameBoard 
          match={state.match} 
          activeRound={activeRound}
          answers={state.answers}
        />
      </div>
    </div>
  );
}
