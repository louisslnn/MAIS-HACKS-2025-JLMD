const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : null;

if (!serviceAccount) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT environment variable not set');
  console.log('💡 Run this from the project root with .env file');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
});

const db = admin.firestore();

async function cleanupOldMatches() {
  try {
    console.log('🧹 Starting cleanup of old/abandoned matches...\n');

    // Find all active matches
    const activeMatches = await db
      .collection('matches')
      .where('status', '==', 'active')
      .get();

    if (activeMatches.empty) {
      console.log('✅ No active matches found');
    } else {
      console.log(`📋 Found ${activeMatches.size} active matches\n`);

      const now = admin.firestore.Timestamp.now();
      const oneHourAgo = admin.firestore.Timestamp.fromMillis(now.toMillis() - 60 * 60 * 1000);

      let closedCount = 0;
      const batch = db.batch();
      const playerIdsToReset = new Set();

      for (const matchDoc of activeMatches.docs) {
        const match = matchDoc.data();
        const matchId = matchDoc.id;
        const createdAt = match.createdAt || match.startedAt;

        // Close matches older than 1 hour
        if (createdAt && createdAt.toMillis() < oneHourAgo.toMillis()) {
          console.log(`  🗑️  Closing old match: ${matchId}`);
          console.log(`     Players: ${match.playerIds?.join(', ') || 'unknown'}`);
          console.log(`     Created: ${createdAt.toDate().toISOString()}`);
          
          batch.update(matchDoc.ref, {
            status: 'cancelled',
            completedAt: now,
            updatedAt: now,
          });

          // Collect player IDs to reset
          if (match.playerIds && Array.isArray(match.playerIds)) {
            match.playerIds.forEach(pid => playerIdsToReset.add(pid));
          }

          closedCount++;
        }
      }

      if (closedCount > 0) {
        await batch.commit();
        console.log(`\n✅ Closed ${closedCount} old matches`);
      } else {
        console.log('  ℹ️  All active matches are recent (< 1 hour old)');
      }

      // Reset player states
      if (playerIdsToReset.size > 0) {
        console.log(`\n🔄 Resetting ${playerIdsToReset.size} player states to idle...`);
        const stateBatch = db.batch();
        
        for (const playerId of playerIdsToReset) {
          const userRef = db.collection('users').doc(playerId);
          stateBatch.update(userRef, {
            status: 'idle',
            matchId: null,
            queuedAt: null,
            lastUpdated: now,
          });
        }
        
        await stateBatch.commit();
        console.log('✅ Player states reset');
      }
    }

    // Clean up ALL queue entries (fresh start)
    console.log('\n🧹 Cleaning up queue...');
    const queueRef = db.collection('queues').doc('quickMatch').collection('tickets');
    const queueSnapshot = await queueRef.get();

    if (queueSnapshot.empty) {
      console.log('✅ Queue is already empty');
    } else {
      console.log(`📋 Found ${queueSnapshot.size} queue entries to remove`);
      const queueBatch = db.batch();
      queueSnapshot.docs.forEach((doc) => {
        queueBatch.delete(doc.ref);
      });
      await queueBatch.commit();
      console.log(`✅ Deleted ${queueSnapshot.size} queue entries`);
    }

    // Reset ALL user states to idle (nuclear option - ensures clean slate)
    console.log('\n🔄 Resetting ALL user states to idle (clean slate)...');
    const usersSnapshot = await db.collection('users').get();
    
    if (!usersSnapshot.empty) {
      console.log(`📋 Found ${usersSnapshot.size} users`);
      
      // Process in batches of 500 (Firestore limit)
      const batches = [];
      let currentBatch = db.batch();
      let batchCount = 0;
      
      for (const userDoc of usersSnapshot.docs) {
        currentBatch.update(userDoc.ref, {
          status: 'idle',
          matchId: null,
          queuedAt: null,
          lastUpdated: admin.firestore.Timestamp.now(),
        });
        
        batchCount++;
        
        if (batchCount === 500) {
          batches.push(currentBatch);
          currentBatch = db.batch();
          batchCount = 0;
        }
      }
      
      // Add the last batch if it has items
      if (batchCount > 0) {
        batches.push(currentBatch);
      }
      
      // Commit all batches
      for (let i = 0; i < batches.length; i++) {
        await batches[i].commit();
        console.log(`  ✅ Batch ${i + 1}/${batches.length} committed`);
      }
      
      console.log(`✅ Reset ${usersSnapshot.size} user states to idle`);
    }

    console.log('\n✅ Cleanup complete!');
    console.log('\n📊 Summary:');
    console.log(`   - Matches closed: ${closedCount || 0}`);
    console.log(`   - Queue entries removed: ${queueSnapshot.size}`);
    console.log(`   - User states reset: ${usersSnapshot.size}`);
    console.log('\n🎮 Matchmaking is now ready for fresh start!');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

cleanupOldMatches()
  .then(() => {
    console.log('\n✅ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });





