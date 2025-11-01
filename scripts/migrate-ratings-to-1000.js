#!/usr/bin/env node

/**
 * Migration script: Reset all users with 1500 rating to the new 1000 baseline
 * Run this if you want to migrate existing users to the new Chess.com-style system
 */

const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : {
        type: 'service_account',
        project_id: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_ADMIN_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_ADMIN_CLIENT_ID,
      };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

const db = admin.firestore();

async function migrateRatings() {
  try {
    console.log('🔄 Starting rating migration...\n');
    
    // Get ALL users and reset to 1000 (as requested)
    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();
    
    if (snapshot.empty) {
      console.log('✅ No users found.');
      return;
    }
    
    console.log(`📊 Found ${snapshot.size} users\n`);
    
    // Process in batches of 500 (Firestore limit)
    let totalCount = 0;
    let batchCount = 0;
    let batch = db.batch();
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const currentRating = data.rating || 1500;
      
      batch.update(doc.ref, {
        rating: 1000,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      
      console.log(`  → ${data.displayName || doc.id}: ${currentRating} → 1000`);
      batchCount++;
      totalCount++;
      
      // Commit every 500 operations
      if (batchCount >= 500) {
        await batch.commit();
        console.log(`  ✅ Committed batch of ${batchCount} updates\n`);
        batch = db.batch();
        batchCount = 0;
      }
    }
    
    // Commit remaining
    if (batchCount > 0) {
      await batch.commit();
      console.log(`  ✅ Committed final batch of ${batchCount} updates\n`);
    }
    
    console.log(`\n✅ Successfully reset ${totalCount} users to 1000 rating`);
    
  } catch (error) {
    console.error('❌ Error migrating ratings:', error);
    process.exit(1);
  }
}

// Run migration
migrateRatings()
  .then(() => {
    console.log('\n✨ Migration complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

