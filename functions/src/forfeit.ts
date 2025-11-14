import { Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import * as functions from "firebase-functions/v1";
import { z } from "zod";

import { db, collections, serverTimestamp } from "./config";
import { updatePlayerState } from "./playerState";
import type { MatchDocument } from "./lib/types";

const forfeitSchema = z.object({
  matchId: z.string().min(1),
});

/**
 * Allow a player to forfeit/quit a match
 * Sets their surrendered flag and ends the match
 */
export const forfeitMatch = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    try {
      if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Sign in to forfeit.");
      }

      const payload = forfeitSchema.safeParse(data);
      if (!payload.success) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid forfeit payload.");
      }

      const { matchId } = payload.data;
      const uid = context.auth.uid;

      const matchRef = db.collection(collections.matches).doc(matchId);

      await db.runTransaction(async (tx) => {
        const matchSnap = await tx.get(matchRef);
        if (!matchSnap.exists) {
          throw new functions.https.HttpsError("not-found", "Match not found.");
        }

        const match = matchSnap.data() as MatchDocument;

        // Verify player is a participant
        if (!match.playerIds.includes(uid)) {
          throw new functions.https.HttpsError(
            "permission-denied",
            "You are not a participant in this match.",
          );
        }

        // Can only forfeit active matches
        if (match.status !== "active") {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "Match is not active. Cannot forfeit.",
          );
        }

        // Mark player as surrendered
        const playerKey = `players.${uid}.surrendered`;
        tx.update(matchRef, {
          [playerKey]: true,
          status: "completed",
          completedAt: Timestamp.now(),
          updatedAt: serverTimestamp(),
          // Winner is the other player
          winner: match.playerIds.find((id) => id !== uid) || null,
        });
      });

      // Update player state to idle
      await updatePlayerState(uid, "idle");

      // Also update opponent's state to idle
      const match = (await matchRef.get()).data() as MatchDocument;
      const opponentId = match.playerIds.find((id) => id !== uid);
      if (opponentId) {
        await updatePlayerState(opponentId, "idle");
      }

      logger.info("Player forfeited match", { uid, matchId });

      return { success: true };
    } catch (error) {
      logger.error("Forfeit error", {
        error: error instanceof Error ? error.message : String(error),
        matchId: data?.matchId,
        uid: context.auth?.uid,
      });

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        "internal",
        error instanceof Error
          ? error.message
          : "An error occurred while forfeiting.",
      );
    }
  });
