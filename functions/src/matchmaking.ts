import { Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";

import { db, serverTimestamp, collections, getQueueRef } from "./config";
import { createMatch } from "./matchLifecycle";
import { updatePlayerState, isPlayerAvailable } from "./playerState";

const requestSchema = z.object({
  mode: z.enum(["ranked-1v1", "private", "solo"]).default("ranked-1v1"),
  topic: z
    .enum(["arith", "algebra", "calculus"])
    .default("arith"),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
});

/**
 * Chess.com-style dynamic rating range that expands over time
 * Start narrow for better matches, expand if no match found
 */
function calculateRatingRange(queueTimeSeconds: number): number {
  if (queueTimeSeconds < 30) return 100;  // First 30s: ±100
  if (queueTimeSeconds < 60) return 200;  // 30-60s: ±200
  if (queueTimeSeconds < 90) return 300;  // 60-90s: ±300
  return 400;                              // 90s+: ±400 (max)
}

/**
 * Try to match the current player immediately with any waiting compatible player
 * This provides instant matchmaking (chess.com style) instead of waiting for scheduled function
 */
async function tryMatchImmediately(
  currentUid: string,
  currentMode: string,
  currentRating: number,
  currentTopic: string,
): Promise<string | null> {
  // Find compatible players already in queue
  // Query the queue collection - filter by mode and topic
  const queueRef = getQueueRef();
  const snapshot = await queueRef
    .where("mode", "==", currentMode)
    .where("topic", "==", currentTopic)
    .orderBy("createdAt", "asc")
    .limit(50)
    .get();

  if (snapshot.empty) {
    return null;
  }

  let currentTime = Timestamp.now();
  
  // First, filter candidates synchronously
  const potentialCandidates = snapshot.docs
    .filter((doc) => {
      // Exclude self
      if (doc.id === currentUid) return false;
      
      // Exclude expired tickets
      const data = doc.data();
      const expiresAt = data.expiresAt as Timestamp | undefined;
      if (expiresAt) {
        const expiresMs = expiresAt.toMillis();
        const currentMs = currentTime.toMillis();
        // Also exclude tickets that expire in less than 10 seconds (to be safe)
        if (expiresMs <= currentMs || expiresMs <= currentMs + 10000) {
          return false;
        }
      }
      
      return true;
    })
    .map((doc) => ({
      id: doc.id,
      ...(doc.data() as {
        uid: string;
        ratingSnapshot: number;
        displayName: string;
        mode: string;
        topic: string;
        difficulty: string;
        createdAt: Timestamp;
        expiresAt: Timestamp;
      }),
    }));

  // Use all potential candidates (we force-reset on queue join, so they're valid)
  const candidates = potentialCandidates;

  if (candidates.length === 0) {
    logger.info("No candidates found for instant matching", {
      currentUid,
      mode: currentMode,
      topic: currentTopic,
    });
    return null;
  }

  logger.info("Found candidates for instant matching", {
    currentUid,
    candidateCount: candidates.length,
  });

  // Find best match using Chess.com-style expanding rating range
  // Check each candidate's queue time to determine acceptable rating difference
  currentTime = Timestamp.now();
  let bestMatch: (typeof candidates)[0] | null = null;
  let bestDiff = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    // Calculate how long the candidate has been waiting
    const queueTimeSeconds = Math.floor(
      (currentTime.toMillis() - candidate.createdAt.toMillis()) / 1000
    );
    
    // Dynamic rating range based on wait time
    const acceptableRange = calculateRatingRange(queueTimeSeconds);
    const diff = Math.abs(candidate.ratingSnapshot - currentRating);
    
    if (diff <= acceptableRange && diff < bestDiff) {
      bestDiff = diff;
      bestMatch = candidate;
    }
  }

  if (!bestMatch) {
    logger.info("No suitable match found within dynamic rating range", {
      currentUid,
      currentRating,
      candidatesChecked: candidates.length,
    });
    return null;
  }

  logger.info("Found best match", {
    currentUid,
    matchUid: bestMatch.uid,
    ratingDiff: Math.abs(bestMatch.ratingSnapshot - currentRating),
  });

  // Get current user data
  const currentUserRef = db.collection(collections.users).doc(currentUid);
  const currentUserSnap = await currentUserRef.get();
  const currentUserData = currentUserSnap.data() as {
    displayName?: string;
    rating?: number;
  };

  // Map topic to category
  const category = currentTopic === 'calculus' ? 'integrals' : 'addition';
  
  // Create match
  const matchId = await createMatch({
    players: [
      {
        uid: currentUid,
        displayName: currentUserData.displayName ?? "Anonymous",
        rating: currentRating,
      },
      {
        uid: bestMatch.uid,
        displayName: bestMatch.displayName,
        rating: bestMatch.ratingSnapshot,
      },
    ],
    mode: "ranked-1v1",
    category,
  });

  // Remove both players from queue
  await getQueueRef().doc(currentUid).delete();
  await getQueueRef().doc(bestMatch.id).delete();

  // Update both players' state to in-match
  await updatePlayerState(currentUid, "in-match", matchId);
  await updatePlayerState(bestMatch.uid, "in-match", matchId);

  logger.info("Instant match created", {
    matchId,
    player1: currentUid,
    player2: bestMatch.uid,
  });

  return matchId;
}

