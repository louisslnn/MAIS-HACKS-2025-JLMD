/**
 * Generate feedback after a game using OpenAI
 * Called when a match with integrals is completed
 */

import { logger } from "firebase-functions";
import * as functions from "firebase-functions/v1";
import { z } from "zod";

import { db, env } from "./config";
import { generateGameFeedback } from "./lib/openai";
import { getProblemById } from "./lib/problems";
import type { MatchDocument } from "./lib/types";

const getFeedbackSchema = z.object({
  matchId: z.string().min(1),
});

export const getGameFeedback = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Sign in to get feedback.");
    }

    const payload = getFeedbackSchema.safeParse(data);
    if (!payload.success) {
      throw new functions.https.HttpsError("invalid-argument", "Invalid feedback request.");
    }

    const { matchId } = payload.data;
    const uid = context.auth.uid;

    const matchRef = db.collection("matches").doc(matchId);
    const matchSnap = await matchRef.get();

    if (!matchSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Match not found.");
    }

    const match = matchSnap.data() as MatchDocument;

    // Ensure user is a participant
    if (!match.playerIds.includes(uid)) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "You are not a participant in this match.",
      );
    }

    // Only generate feedback for completed matches with integrals
    if (match.status !== "completed") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Match must be completed to get feedback.",
      );
    }

    // Get all rounds
    const roundsSnap = await matchRef.collection("rounds").get();
    const rounds = roundsSnap.docs.map((doc) => doc.data());

    // Check if any rounds are integrals
    const hasIntegrals = rounds.some(
      (round) => round.canonical?.type === "integral",
    );

    if (!hasIntegrals) {
      return {
        feedback: "Great game! This match contained addition problems. For detailed feedback on integral problems, play a match with calculus questions.",
      };
    }

    // Collect answers for both players
    const [player1Id, player2Id] = match.playerIds;
    const player1Answers: Array<{
      problem: string;
      answer: string;
      correct: boolean;
    }> = [];
    const player2Answers: Array<{
      problem: string;
      answer: string;
      correct: boolean;
    }> = [];

    for (const round of rounds) {
      if (round.canonical?.type === "integral") {
        const problemId = round.canonical?.params?.problemId as number;
        const problem = getProblemById("integrals", problemId);

        if (problem) {
          // Get player 1 answer
          const answer1Snap = await matchRef
            .collection("rounds")
            .doc(round.id || round.roundIndex?.toString() || "1")
            .collection("answers")
            .doc(player1Id)
            .get();

          if (answer1Snap.exists) {
            const answerData = answer1Snap.data();
            player1Answers.push({
              problem: problem.problem,
              answer: answerData?.value || "",
              correct: answerData?.correct || false,
            });
          }

          // Get player 2 answer
          const answer2Snap = await matchRef
            .collection("rounds")
            .doc(round.id || round.roundIndex?.toString() || "1")
            .collection("answers")
            .doc(player2Id)
            .get();

          if (answer2Snap.exists) {
            const answerData = answer2Snap.data();
            player2Answers.push({
              problem: problem.problem,
              answer: answerData?.value || "",
              correct: answerData?.correct || false,
            });
          }
        }
      }
    }

    if (player1Answers.length === 0 && player2Answers.length === 0) {
      return {
        feedback: "No integral problems found in this match to generate feedback for.",
      };
    }

    try {
      const feedback = await generateGameFeedback(
        player1Answers,
        player2Answers,
        env.openaiApiKey,
      );

      logger.info("Generated game feedback", { matchId, uid });

      return { feedback };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error("Failed to generate feedback", { error: errorMessage, matchId });
      return {
        feedback: "Unable to generate AI feedback at this time. Great job playing though!",
      };
    }
  });
