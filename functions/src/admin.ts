import { Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import * as functions from "firebase-functions/v1";

import { db, collections, getQueueRef, serverTimestamp } from "./config";
import type { MatchDocument } from "./lib/types";

/**
 * Reset all users to 1000 rating (Chess.com baseline)
 */
export const resetAllRatings = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    try {
      logger.info("Starting global rating reset to 1000");
      
      const usersRef = db.collection(collections.users);
      const snapshot = await usersRef.get();
      
      if (snapshot.empty) {
        return { success: true, count: 0, message: "No users found" };
      }
      
      // Process in batches
      let totalCount = 0;
      let batchCount = 0;
      let batch = db.batch();
      
      for (const doc of snapshot.docs) {
        const data = doc.data();
        const currentRating = data.rating || 1500;
        
        batch.update(doc.ref, {
          rating: 1000,
          updatedAt: serverTimestamp(),
        });
        
        logger.info(`Reset ${data.displayName || doc.id}: ${currentRating} → 1000`);
        batchCount++;
        totalCount++;
        
        // Commit every 500 operations (Firestore limit)
        if (batchCount >= 500) {
          await batch.commit();
          logger.info(`Committed batch of ${batchCount} updates`);
          batch = db.batch();
          batchCount = 0;
        }
      }
      
      // Commit remaining
      if (batchCount > 0) {
        await batch.commit();
        logger.info(`Committed final batch of ${batchCount} updates`);
      }
      
      logger.info(`Successfully reset ${totalCount} users to 1000 rating`);
      
      return {
        success: true,
        count: totalCount,
        message: `Reset ${totalCount} users to 1000 rating`,
      };
    } catch (error) {
      logger.error("Error resetting ratings:", error);
      throw new functions.https.HttpsError("internal", "Failed to reset ratings");
    }
  }
);

/**
 * Admin function to clean up old/abandoned matches and reset player states
 * This is a one-time cleanup for existing data issues
 */
export const cleanupOldMatches = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    try {
      // For security, you could add admin check here
      // For now, any authenticated user can call (temporary for cleanup)
      if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Sign in to run cleanup.");
      }

      logger.info("Starting old matches cleanup", { requestedBy: context.auth.uid });

      const now = Timestamp.now();
      const oneHourAgo = Timestamp.fromMillis(now.toMillis() - 60 * 60 * 1000);

      // Find all active matches
      const activeMatches = await db
        .collection(collections.matches)
        .where("status", "==", "active")
        .get();

      let closedCount = 0;
      const playerIdsToReset = new Set<string>();

      if (!activeMatches.empty) {
        const batch = db.batch();

        for (const matchDoc of activeMatches.docs) {
          const match = matchDoc.data() as MatchDocument;
          const matchId = matchDoc.id;
          const createdAt = match.createdAt || match.startedAt;

          // Close matches older than 1 hour
          if (createdAt && createdAt.toMillis() < oneHourAgo.toMillis()) {
            logger.info("Closing old match", {
              matchId,
              playerIds: match.playerIds,
              createdAt: createdAt.toDate().toISOString(),
            });

            batch.update(matchDoc.ref, {
              status: "cancelled",
              completedAt: now,
              updatedAt: now,
            });

            // Collect player IDs to reset
            if (match.playerIds && Array.isArray(match.playerIds)) {
              match.playerIds.forEach((pid) => playerIdsToReset.add(pid));
            }

            closedCount++;
          }
        }

        if (closedCount > 0) {
          await batch.commit();
          logger.info("Closed old matches", { count: closedCount });
        }
      }

      // Reset player states
      if (playerIdsToReset.size > 0) {
        logger.info("Resetting player states", { count: playerIdsToReset.size });
        
        // Process in batches of 500 (Firestore limit)
        const playerIds = Array.from(playerIdsToReset);
        const batchSize = 500;
        
        for (let i = 0; i < playerIds.length; i += batchSize) {
          const batchPlayerIds = playerIds.slice(i, i + batchSize);
          const stateBatch = db.batch();
          
          for (const playerId of batchPlayerIds) {
            const userRef = db.collection(collections.users).doc(playerId);
            stateBatch.update(userRef, {
              status: "idle",
              matchId: null,
              queuedAt: null,
              lastUpdated: now,
            });
          }
          
          await stateBatch.commit();
        }
      }

      // Clean up ALL queue entries
      const queueRef = getQueueRef();
      const queueSnapshot = await queueRef.get();
      let queueCleaned = 0;

      if (!queueSnapshot.empty) {
        const queueBatch = db.batch();
        queueSnapshot.docs.forEach((doc) => {
          queueBatch.delete(doc.ref);
          queueCleaned++;
        });
        await queueBatch.commit();
        logger.info("Cleaned queue entries", { count: queueCleaned });
      }

      // NUCLEAR OPTION: Reset ALL user states to idle
      const usersSnapshot = await db.collection(collections.users).get();
      let usersReset = 0;

      if (!usersSnapshot.empty) {
        const batchSize = 500;
        const userDocs = usersSnapshot.docs;

        for (let i = 0; i < userDocs.length; i += batchSize) {
          const batchDocs = userDocs.slice(i, i + batchSize);
          const usersBatch = db.batch();

          for (const userDoc of batchDocs) {
            usersBatch.update(userDoc.ref, {
              status: "idle",
              matchId: null,
              queuedAt: null,
              lastUpdated: now,
            });
            usersReset++;
          }

          await usersBatch.commit();
        }

        logger.info("Reset all user states", { count: usersReset });
      }

      const summary = {
        matchesClosed: closedCount,
        queueEntriesRemoved: queueCleaned,
        userStatesReset: usersReset,
      };

      logger.info("Cleanup complete", summary);

      return {
        success: true,
        ...summary,
      };
    } catch (error) {
      logger.error("Cleanup error", {
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        "internal",
        error instanceof Error
          ? error.message
          : "An error occurred during cleanup.",
      );
    }
  });
