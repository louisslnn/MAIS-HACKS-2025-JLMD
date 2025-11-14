/**
 * Backfill missing user documents
 */

import * as functions from "firebase-functions/v1";
import { logger } from "firebase-functions";
import { db } from "./config";
import { auth } from "firebase-admin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";

const collections = {
  users: "users",
};

interface UserDocument {
  uid: string;
  displayName: string;
  displayNameLower: string;
  searchPrefixes: string[];
  email: string;
  rating: number;
  stats: {
    wins: number;
    losses: number;
    draws: number;
    matchesPlayed: number;
    correctAnswers: number;
    totalTimeMs: number;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp | FieldValue;
}

const MAX_SEARCH_PREFIXES = 50;

function buildSearchPrefixes(name: string, maxPrefixes = MAX_SEARCH_PREFIXES): string[] {
  const normalized = name.toLowerCase().trim();
  if (!normalized) {
    return [];
  }

  const prefixes = new Set<string>();
  const words = normalized.split(/\s+/).filter(Boolean);

  for (const word of words) {
    let current = "";
    for (const char of word) {
      current += char;
      prefixes.add(current);
    }
  }

  let running = "";
  for (const char of normalized) {
    if (char === " ") {
      running = "";
      continue;
    }
    running += char;
    prefixes.add(running);
  }

  prefixes.add(normalized);

  return Array.from(prefixes)
    .filter(Boolean)
    .slice(0, maxPrefixes);
}

export const backfillUserDocuments = functions
  .region("us-central1")
  .runWith({ timeoutSeconds: 540 })
  .https.onCall(async (data, context) => {
    logger.info("Starting user document backfill...");
    
    let backfilledCount = 0;
    let existingCount = 0;
    let errorCount = 0;
    
    try {
      // List all users from Firebase Auth
      let nextPageToken: string | undefined;
      let totalUsers = 0;
      
      do {
        const listResult = await auth().listUsers(1000, nextPageToken);
        totalUsers += listResult.users.length;
        
        logger.info(`Processing ${listResult.users.length} users...`);
        
        for (const userRecord of listResult.users) {
          try {
            const userRef = db.collection(collections.users).doc(userRecord.uid);
            const userSnap = await userRef.get();
            
            if (!userSnap.exists) {
              const rawName = (userRecord.displayName || "").trim();
              const resolvedName =
                rawName.length > 0
                  ? rawName
                  : userRecord.email?.split("@")[0]?.trim() || "Anonymous";

              // User document missing - create it
              const userData: UserDocument = {
                uid: userRecord.uid,
                displayName: resolvedName,
                displayNameLower: resolvedName.toLowerCase(),
                searchPrefixes: buildSearchPrefixes(resolvedName),
                email: userRecord.email || "",
                rating: 1000, // Default Chess.com-style rating
                stats: {
                  wins: 0,
                  losses: 0,
                  draws: 0,
                  matchesPlayed: 0,
                  correctAnswers: 0,
                  totalTimeMs: 0,
                },
                createdAt: Timestamp.fromDate(new Date(userRecord.metadata.creationTime)),
                updatedAt: FieldValue.serverTimestamp(),
              };
              
              await userRef.set(userData);
              logger.info(`Created document for ${userRecord.displayName || userRecord.email || userRecord.uid}`);
              backfilledCount++;
            } else {
              // Check if document has all required fields
              const data = userSnap.data();
              const needsUpdate =
                !data?.stats ||
                data.rating === undefined ||
                !data.displayName ||
                !data.displayNameLower ||
                !Array.isArray(data.searchPrefixes) ||
                data.searchPrefixes.length === 0;
              
              if (needsUpdate) {
                const updates: Partial<UserDocument> & Record<string, unknown> = {};
                
                if (!data?.stats) {
                  updates.stats = {
                    wins: 0,
                    losses: 0,
                    draws: 0,
                    matchesPlayed: 0,
                    correctAnswers: 0,
                    totalTimeMs: 0,
                  };
                }
                
                if (data?.rating === undefined) {
                  updates.rating = 1000;
                }

                const existingName =
                  (typeof data?.displayName === "string" && data.displayName.trim().length > 0
                    ? data.displayName
                    : userRecord.displayName) ||
                  userRecord.email?.split("@")[0] ||
                  "Anonymous";
                const resolvedName = existingName.trim().length > 0 ? existingName.trim() : "Anonymous";
                const resolvedLower = resolvedName.toLowerCase();
                const resolvedPrefixes = buildSearchPrefixes(resolvedName);
                
                if (data?.displayName !== resolvedName) {
                  updates.displayName = resolvedName;
                }
                
                if (data?.displayNameLower !== resolvedLower) {
                  updates.displayNameLower = resolvedLower;
                }
                
                if (!Array.isArray(data?.searchPrefixes) || data.searchPrefixes.length === 0) {
                  updates.searchPrefixes = resolvedPrefixes;
                }
                
                if (!data?.email) {
                  updates.email = userRecord.email || "";
                }
                
                updates.updatedAt = FieldValue.serverTimestamp();
                
                await userRef.update(updates);
                logger.info(`Updated incomplete document for ${userRecord.displayName || userRecord.email || userRecord.uid}`);
                backfilledCount++;
              } else {
                existingCount++;
              }
            }
          } catch (error) {
            logger.error(`Error processing user ${userRecord.uid}:`, error);
            errorCount++;
          }
        }
        
        nextPageToken = listResult.pageToken;
      } while (nextPageToken);
      
      logger.info("Backfill complete!", {
        totalUsers,
        backfilledCount,
        existingCount,
        errorCount,
      });
      
      return {
        success: true,
        totalUsers,
        backfilledCount,
        existingCount,
        errorCount,
      };
      
    } catch (error) {
      logger.error("Fatal error during backfill:", error);
      throw error;
    }
  });
