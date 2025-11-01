"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";
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
  const router = useRouter();
  const [ratingChange, setRatingChange] = useState<RatingChange | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRatingChange() {
      if (!firestore || !userId || !match.id) return;

      try {
        const matchRef = doc(firestore, "matches", match.id);
        
        // Check if rating changes are already stored in the match document
        const matchData = match as any;
        if (matchData.ratingChanges && matchData.ratingChanges[userId]) {
          const change = matchData.ratingChanges[userId];
          setRatingChange({
            oldRating: change.oldRating,
            newRating: change.newRating,
            delta: change.delta,
          });
          setLoading(false);
          return;
        }
        
        // Otherwise, poll the match document for rating changes (backend is calculating)
        let attempts = 0;
        const maxAttempts = 10;
        let delay = 300; // Start with 300ms
        
        while (attempts < maxAttempts) {
          const matchSnap = await getDoc(matchRef);
          
          if (matchSnap.exists()) {
            const matchData = matchSnap.data() as any;
            
            // Check if rating changes are now available
            if (matchData.ratingChanges && matchData.ratingChanges[userId]) {
              const change = matchData.ratingChanges[userId];
              setRatingChange({
                oldRating: change.oldRating,
                newRating: change.newRating,
                delta: change.delta,
              });
              setLoading(false);
              return;
            }
          }
          
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, delay));
          delay = Math.min(delay * 1.5, 2000); // Max 2 seconds
          attempts++;
        }
        
        // Fallback: use player's ratingAtStart if rating changes not available
        const player = match.players[userId];
        const oldRating = player?.ratingAtStart || 1000;
        setRatingChange({
          oldRating,
          newRating: oldRating,
          delta: 0,
        });
      } catch (error) {
        console.error("Failed to fetch rating change:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchRatingChange();
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
        <Button size="lg" variant="outline" onClick={() => router.push("/social")}>
          View Leaderboard
        </Button>
        <Button size="lg" variant="outline" onClick={() => router.push("/")}>
          Home
        </Button>
      </div>
    </div>
  );
}

