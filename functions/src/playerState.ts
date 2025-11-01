import { Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { db, collections, getQueueRef } from "./config";

export type PlayerStatus = "idle" | "in-queue" | "in-match";

export interface PlayerStateDocument {
  status: PlayerStatus;
  matchId?: string | null;
  queuedAt?: Timestamp | null;
  lastUpdated: Timestamp;
}

/**
 * Update player state in Firestore
 */
export async function updatePlayerState(
  uid: string,
  status: PlayerStatus,
  matchId?: string | null
): Promise<void> {
  const stateRef = db.collection(collections.users).doc(uid);
  
  const updates: Partial<PlayerStateDocument> = {
    status,
    lastUpdated: Timestamp.now(),
  };

  if (status === "in-match" && matchId) {
    updates.matchId = matchId;
    updates.queuedAt = null;
  } else if (status === "in-queue") {
    updates.queuedAt = Timestamp.now();
    updates.matchId = null;
  } else {
    // idle
    updates.matchId = null;
    updates.queuedAt = null;
  }

  try {
    await stateRef.update(updates);
    logger.info("Updated player state", { uid, status, matchId });
  } catch (error) {
    // If user document doesn't exist or update fails, try set with merge
    logger.warn("Update failed, trying set with merge", { uid, error: error instanceof Error ? error.message : String(error) });
    await stateRef.set(updates, { merge: true });
    logger.info("Set player state with merge", { uid, status, matchId });
  }
}

/**
 * Get player's current state
 */
export async function getPlayerState(uid: string): Promise<PlayerStateDocument | null> {
  const stateRef = db.collection(collections.users).doc(uid);
  const snap = await stateRef.get();
  
  if (!snap.exists) {
    return null;
  }

  const data = snap.data();
  return {
    status: (data?.status as PlayerStatus) || "idle",
    matchId: data?.matchId || null,
    queuedAt: data?.queuedAt || null,
    lastUpdated: data?.lastUpdated || Timestamp.now(),
  };
}

/**
 * Check if player is available for matchmaking (not already in a game or queue)
 */
export async function isPlayerAvailable(uid: string): Promise<boolean> {
  const state = await getPlayerState(uid);
  if (!state) return true; // No state = available
  
  // Player is available if idle or if their state is stale (>5 minutes old)
  const now = Timestamp.now();
  const staleThreshold = 5 * 60 * 1000; // 5 minutes
  const isStale = state.lastUpdated && 
    (now.toMillis() - state.lastUpdated.toMillis()) > staleThreshold;
  
  return state.status === "idle" || isStale;
}

/**
 * Cleanup player state when they leave a match
 */
export async function cleanupPlayerState(uid: string): Promise<void> {
  await updatePlayerState(uid, "idle");
  
  // Also remove from queue if they're there
  const queueRef = getQueueRef().doc(uid);
  const queueSnap = await queueRef.get();
  if (queueSnap.exists) {
    await queueRef.delete();
    logger.info("Removed player from queue during cleanup", { uid });
  }
}

