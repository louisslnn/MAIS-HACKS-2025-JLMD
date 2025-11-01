import { Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onSchedule } from "firebase-functions/v2/scheduler";

import { db, collections } from "./config";
import { updatePlayerState } from "./playerState";
import type { MatchDocument } from "./lib/types";

export const lockOverdueRounds = onSchedule(
  {
    schedule: "*/1 * * * *", // Every minute (Cron format)
    region: "us-central1",
    timeZone: "Etc/UTC",
  },
  async () => {
    const now = Timestamp.now();
    const overdue = await db
      .collectionGroup("rounds")
      .where("status", "==", "active")
      .where("endsAt", "<=", now)
      .limit(300)
      .get();

    if (overdue.empty) {
      return;
    }

    const batch = db.batch();
    overdue.docs.forEach((doc) => {
      batch.update(doc.ref, {
        status: "locked",
        updatedAt: now,
      });
    });
    await batch.commit();
    logger.info("Locked overdue rounds", { count: overdue.size });
  },
);

/**
 * Detect and handle inactive players
 * If a player hasn't submitted answers for 3+ rounds in an active match,
 * consider them inactive and forfeit the match
 */
export const detectInactivePlayers = onSchedule(
  {
    schedule: "*/2 * * * *", // Every 2 minutes
    region: "us-central1",
    timeZone: "Etc/UTC",
  },
  async () => {
    const now = Timestamp.now();
    const inactivityThreshold = 3 * 60 * 1000; // 3 minutes

    // Find active matches
    const activeMatches = await db
      .collection(collections.matches)
      .where("status", "==", "active")
      .limit(100)
      .get();

    if (activeMatches.empty) {
      return;
    }

    let inactiveCount = 0;

    for (const matchDoc of activeMatches.docs) {
      const match = matchDoc.data() as MatchDocument;
      const matchId = matchDoc.id;

      // Check when match started
      const matchStartTime = match.startedAt?.toMillis() || match.createdAt?.toMillis();
      if (!matchStartTime) continue;

      const matchAge = now.toMillis() - matchStartTime;

      // Skip very new matches (< 2 minutes)
      if (matchAge < 2 * 60 * 1000) continue;

      // Get all rounds
      const roundsSnap = await db
        .collection(collections.matches)
        .doc(matchId)
        .collection("rounds")
        .orderBy("roundIndex", "asc")
        .get();

      if (roundsSnap.empty) continue;

      // Check each player's answer activity
      for (const playerId of match.playerIds) {
        let answeredRounds = 0;
        let totalRounds = 0;

        for (const roundDoc of roundsSnap.docs) {
          const roundId = roundDoc.id;
          totalRounds++;

          // Check if player submitted answer for this round
          const answerSnap = await db
            .collection(collections.matches)
            .doc(matchId)
            .collection("rounds")
            .doc(roundId)
            .collection("answers")
            .doc(playerId)
            .get();

          if (answerSnap.exists) {
            answeredRounds++;
          }
        }

        // If player hasn't answered any of the last 3+ rounds, mark as inactive
        const missedRounds = totalRounds - answeredRounds;
        if (totalRounds >= 3 && missedRounds >= 3) {
          logger.warn("Player inactive - auto-forfeiting", {
            matchId,
            playerId,
            totalRounds,
            answeredRounds,
            missedRounds,
          });

          // Forfeit the match for this player
          const opponentId = match.playerIds.find((id) => id !== playerId);

          await db
            .collection(collections.matches)
            .doc(matchId)
            .update({
              [`players.${playerId}.surrendered`]: true,
              status: "completed",
              completedAt: now,
              updatedAt: now,
              winner: opponentId || null,
            });

          // Update player states to idle
          await updatePlayerState(playerId, "idle");
          if (opponentId) {
            await updatePlayerState(opponentId, "idle");
          }

          inactiveCount++;
          break; // Only forfeit once per match
        }
      }
    }

    if (inactiveCount > 0) {
      logger.info("Auto-forfeited inactive players", { count: inactiveCount });
    }
  },
);