export const requestQuickMatch = onCall(
  { 
    enforceAppCheck: false, 
    region: "us-central1",
  },
  async (request) => {
    try {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "Sign in to join the queue.");
      }

      const payload = requestSchema.safeParse(request.data ?? {});
      if (!payload.success) {
        throw new HttpsError("invalid-argument", "Invalid matchmaking payload.");
      }

      const uid = request.auth.uid;
      const userRef = db.collection(collections.users).doc(uid);
      const userSnap = await userRef.get();
      if (!userSnap.exists) {
        throw new HttpsError(
          "failed-precondition",
          "Create a player profile before joining the queue.",
        );
      }

      const userData = userSnap.data() as {
        displayName?: string;
        rating?: number;
      };

      const rating = userData?.rating ?? 1000; // Chess.com-style default rating

      // FORCE CLEANUP: Remove from any existing queue and reset state
      // This ensures a clean slate when joining matchmaking
      const existingQueueTicket = getQueueRef().doc(uid);
      const queueSnap = await existingQueueTicket.get();
      if (queueSnap.exists) {
        await existingQueueTicket.delete();
        logger.info("Removed player from existing queue before re-queuing", { uid });
      }

      // Force reset player state to idle (in case they were stuck in-match)
      await updatePlayerState(uid, "idle");
      
      // Small delay to ensure state is updated
      await new Promise(resolve => setTimeout(resolve, 100));

      // Try to match immediately first (chess.com style instant matching)
      const matchId = await tryMatchImmediately(uid, payload.data.mode, rating, payload.data.topic);

      if (matchId) {
        logger.info("Player matched instantly", { uid, matchId });
        return { queued: false, matchId };
      }

      // If no match found, add to queue
      const ticketRef = getQueueRef().doc(uid);
      await ticketRef.set({
        uid,
        mode: payload.data.mode,
        topic: payload.data.topic,
        difficulty: payload.data.difficulty,
        ratingSnapshot: rating,
        displayName: userData.displayName ?? "Anonymous",
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromMillis(Date.now() + 5 * 60 * 1000),
      });

      // Update player state to in-queue
      await updatePlayerState(uid, "in-queue");

      logger.info("Queued player for quick match", { uid });
      return { queued: true, matchId: null };
    } catch (error) {
      // Ensure CORS headers are sent even on error
      logger.error("Matchmaking error", { error: error instanceof Error ? error.message : String(error) });
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "An error occurred during matchmaking.");
    }
  },
);

export const cancelQueue = onCall(
  {
    enforceAppCheck: false,
    region: "us-central1",
  },
  async (request) => {
    try {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "Sign in to cancel queue.");
      }

      const uid = request.auth.uid;
      const ticketRef = getQueueRef().doc(uid);
      const ticketSnap = await ticketRef.get();

      if (ticketSnap.exists) {
        await ticketRef.delete();
        logger.info("Player removed from queue", { uid });
      }

      // Update player state to idle
      await updatePlayerState(uid, "idle");

      return { success: true };
    } catch (error) {
      logger.error("Cancel queue error", { error: error instanceof Error ? error.message : String(error) });
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "An error occurred while canceling queue.");
    }
  },
);

