import { Timestamp } from "firebase-admin/firestore";
import * as functions from "firebase-functions/v1";
import { logger } from "firebase-functions";
import { z } from "zod";

import { db, collections } from "./config";

const ALLOWED_EMOTES = [
  "giphy",
  "math-zach-galifianakis",
  "maths",
  "ratio-maths",
] as const;

const triggerMatchEmoteSchema = z.object({
  matchId: z.string().min(1),
  emoteId: z.enum(ALLOWED_EMOTES),
});

type MatchRecord = {
  playerIds?: string[];
  status?: string;
  winner?: string | null;
};

export const triggerMatchEmote = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Sign in to send victory emotes.");
    }

    const parsed = triggerMatchEmoteSchema.safeParse(data);
    if (!parsed.success) {
      logger.warn("triggerMatchEmote received invalid payload", {
        errors: parsed.error.flatten(),
        raw: data,
      });
      throw new functions.https.HttpsError("invalid-argument", "Invalid emote payload.");
    }

    const { matchId, emoteId } = parsed.data;
    const uid = context.auth.uid;

    const matchRef = db.collection(collections.matches).doc(matchId);

    await db.runTransaction(async (tx) => {
      const matchSnap = await tx.get(matchRef);
      if (!matchSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Match not found.");
      }

      const match = matchSnap.data() as MatchRecord & {
        celebration?: { triggeredBy: string; emoteId: string; triggeredAt: Timestamp };
      };

      if (!Array.isArray(match.playerIds) || !match.playerIds.includes(uid)) {
        throw new functions.https.HttpsError("permission-denied", "You are not a participant in this match.");
      }

      if (match.status !== "completed") {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Victory emotes can only be sent after the match is completed.",
        );
      }

      if (!match.winner || match.winner !== uid) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Only the winning player can trigger a victory emote.",
        );
      }

      tx.update(matchRef, {
        celebration: {
          emoteId,
          triggeredBy: uid,
          triggeredAt: Timestamp.now(),
        },
        updatedAt: Timestamp.now(),
      });
    });

    logger.info("Victory emote triggered", {
      matchId,
      emoteId,
      triggeredBy: uid,
    });

    return {
      success: true,
      emoteId,
    };
  });
