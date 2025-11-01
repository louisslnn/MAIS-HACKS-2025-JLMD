import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

export const db = admin.firestore();
// Realtime Database - not initialized at module load to avoid deployment errors
// It's optional and only used for presence/opponent state tracking
// Initialize it when actually needed in your functions

export const serverTimestamp = admin.firestore.FieldValue.serverTimestamp;
export const increment = admin.firestore.FieldValue.increment;

export const collections = {
  users: "users",
  matches: "matches",
  queues: {
    // Queue structure: queues/quickMatch/tickets/{userId}
    // Access via: db.collection("queues").doc("quickMatch").collection("tickets")
    // This is a helper function to get the collection reference
    quickMatch: "queues/quickMatch/tickets",
  },
  leaderboards: "leaderboards/global",
  ratings: "ratings",
} as const;

// Helper to get queue collection reference
export function getQueueRef() {
  return db.collection("queues").doc("quickMatch").collection("tickets");
}

export const env = {
  questionSalt: process.env.MATCH_SALT || "mathclash-secret-salt",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
};
