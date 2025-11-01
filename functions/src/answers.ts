import { Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";

import { db, env } from "./config";
import type { MatchDocument } from "./lib/types";
import { resolveCanonicalAnswer, sanitizeNumericInput } from "./lib/utils";
import { evaluateIntegralAnswer } from "./lib/openai";
import { getProblemById } from "./lib/problems";

const submitAnswerSchema = z.object({
  matchId: z.string().min(1),
  roundId: z.string().min(1),
  value: z.union([z.string(), z.number()]),
});

function ensureParticipant(uid: string, match: MatchDocument) {
  if (!match.playerIds.includes(uid)) {
    throw new HttpsError(
      "permission-denied",
      "You are not a participant in this match.",
    );
  }
}

export const submitAnswer = onCall(
  { enforceAppCheck: false, region: "us-central1" },
  async (request) => {
    try {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "Sign in to submit answers.");
      }

      const payload = submitAnswerSchema.safeParse(request.data);
      if (!payload.success) {
        throw new HttpsError("invalid-argument", "Invalid submit payload.");
      }

      const { matchId, roundId, value } = payload.data;
      const uid = request.auth.uid;

      const matchRef = db.collection("matches").doc(matchId);
      const roundRef = matchRef.collection("rounds").doc(roundId);
      const answerRef = roundRef.collection("answers").doc(uid);

      const now = Timestamp.now();
      let inTime = false;
      let timeMs = 0;
      let correct = false;

      await db.runTransaction(async (tx) => {
        const matchSnap = await tx.get(matchRef);
        if (!matchSnap.exists) {
          throw new HttpsError("not-found", "Match not found.");
        }

        const match = matchSnap.data() as MatchDocument;
        ensureParticipant(uid, match);

        const roundSnap = await tx.get(roundRef);
        if (!roundSnap.exists) {
          throw new HttpsError("not-found", "Round not found.");
        }

        const round = roundSnap.data() as {
          status: string;
          startAt: Timestamp;
          endsAt: Timestamp;
          canonical: { type: string; params: Record<string, unknown> };
        };

        if (round.status !== "active") {
          logger.info("Answer submission rejected - round not active", {
            matchId,
            roundId,
            uid,
            roundStatus: round.status,
          });
          throw new HttpsError(
            "failed-precondition",
            round.status === "locked" 
              ? "Time's up! This round is no longer accepting answers."
              : "Round is no longer accepting answers.",
          );
        }

        const startAt = round.startAt.toMillis();
        const endsAt = round.endsAt.toMillis();
        const nowMs = now.toMillis();

        timeMs = Math.max(0, nowMs - startAt);
        inTime = nowMs <= endsAt;

        // Get opponent's answer BEFORE any writes (Firestore transaction requirement)
        const opponentId = match.playerIds.find((id) => id !== uid);
        let opponentAnswer = null;
        
        if (opponentId) {
          const opponentAnswerRef = roundRef.collection("answers").doc(opponentId);
          opponentAnswer = await tx.get(opponentAnswerRef);
        }

        // Determine problem type from canonical
        const problemType = round.canonical?.type || 'unknown';
        const isIntegral = problemType === 'integral';
        const isAddition = problemType === 'addition';

        correct = await (async () => {
          try {
            if (isAddition) {
            // Simple numeric comparison for addition
            const cleanValue = sanitizeNumericInput(value);
            const numericValue = Number(cleanValue);
            
            try {
              const canonicalAnswer = await resolveCanonicalAnswer(round.canonical);
              return inTime && numericValue === canonicalAnswer;
            } catch (error) {
              logger.error("Failed to resolve canonical answer for addition", {
                error: error instanceof Error ? error.message : String(error),
                canonical: round.canonical,
              });
              // Fallback: try to get answer from problem database directly
              const problemId = round.canonical?.params?.problemId as number | undefined;
              if (problemId) {
                const problem = getProblemById('addition', problemId);
                if (problem && typeof problem.answer === 'number') {
                  return inTime && numericValue === problem.answer;
                }
              }
              // If all else fails, return false
              return false;
            }
          } else if (isIntegral) {
            // Use OpenAI for integral evaluation
            const problemId = round.canonical?.params?.problemId as number;
            const category = (round.canonical?.params?.category as string) || 'integrals';
            
            if (problemId && category === 'integrals') {
              const problem = getProblemById('integrals', problemId);
              if (problem && typeof problem.answer === 'string') {
                try {
                  const evaluation = await evaluateIntegralAnswer(
                    problem.problem,
                    problem.answer,
                    String(value),
                    env.openaiApiKey,
                  );
                  return inTime && evaluation.correct;
                } catch (error) {
                  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                  logger.error("OpenAI evaluation failed", { error: errorMessage });
                  // Fallback: basic string comparison
                  return inTime && String(value).trim().toLowerCase() === problem.answer.trim().toLowerCase();
                }
              }
            }
            // Fallback for invalid canonical data
            logger.warn("Invalid integral canonical data", { canonical: round.canonical });
            return false;
          } else {
            // Legacy numeric evaluation (for old rounds with "arith.basic" type)
            const cleanValue = sanitizeNumericInput(value);
            const numericValue = Number(cleanValue);
            
            try {
              const canonicalAnswer = await resolveCanonicalAnswer(round.canonical);
              return inTime && numericValue === canonicalAnswer;
            } catch (error) {
              logger.error("Failed to resolve canonical answer for legacy type", {
                error: error instanceof Error ? error.message : String(error),
                canonical: round.canonical,
              });
              return false;
            }
          }
          } catch (error) {
            logger.error("Unexpected error in answer evaluation", {
              error: error instanceof Error ? error.message : String(error),
              problemType,
              canonical: round.canonical,
            });
            return false;
          }
        })();

        // Now perform all writes (after all reads are done)
        tx.set(answerRef, {
          submittedAt: now,
          value: String(value),
          timeMs,
          correct,
          judgedAt: now,
          judgeVersion: isIntegral ? 2 : 1, // Version 2 for OpenAI evaluation
        });

        // Lock the round if both players have submitted or time elapsed
        const bothAnswered = opponentAnswer?.exists || false;
        const timeExpired = nowMs >= endsAt;

        if (bothAnswered || timeExpired) {
          tx.update(roundRef, {
            status: "locked",
            lockedAt: now,
            updatedAt: now,
          });
          tx.update(matchRef, { updatedAt: now });
        }
      });

      logger.info("Answer received", {
        matchId,
        roundId,
        uid,
        correct,
        inTime,
        timeMs,
      });

      return { correct, inTime, timeMs };
    } catch (error) {
      // Log the error with full context
      logger.error("Submit answer error", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        matchId: request.data?.matchId,
        roundId: request.data?.roundId,
        uid: request.auth?.uid,
      });
      
      // Re-throw HttpsError as-is
      if (error instanceof HttpsError) {
        throw error;
      }
      
      // Wrap other errors
      throw new HttpsError(
        "internal",
        error instanceof Error ? error.message : "An error occurred while submitting your answer.",
      );
    }
  },
);
