/**
 * Backfill missing user documents
 * 
 * This script creates user documents for any Firebase Auth users
 * that are missing their Firestore user document.
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || 'mathclash-3e565',
  });
}

const auth = admin.auth();
const db = admin.firestore();

async function backfillUserDocuments() {
  console.log('🔍 Starting user document backfill...\n');
  
  let backfilledCount = 0;
  let existingCount = 0;
  let errorCount = 0;
  
  try {
    // List all users from Firebase Auth
    let nextPageToken;
    let totalUsers = 0;
    
    do {
      const listResult = await auth.listUsers(1000, nextPageToken);
      totalUsers += listResult.users.length;
      
      console.log(`📋 Processing ${listResult.users.length} users...`);
      
      for (const userRecord of listResult.users) {
        try {
          const userRef = db.collection('users').doc(userRecord.uid);
          const userSnap = await userRef.get();
          
          if (!userSnap.exists()) {
            // User document missing - create it
            const userData = {
              uid: userRecord.uid,
              displayName: userRecord.displayName || 'Anonymous',
              email: userRecord.email || '',
              rating: 1000, // Default Chess.com-style rating
              stats: {
                wins: 0,
                losses: 0,
                draws: 0,
                matchesPlayed: 0,
                correctAnswers: 0,
                totalTimeMs: 0,
              },
              createdAt: admin.firestore.Timestamp.fromDate(new Date(userRecord.metadata.creationTime)),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            
            await userRef.set(userData);
            console.log(`  ✅ Created document for ${userRecord.displayName || userRecord.email || userRecord.uid}`);
            backfilledCount++;
          } else {
            // Check if document has all required fields
            const data = userSnap.data();
            const needsUpdate = !data.stats || 
                                data.rating === undefined || 
                                !data.displayName;
            
            if (needsUpdate) {
              const updates = {};
              
              if (!data.stats) {
                updates.stats = {
                  wins: 0,
                  losses: 0,
                  draws: 0,
                  matchesPlayed: 0,
                  correctAnswers: 0,
                  totalTimeMs: 0,
                };
              }
              
              if (data.rating === undefined) {
                updates.rating = 1000;
              }
              
              if (!data.displayName) {
                updates.displayName = userRecord.displayName || 'Anonymous';
              }
              
              if (!data.email) {
                updates.email = userRecord.email || '';
              }
              
              updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
              
              await userRef.update(updates);
              console.log(`  🔄 Updated incomplete document for ${userRecord.displayName || userRecord.email || userRecord.uid}`);
              backfilledCount++;
            } else {
              existingCount++;
            }
          }
        } catch (error) {
          console.error(`  ❌ Error processing user ${userRecord.uid}:`, error.message);
          errorCount++;
        }
      }
      
      nextPageToken = listResult.pageToken;
    } while (nextPageToken);
    
    console.log('\n✨ Backfill complete!');
    console.log(`   Total users checked: ${totalUsers}`);
    console.log(`   ✅ Created/Updated: ${backfilledCount}`);
    console.log(`   ℹ️  Already complete: ${existingCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    
  } catch (error) {
    console.error('❌ Fatal error during backfill:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the backfill
backfillUserDocuments();