export const quickMatchmaker = onSchedule(
  {
    schedule: "every 1 minutes",
    region: "us-central1",
    timeZone: "Etc/UTC",
  },
  async () => {
    const quickMatchQueue = getQueueRef();
    const snapshot = await quickMatchQueue
      .orderBy("createdAt", "asc")
      .limit(50)
      .get();

    if (snapshot.empty) {
      return;
    }

    let currentTime = Timestamp.now();
    
    // Filter out expired tickets first
    const potentialTickets = snapshot.docs
      .filter((doc) => {
        const data = doc.data();
        const expiresAt = data.expiresAt as Timestamp | undefined;
        if (!expiresAt) return true; // Legacy tickets without expiration
        const expiresMs = expiresAt.toMillis();
        const currentMs = currentTime.toMillis();
        // Only include tickets that haven't expired and won't expire in the next 10 seconds
        return expiresMs > currentMs + 10000;
      })
      .map((doc) => ({
        id: doc.id,
        ...(doc.data() as {
          uid: string;
          ratingSnapshot: number;
          displayName: string;
          mode: string;
          topic: string;
          difficulty: string;
          createdAt: Timestamp;
          expiresAt: Timestamp;
        }),
      }));

    // Use all potential tickets (force-reset on join ensures they're valid)
    const tickets = potentialTickets;
    
    logger.info("Processing matchmaking queue", {
      totalTickets: tickets.length,
    });

    const matched = new Set<string>();

    currentTime = Timestamp.now();

    for (let i = 0; i < tickets.length; i += 1) {
      const current = tickets[i];
      if (matched.has(current.id)) continue;

      // Calculate how long this player has been waiting
      const currentQueueTimeSeconds = Math.floor(
        (currentTime.toMillis() - current.createdAt.toMillis()) / 1000
      );
      const currentAcceptableRange = calculateRatingRange(currentQueueTimeSeconds);

      let bestMatch: typeof current | null = null;
      let bestDiff = Number.POSITIVE_INFINITY;

      for (let j = i + 1; j < tickets.length; j += 1) {
        const candidate = tickets[j];
        if (matched.has(candidate.id)) continue;
        if (candidate.mode !== current.mode) continue;
        if (candidate.topic !== current.topic) continue; // Match same topic

        // Calculate candidate's queue time
        const candidateQueueTimeSeconds = Math.floor(
          (currentTime.toMillis() - candidate.createdAt.toMillis()) / 1000
        );
        const candidateAcceptableRange = calculateRatingRange(candidateQueueTimeSeconds);
        
        // Use the maximum acceptable range between the two players
        const maxAcceptableRange = Math.max(currentAcceptableRange, candidateAcceptableRange);
        
        const diff = Math.abs(
          candidate.ratingSnapshot - current.ratingSnapshot,
        );

        if (diff <= maxAcceptableRange && diff < bestDiff) {
          bestDiff = diff;
          bestMatch = candidate;
        }
      }

      if (!bestMatch) continue;

      logger.info("Creating match", {
        player1: current.uid,
        player2: bestMatch.uid,
        ratingDiff: bestDiff,
        topic: current.topic,
      });

      // Map topic to category
      const category = current.topic === 'calculus' ? 'integrals' : 'addition';

      const createdMatchId = await createMatch({
        players: [
          {
            uid: current.uid,
            displayName: current.displayName,
            rating: current.ratingSnapshot,
          },
          {
            uid: bestMatch.uid,
            displayName: bestMatch.displayName,
            rating: bestMatch.ratingSnapshot,
          },
        ],
        mode: "ranked-1v1",
        category,
      });

      // Remove from queue
      await getQueueRef().doc(current.id).delete();
      await getQueueRef().doc(bestMatch.id).delete();
      
      // Update player states to in-match
      await updatePlayerState(current.uid, "in-match", createdMatchId);
      await updatePlayerState(bestMatch.uid, "in-match", createdMatchId);
      
      matched.add(current.id);
      matched.add(bestMatch.id);
    }

    // Clean up expired tickets
    const now = Timestamp.now();
    const expiredQueue = getQueueRef();
    const expired = await expiredQueue
      .where("expiresAt", "<=", now)
      .limit(50)
      .get();
    const batch = db.batch();
    expired.docs.forEach((doc) => batch.delete(doc.ref));
    if (!expired.empty) {
      await batch.commit();
    }
  },
);
