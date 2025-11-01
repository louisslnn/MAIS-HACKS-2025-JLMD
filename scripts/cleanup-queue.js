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

async function cleanupQueue() {
  try {
    console.log('🧹 Cleaning up queue entries...\n');

    const queueRef = db.collection('queues').doc('quickMatch').collection('tickets');
    const snapshot = await queueRef.get();

    if (snapshot.empty) {
      console.log('✅ Queue is already empty');
      return;
    }

    console.log(`📋 Found ${snapshot.size} queue entries\n`);

    // Show all entries
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      const expiresAt = data.expiresAt?.toDate();
      const isExpired = expiresAt && expiresAt < new Date();
      console.log(`  - ${doc.id} (${data.displayName || 'Unknown'})`);
      console.log(`    Mode: ${data.mode}, Topic: ${data.topic}`);
      if (expiresAt) {
        console.log(`    Expires: ${expiresAt.toISOString()} ${isExpired ? '❌ EXPIRED' : '✅ Active'}`);
      }
      console.log('');
    });

    // Delete all entries
    console.log('🗑️  Deleting all queue entries...');
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    console.log(`✅ Deleted ${snapshot.size} queue entries\n`);

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

cleanupQueue()
  .then(() => {
    console.log('✅ Cleanup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

