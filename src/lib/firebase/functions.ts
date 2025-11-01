/**
 * Cloud Functions client helpers
 */

import { getFunctions, httpsCallable, type HttpsCallable } from 'firebase/functions';
import { firebaseApp } from './client';

// Initialize Functions (use emulator if configured)
// Use us-central1 region to match the deployed functions
const functions = getFunctions(firebaseApp, 'us-central1');

// Connect to emulator in development if enabled
if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true' && typeof window !== 'undefined') {
  import('firebase/functions').then(({ connectFunctionsEmulator }) => {
    connectFunctionsEmulator(functions, 'localhost', 5001);
  });
}

export interface RequestQuickMatchParams {
  mode?: 'ranked-1v1' | 'private' | 'solo';
  topic?: 'arith' | 'algebra' | 'calculus';
  difficulty?: 'easy' | 'medium' | 'hard';
  category?: 'addition' | 'integrals';
}

export interface RequestQuickMatchResponse {
  queued: boolean;
  matchId: string | null;
}

export interface SubmitAnswerParams {
  matchId: string;
  roundId: string;
  value: string | number;
}

export interface SubmitAnswerResponse {
  correct: boolean;
  inTime: boolean;
  timeMs: number;
}

export interface GetGameFeedbackParams {
  matchId: string;
}

export interface GetGameFeedbackResponse {
  feedback: string;
}

/**
 * Request a quick match (join matchmaking queue)
 */
export const requestQuickMatch: HttpsCallable<RequestQuickMatchParams, RequestQuickMatchResponse> = 
  httpsCallable(functions, 'requestQuickMatch');

/**
 * Cancel queue (remove from matchmaking queue)
 */
export const cancelQueue: HttpsCallable<{}, { success: boolean }> = 
  httpsCallable(functions, 'cancelQueue');

/**
 * Submit an answer for a round
 */
export const submitAnswer: HttpsCallable<SubmitAnswerParams, SubmitAnswerResponse> = 
  httpsCallable(functions, 'submitAnswer');

/**
 * Get game feedback after match completes
 */
export const getGameFeedback: HttpsCallable<GetGameFeedbackParams, GetGameFeedbackResponse> = 
  httpsCallable(functions, 'getGameFeedback');

export interface ForfeitMatchParams {
  matchId: string;
}

export interface ForfeitMatchResponse {
  success: boolean;
}

/**
 * Forfeit/quit a match
 */
export const forfeitMatch: HttpsCallable<ForfeitMatchParams, ForfeitMatchResponse> = 
  httpsCallable(functions, 'forfeitMatch');

export interface CleanupOldMatchesResponse {
  success: boolean;
  matchesClosed: number;
  queueEntriesRemoved: number;
  userStatesReset: number;
}

/**
 * Admin function: Clean up old/abandoned matches and reset player states
 */
export const cleanupOldMatches: HttpsCallable<{}, CleanupOldMatchesResponse> = 
  httpsCallable(functions, 'cleanupOldMatches');

export interface ResetAllRatingsResponse {
  success: boolean;
  count: number;
  message: string;
}

/**
 * Admin function: Reset all users to 1000 Elo rating
 */
export const resetAllRatings: HttpsCallable<{}, ResetAllRatingsResponse> = 
  httpsCallable(functions, 'resetAllRatings');

export interface BackfillUserDocumentsResponse {
  success: boolean;
  totalUsers: number;
  backfilledCount: number;
  existingCount: number;
  errorCount: number;
}

/**
 * Admin function: Backfill missing user documents
 */
export const backfillUserDocuments: HttpsCallable<{}, BackfillUserDocumentsResponse> = 
  httpsCallable(functions, 'backfillUserDocuments');
