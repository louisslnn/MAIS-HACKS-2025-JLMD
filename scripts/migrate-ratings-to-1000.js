#!/usr/bin/env node

/**
 * Migration script: Reset all users with 1500 rating to the new 1000 baseline
 * Run this if you want to migrate existing users to the new Chess.com-style system
 */

const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : require('../service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

const db = admin.firestore();

async function migrateRatings() {
  try {
    console.log('🔄 Starting rating migration...\n');
    
    // Get all users with 1500 rating (old default)
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('rating', '==', 1500).get();
    
    if (snapshot.empty) {
      console.log('✅ No users found with 1500 rating. Migration not needed.');
      return;
    }
    
    console.log(`📊 Found ${snapshot.size} users with 1500 rating\n`);
    
    // Batch update users
    const batch = db.batch();
    let count = 0;
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      const gamesPlayed = data.stats?.matchesPlayed || 0;
      
      // Only migrate users who haven't played many games yet
      if (gamesPlayed <= 5) {
        batch.update(doc.ref, {
          rating: 1000,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`  → ${data.displayName || doc.id}: 1500 → 1000 (${gamesPlayed} games)`);
        count++;
      } else {
        console.log(`  ⊘ ${data.displayName || doc.id}: Keeping 1500 (${gamesPlayed} games played)`);
      }
    });
    
    if (count > 0) {
      await batch.commit();
      console.log(`\n✅ Successfully migrated ${count} users to 1000 rating`);
    } else {
      console.log('\n✅ No users needed migration (all have 5+ games)');
    }
    
    // Show summary
    console.log('\n📈 Migration Summary:');
    console.log(`   Total users checked: ${snapshot.size}`);
    console.log(`   Users migrated: ${count}`);
    console.log(`   Users kept at 1500: ${snapshot.size - count}`);
    
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

