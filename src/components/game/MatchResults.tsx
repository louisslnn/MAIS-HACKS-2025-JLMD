"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui";
import type { MatchDocument } from "@/lib/game/types";

interface MatchResultsProps {
  match: MatchDocument;
  userId: string;
  onPlayAgain: () => void;
}

interface RatingChange {
  oldRating: number;
  newRating: number;
  delta: number;
}

export function MatchResults({ match, userId, onPlayAgain }: MatchResultsProps) {
  const [ratingChange, setRatingChange] = useState<RatingChange | null>(null);
  const [loading, setLoading] = useState(true);

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

  const player = match.players[userId];
  const opponentId = match.playerIds.find((id) => id !== userId);
  const opponent = opponentId ? match.players[opponentId] : null;

  if (!player || !opponent) {
    return null;
  }

  const playerWon = player.correctCount > opponent.correctCount ||
    (player.correctCount === opponent.correctCount && player.totalTimeMs < opponent.totalTimeMs);
  const isDraw = player.correctCount === opponent.correctCount && 
    Math.abs(player.totalTimeMs - opponent.totalTimeMs) <= 100;

  const result = isDraw ? "Draw" : playerWon ? "Victory!" : "Defeat";
  const resultColor = isDraw ? "text-yellow-600" : playerWon ? "text-green-600" : "text-red-600";
  const bgColor = isDraw ? "bg-yellow-50" : playerWon ? "bg-green-50" : "bg-red-50";

  return (
    <div className="space-y-6">
      {/* Result Header */}
      <div className={`rounded-2xl ${bgColor} p-8 text-center`}>
        <h2 className={`text-4xl font-bold ${resultColor}`}>{result}</h2>
        {loading && (
          <p className="mt-4 text-sm text-ink-soft">Calculating rating change...</p>
        )}
        {!loading && ratingChange && (
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

      {/* Match Statistics */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-ink-subtle mb-3">You</p>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-ink-soft">Score</span>
              <span className="font-semibold text-ink">{player.score}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-soft">Correct Answers</span>
              <span className="font-semibold text-ink">{player.correctCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-soft">Total Time</span>
              <span className="font-semibold text-ink">
                {(player.totalTimeMs / 1000).toFixed(1)}s
              </span>
            </div>
          </div>
        </div>

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
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 justify-center">
        <Button size="lg" onClick={onPlayAgain}>
          Play Again
        </Button>
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
    </div>
  );
}
