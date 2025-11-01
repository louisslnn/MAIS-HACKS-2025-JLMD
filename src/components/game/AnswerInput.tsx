"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { submitAnswer } from "@/lib/firebase/functions";
import { useAuth } from "@/components/auth/AuthProvider";
import { useMatch } from "@/contexts/match-context";

interface AnswerInputProps {
  matchId: string;
  roundId: string;
  isIntegral: boolean;
  disabled?: boolean;
  onSubmitted?: () => void;
}

export function AnswerInput({ 
  matchId, 
  roundId, 
  isIntegral, 
  disabled = false,
  onSubmitted 
}: AnswerInputProps) {
  const { user } = useAuth();
  const { submitPracticeAnswer } = useMatch();
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim() || submitting || submitted || !user) return;

    setSubmitting(true);
    setError("");

    try {
      const value = isIntegral ? answer.trim() : Number(answer.trim());
      
      // Check if this is a practice match (local-only)
      const isPracticeMatch = matchId.startsWith("practice-");
      
      if (isPracticeMatch) {
        // For practice mode, handle answer locally
        submitPracticeAnswer(roundId, value);
        setSubmitted(true);
        if (onSubmitted) {
          onSubmitted();
        }
      } else {
        // For real matches, submit to Cloud Function
        await submitAnswer({
          matchId,
          roundId,
          value,
        });

        setSubmitted(true);
        if (onSubmitted) {
          onSubmitted();
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to submit answer";
      setError(errorMessage);
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center">
        <p className="text-green-700 font-semibold">Answer Submitted!</p>
        <p className="text-sm text-green-600 mt-1">
          {matchId.startsWith("practice-") ? "Great job! Next round starting..." : "Waiting for opponent..."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-ink mb-2">
          Your Answer {isIntegral && "(LaTeX format)"}
        </label>
        <input
          type={isIntegral ? "text" : "number"}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder={isIntegral ? "e.g., \\frac{x^2}{2} + c" : "Enter number"}
          disabled={disabled || submitting || submitted}
          className="w-full px-4 py-3 border border-border rounded-lg bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50 disabled:cursor-not-allowed"
          required
        />
      </div>
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
      <Button 
        type="submit" 
        disabled={!answer.trim() || submitting || submitted || disabled}
        className="w-full"
      >
        {submitting ? "Submitting..." : "Submit Answer"}
      </Button>
    </form>
  );
}

