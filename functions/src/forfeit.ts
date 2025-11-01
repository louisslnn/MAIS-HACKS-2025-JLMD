import { Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onCall, HttpsError } from "firebase-functions/v2/https";
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
export const forfeitMatch = onCall(
  { enforceAppCheck: false, region: "us-central1" },
  async (request) => {
    try {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "Sign in to forfeit.");
      }

      const payload = forfeitSchema.safeParse(request.data);
      if (!payload.success) {
        throw new HttpsError("invalid-argument", "Invalid forfeit payload.");
      }

      const { matchId } = payload.data;
      const uid = request.auth.uid;

      const matchRef = db.collection(collections.matches).doc(matchId);

      await db.runTransaction(async (tx) => {
        const matchSnap = await tx.get(matchRef);
        if (!matchSnap.exists) {
          throw new HttpsError("not-found", "Match not found.");
        }

        const match = matchSnap.data() as MatchDocument;

        // Verify player is a participant
        if (!match.playerIds.includes(uid)) {
          throw new HttpsError(
            "permission-denied",
            "You are not a participant in this match.",
          );
        }

        // Can only forfeit active matches
        if (match.status !== "active") {
          throw new HttpsError(
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
        matchId: request.data?.matchId,
        uid: request.auth?.uid,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        error instanceof Error
          ? error.message
          : "An error occurred while forfeiting.",
      );
    }
  },
);

