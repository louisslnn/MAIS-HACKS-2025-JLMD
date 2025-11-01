/**
 * Backfill missing user documents
 */

import { onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { db } from "./config";
import { auth } from "firebase-admin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";

const collections = {
  users: "users",
};

interface UserDocument {
  uid: string;
  displayName: string;
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
  updatedAt: any;
}

export const backfillUserDocuments = onCall(
  { enforceAppCheck: false, region: "us-central1", timeoutSeconds: 540 },
  async () => {
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
              // User document missing - create it
              const userData: UserDocument = {
                uid: userRecord.uid,
                displayName: userRecord.displayName || "Anonymous",
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
              const needsUpdate = !data?.stats || 
                                  data.rating === undefined || 
                                  !data.displayName;
              
              if (needsUpdate) {
                const updates: any = {};
                
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
                
                if (!data?.displayName) {
                  updates.displayName = userRecord.displayName || "Anonymous";
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
  }
);

