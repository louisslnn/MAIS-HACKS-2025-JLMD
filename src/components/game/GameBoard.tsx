"use client";

import { useMemo } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useMatch } from "@/contexts/match-context";
import { AnswerInput } from "./AnswerInput";
import { RoundTimer } from "./RoundTimer";
import type { MatchDocument, RoundDocument, AnswerDocument } from "@/lib/game/types";

interface GameBoardProps {
  match: MatchDocument;
  activeRound: RoundDocument | undefined;
  answers: Record<string, AnswerDocument[]>;
}

export function GameBoard({ match, activeRound, answers }: GameBoardProps) {
  const { user } = useAuth();
  const { opponentState } = useMatch();
  const currentUserId = user?.uid;

  const currentUserAnswer = useMemo(() => {
    if (!activeRound) return null;
    const roundAnswers = answers[activeRound.id] || [];
    // For practice mode, use solo player ID; for real matches, use current user ID
    const searchId = match.mode === "solo" ? match.playerIds[0] : currentUserId;
    if (!searchId) return null;
    return roundAnswers.find((a) => a.uid === searchId) || null;
  }, [activeRound, currentUserId, answers, match.mode, match.playerIds]);

  const opponentId = useMemo(() => {
    if (!match.playerIds || !currentUserId) return null;
    return match.playerIds.find((id) => id !== currentUserId) || null;
  }, [match.playerIds, currentUserId]);

  const opponentAnswer = useMemo(() => {
    if (!activeRound || !opponentId) return null;
    const roundAnswers = answers[activeRound.id] || [];
    return roundAnswers.find((a) => a.uid === opponentId) || null;
  }, [activeRound, opponentId, answers]);

  const isIntegral = activeRound?.canonical?.type === "integral";
  const roundLocked = activeRound?.status === "locked";
  
  // Check if round has expired (even if status isn't locked yet)
  const roundExpired = activeRound?.endsAt 
    ? new Date(activeRound.endsAt).getTime() <= Date.now()
    : false;
  const canSubmit = !roundLocked && !roundExpired && !currentUserAnswer;

  if (!activeRound) {
    return (
      <div className="text-center py-8">
        <p className="text-ink-soft">Waiting for next round...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Question Card */}
      <div className="relative rounded-2xl bg-gradient-to-br from-brand/5 to-brand-secondary/5 p-8 border border-brand/20">
        <div className="absolute top-4 right-4">
          {activeRound.endsAt && <RoundTimer endsAt={activeRound.endsAt} />}
        </div>
        
        <div className="mb-4">
          <span className="inline-block px-3 py-1 rounded-full bg-brand/10 text-brand text-xs font-medium uppercase tracking-wider">
            Round {activeRound.id}
          </span>
        </div>
        
        <div className="text-4xl sm:text-5xl font-bold text-ink mb-8 font-mono">
          {activeRound.prompt}
        </div>

        {/* Answer Input */}
        {canSubmit && (
          <AnswerInput
            key={activeRound.id}
            matchId={match.id}
            roundId={activeRound.id}
            isIntegral={isIntegral}
            disabled={roundExpired || roundLocked}
          />
        )}
        
        {/* Show time's up message if expired but not locked yet */}
        {roundExpired && !roundLocked && !currentUserAnswer && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-center">
            <p className="text-red-700 font-semibold">Time&apos;s Up! Round is ending...</p>
          </div>
        )}

        {/* Submission Status */}
        {currentUserAnswer && (
          <div className="rounded-xl bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 p-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <p className="text-blue-900 font-semibold">Answer Submitted: {currentUserAnswer.value}</p>
            </div>
            {roundLocked && currentUserAnswer.correct !== undefined && (
              <div className={`mt-2 text-sm font-medium ${currentUserAnswer.correct ? "text-green-700" : "text-red-700"}`}>
                {currentUserAnswer.correct ? "✓ Correct!" : "✗ Incorrect"}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Opponent Card */}
      {opponentId && (
        <div className="rounded-xl border border-border bg-surface p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-ink">Opponent</h3>
            {opponentState && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-50">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-medium text-green-700">
                  Round {opponentState.currentRound}
                </span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {opponentAnswer ? (
              <>
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-full bg-brand/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-brand" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <div>
                  <p className="font-medium text-ink">Submitted</p>
                  {roundLocked && opponentAnswer.correct !== undefined && (
                    <p className={`text-sm ${opponentAnswer.correct ? "text-green-600" : "text-red-600"}`}>
                      {opponentAnswer.correct ? "Correct" : "Incorrect"}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-full bg-ink-subtle/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-ink-subtle animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                </div>
                <p className="text-ink-soft">Working on answer...</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Round Results */}
      {roundLocked && currentUserAnswer && opponentAnswer && (
        <div className="rounded-xl bg-surface-muted/50 border border-border p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-subtle mb-4">
            Round Complete
          </h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="text-center p-4 rounded-lg bg-surface border border-border">
              <p className="text-xs text-ink-soft mb-2">You</p>
              <div className={`text-2xl font-bold ${currentUserAnswer.correct ? "text-green-600" : "text-red-600"}`}>
                {currentUserAnswer.correct ? "✓" : "✗"}
              </div>
              <p className="text-sm text-ink-soft mt-1">
                {(currentUserAnswer.timeMs / 1000).toFixed(1)}s
              </p>
            </div>
            <div className="text-center p-4 rounded-lg bg-surface border border-border">
              <p className="text-xs text-ink-soft mb-2">Opponent</p>
              <div className={`text-2xl font-bold ${opponentAnswer.correct ? "text-green-600" : "text-red-600"}`}>
                {opponentAnswer.correct ? "✓" : "✗"}
              </div>
              <p className="text-sm text-ink-soft mt-1">
                {(opponentAnswer.timeMs / 1000).toFixed(1)}s
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

