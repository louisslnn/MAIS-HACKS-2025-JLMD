"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { Button, Dialog } from "@/components/ui";
import type { MatchDocument } from "@/lib/game/types";
import { triggerMatchEmote } from "@/lib/firebase/functions";

interface MatchResultsProps {
  match: MatchDocument;
  userId: string;
  onPlayAgain: () => void;
  aiFeedback?: string | null;
}

interface RatingChange {
  oldRating: number;
  newRating: number;
  delta: number;
}

const EMOTES = [
  {
    id: "giphy",
    label: "Fireworks",
    src: "/Gifs/giphy.gif",
  },
  {
    id: "math-zach-galifianakis",
    label: "Genius Mode",
    src: "/Gifs/math-zach-galifianakis.gif",
  },
  {
    id: "maths",
    label: "Brainwave",
    src: "/Gifs/maths.gif",
  },
  {
    id: "ratio-maths",
    label: "Victory Dance",
    src: "/Gifs/ratio-maths.gif",
  },
] as const;

type EmoteId = (typeof EMOTES)[number]["id"];

export function MatchResults({ match, userId, onPlayAgain, aiFeedback }: MatchResultsProps) {
  const [ratingChange, setRatingChange] = useState<RatingChange | null>(null);
  const [loading, setLoading] = useState(true);
  const [storedFeedback, setStoredFeedback] = useState<string | null>(null);
  const celebration = match.celebration;
  const initialEmote = celebration?.emoteId && EMOTES.some((emote) => emote.id === celebration.emoteId)
    ? (celebration.emoteId as EmoteId)
    : null;
  const [isEmoteDialogOpen, setIsEmoteDialogOpen] = useState(false);
  const [isSendingEmote, setIsSendingEmote] = useState(false);
  const [emoteError, setEmoteError] = useState<string | null>(null);
  const [activeEmote, setActiveEmote] = useState<EmoteId | null>(initialEmote);
  const [showCelebration, setShowCelebration] = useState(Boolean(initialEmote));

  useEffect(() => {
    if (!userId) return;

    const matchData = match as unknown as {
      ratingChanges?: Record<string, RatingChange>;
      ratingProcessed?: boolean;
    };

    const change = matchData.ratingChanges?.[userId];

    if (change) {
      setRatingChange({
        oldRating: change.oldRating,
        newRating: change.newRating,
        delta: change.delta,
      });
      setLoading(false);
      return;
    }

    if (matchData.ratingProcessed === true) {
      const player = match.players[userId];
      if (player) {
        setRatingChange({
          oldRating: player.ratingAtStart,
          newRating: player.ratingAtStart,
          delta: 0,
        });
      }
      setLoading(false);
      return;
    }

    setRatingChange(null);
    setLoading(true);
  }, [match, userId]);

  // Load AI feedback - now passed as prop from context, no localStorage needed
  useEffect(() => {
    if (aiFeedback && !storedFeedback) {
      console.log("[MatchResults] Received feedback from prop:", aiFeedback);
      setStoredFeedback(aiFeedback);
    }
  }, [aiFeedback, storedFeedback]);

  useEffect(() => {
    const emoteId =
      celebration?.emoteId && EMOTES.some((emote) => emote.id === celebration.emoteId)
        ? (celebration.emoteId as EmoteId)
        : null;

    if (emoteId) {
      setActiveEmote(emoteId);
      setShowCelebration(true);
      const timer = setTimeout(() => setShowCelebration(false), 5000);
      return () => clearTimeout(timer);
    }

    setShowCelebration(false);
  }, [celebration?.emoteId, celebration?.triggeredAt]);

  // For solo/practice mode, use the first player ID if userId doesn't match
  const isSolo = match.mode === "solo";
  const actualPlayerId = isSolo && !match.players[userId] 
    ? match.playerIds[0] 
    : userId;
  
  const player = match.players[actualPlayerId];
  const opponentId = match.playerIds.find((id) => id !== actualPlayerId);
  const opponent = opponentId ? match.players[opponentId] : null;
  const celebrationEmote = useMemo(
    () => (activeEmote ? EMOTES.find((emote) => emote.id === activeEmote) ?? null : null),
    [activeEmote],
  );

  if (!player) {
    console.warn("MatchResults: No player found", { userId, actualPlayerId, playerIds: match.playerIds, players: Object.keys(match.players) });
    return (
      <div className="text-center p-8">
        <p className="text-red-500">Error: Player data not found</p>
        <p className="text-sm text-ink-soft mt-2">Player ID: {userId}</p>
        <p className="text-sm text-ink-soft">Available players: {Object.keys(match.players).join(", ")}</p>
      </div>
    );
  }
  
  // Debug log for practice mode
  if (isSolo) {
    console.log("MatchResults - Practice mode:", {
      correctCount: player.correctCount,
      score: player.score,
      totalRounds: match.settings.rounds,
      player,
    });
  }

  let playerWon = false;
  let isDraw = false;
  let result: string;
  let resultColor: string;
  let bgColor: string;
  
  if (isSolo) {
    // Practice mode: Show score-based feedback
    const totalRounds = match.settings.rounds || 10;
    const percentage = (player.correctCount / totalRounds) * 100;
    
    if (percentage >= 80) {
      result = "Excellent! 🌟";
      resultColor = "text-green-600";
      bgColor = "bg-green-50";
    } else if (percentage >= 60) {
      result = "Good Job! 👍";
      resultColor = "text-blue-600";
      bgColor = "bg-blue-50";
    } else {
      result = "Keep Practicing! 💪";
      resultColor = "text-yellow-600";
      bgColor = "bg-yellow-50";
    }
  } else {
    // Ranked mode: Show win/loss
    if (!opponent) return null;
    
    playerWon = player.correctCount > opponent.correctCount ||
      (player.correctCount === opponent.correctCount && player.totalTimeMs < opponent.totalTimeMs);
    isDraw = player.correctCount === opponent.correctCount && 
      Math.abs(player.totalTimeMs - opponent.totalTimeMs) <= 100;

    result = isDraw ? "Draw" : playerWon ? "Victory!" : "Defeat";
    resultColor = isDraw ? "text-yellow-600" : playerWon ? "text-green-600" : "text-red-600";
    bgColor = isDraw ? "bg-yellow-50" : playerWon ? "bg-green-50" : "bg-red-50";
  }

  const matchWinnerId = match.winner ?? null;
  const canTriggerEmote = !isSolo && !isDraw && matchWinnerId === actualPlayerId;
  const celebrationButtonDisabled = !canTriggerEmote || isSendingEmote;

  const handleOpenEmoteDialog = useCallback(() => {
    if (!canTriggerEmote) return;
    setEmoteError(null);
    setIsEmoteDialogOpen(true);
  }, [canTriggerEmote]);

  const handleCloseEmoteDialog = useCallback(() => {
    if (isSendingEmote) return;
    setIsEmoteDialogOpen(false);
    setEmoteError(null);
  }, [isSendingEmote]);

  const handleSendEmote = useCallback(
    async (emoteId: EmoteId) => {
      if (!canTriggerEmote) return;
      setIsSendingEmote(true);
      setEmoteError(null);
      const previousEmote = activeEmote;
      const previousVisibility = showCelebration;

      setActiveEmote(emoteId);
      setShowCelebration(true);
      try {
        await triggerMatchEmote({ matchId: match.id, emoteId });
        setIsEmoteDialogOpen(false);
      } catch (error) {
        console.error("Failed to trigger emote", error);
        const message =
          error instanceof Error ? error.message : "Failed to send emote. Please try again.";
        setEmoteError(message);
        setActiveEmote(previousEmote ?? initialEmote);
        setShowCelebration(previousVisibility);
      } finally {
        setIsSendingEmote(false);
      }
    },
    [canTriggerEmote, match.id, activeEmote, showCelebration, initialEmote],
  );

  return (
    <div className="space-y-6">
      {showCelebration && celebrationEmote && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 rounded-3xl bg-black/55 px-6 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-sm">
              <Image
                src={celebrationEmote.src}
              alt=""
                width={320}
                height={320}
                unoptimized
                className="max-h-[60vh] w-auto rounded-2xl object-contain"
              />
            <p className="sr-only">
              {celebrationEmote.label}
            </p>
          </div>
        </div>
      )}

      {/* Result Header */}
      <div className={`rounded-2xl ${bgColor} p-8 text-center`}>
        <h2 className={`text-4xl font-bold ${resultColor} mb-4`}>{result}</h2>
        
        {/* Score Display - Prominent for practice mode */}
        {isSolo && (
          <div className="mb-4">
            <p className="text-sm text-ink-soft mb-2">Final Score</p>
            <div className="text-6xl font-bold text-ink">
              {(player.correctCount ?? 0)}/{match.settings.rounds || 10}
            </div>
            <p className="text-lg text-ink-soft mt-2">
              {player.correctCount ?? 0} out of {match.settings.rounds || 10} correct
            </p>
            {player.correctCount === undefined && (
              <p className="text-xs text-red-500 mt-2">⚠️ Score not calculated yet</p>
            )}
          </div>
        )}
        
        {loading && (
          <p className="mt-4 text-sm text-ink-soft"></p>
        )}
        {!loading && ratingChange && !isSolo && (
          <div className="mt-4">
            <p className="text-sm text-ink-soft">Rating Change</p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="text-2xl font-semibold text-ink">{ratingChange.oldRating}</span>
              <span className="text-ink-soft">→</span>
              <span className="text-2xl font-semibold text-ink">{ratingChange.newRating}</span>
              <span className={`text-lg font-semibold ${ratingChange.delta >= 0 ? "text-green-600" : "text-red-600"}`}>
                ({ratingChange.delta >= 0 ? "+" : ""}{ratingChange.delta})
              </span>
            </div>
          </div>
        )}
      </div>

      {/* AI Feedback for Practice Mode */}
      {(() => {
        const feedbackToShow = aiFeedback || storedFeedback;
        console.log("[MatchResults] isSolo:", isSolo, "aiFeedback:", aiFeedback, "storedFeedback:", storedFeedback, "feedbackToShow:", feedbackToShow);
        
        if (isSolo && feedbackToShow) {
          return (
            <div className="rounded-xl border border-brand/20 bg-gradient-to-br from-brand/5 to-purple-50 p-6 mt-6">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-6 h-6 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <h3 className="text-lg font-semibold text-ink">AI Tutor Feedback</h3>
              </div>
              <div className="text-ink-soft leading-relaxed whitespace-pre-line">
                {feedbackToShow}
              </div>
            </div>
          );
        }
        return null;
      })()}

      {/* Match Statistics */}
      <div className={`grid gap-4 ${isSolo ? 'md:grid-cols-1' : 'md:grid-cols-2'}`}>
        <div className="rounded-xl border border-border bg-surface p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-ink-subtle mb-3">Your Performance</p>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-ink-soft">Final Score</span>
              <span className="text-3xl font-bold text-brand">{player.correctCount}/{match.settings.rounds || 10}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-soft">Correct Answers</span>
              <span className="font-semibold text-ink">{player.correctCount} / {match.settings.rounds || 10}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-soft">Accuracy</span>
              <span className="font-semibold text-ink">
                {((player.correctCount / (match.settings.rounds || 10)) * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-soft">Total Time</span>
              <span className="font-semibold text-ink">
                {(player.totalTimeMs / 1000).toFixed(1)}s
              </span>
            </div>
          </div>
        </div>

        {!isSolo && opponent && (
          <div className="rounded-xl border border-border bg-surface p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-ink-subtle mb-3">
              {opponent.displayName}
            </p>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-ink-soft">Score</span>
                <span className="font-semibold text-ink">{opponent.score}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-soft">Correct Answers</span>
                <span className="font-semibold text-ink">{opponent.correctCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-soft">Total Time</span>
                <span className="font-semibold text-ink">
                  {(opponent.totalTimeMs / 1000).toFixed(1)}s
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 justify-center">
        <Button size="lg" onClick={onPlayAgain}>
          Play Again
        </Button>
        {!isSolo && (
          <Button
            size="lg"
            variant="secondary"
            onClick={handleOpenEmoteDialog}
            disabled={celebrationButtonDisabled}
            title={canTriggerEmote ? "Celebrate your win with a global emote" : "Only the winner can trigger a victory emote"}
          >
            {isSendingEmote ? "Sending..." : "Celebrate"}
          </Button>
        )}
        <Button size="lg" variant="outline" asChild>
          <Link href="/social">
            View Social
          </Link>
        </Button>
        <Button size="lg" variant="outline" asChild>
          <Link href="/">
            Home
          </Link>
        </Button>
      </div>

      <Dialog open={isEmoteDialogOpen} onClose={handleCloseEmoteDialog} title="Victory Emotes">
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">
            Choose a celebratory emote to display on both screens. Emotes are limited to match winners.
          </p>
          {emoteError && (
            <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
              {emoteError}
            </p>
          )}
              <div className="grid gap-4 sm:grid-cols-2">
                {EMOTES.map((emote) => (
                  <button
                    key={emote.id}
                    type="button"
                    onClick={() => handleSendEmote(emote.id)}
                disabled={isSendingEmote}
                className="group relative overflow-hidden rounded-2xl border border-border bg-surface-muted p-3 transition hover:-translate-y-1 hover:border-brand hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-brand"
                >
                  <div className="flex flex-col items-center gap-2">
                    <Image
                      src={emote.src}
                    alt=""
                      width={180}
                      height={180}
                      unoptimized
                      className="h-32 w-auto rounded-xl object-contain"
                    />
                    <span className="sr-only">{emote.label}</span>
                  </div>
                </button>
            ))}
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={handleCloseEmoteDialog} disabled={isSendingEmote}>
              Close
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
