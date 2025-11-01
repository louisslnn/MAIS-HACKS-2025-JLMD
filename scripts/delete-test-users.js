const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : null;

if (!serviceAccount) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT environment variable not set');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
});

const auth = admin.auth();
const db = admin.firestore();

// Test user email patterns
const testUserPatterns = [
  /^testuser\d+@mathclash\.test$/,
  /^e2etest\d+@mathclash\.test$/,
  /^player\d+@test\.com$/,
];

async function deleteTestUsers() {
  try {
    console.log('🧹 Starting test user cleanup...\n');

    // List all users
    const listUsersResult = await auth.listUsers();
    const allUsers = listUsersResult.users;

    // Filter test users
    const testUsers = allUsers.filter((user) => {
      if (!user.email) return false;
      return testUserPatterns.some((pattern) => pattern.test(user.email));
    });

    if (testUsers.length === 0) {
      console.log('✅ No test users found to delete');
      return;
    }

    console.log(`📋 Found ${testUsers.length} test users to delete:\n`);
    testUsers.forEach((user) => {
      console.log(`  - ${user.email} (${user.uid})`);
    });
    console.log('');

    // Delete from Auth
    console.log('🗑️  Deleting from Firebase Auth...');
    const deletePromises = testUsers.map(async (user) => {
      try {
        await auth.deleteUser(user.uid);
        console.log(`  ✅ Deleted ${user.email} from Auth`);
      } catch (error) {
        console.error(`  ❌ Failed to delete ${user.email} from Auth: ${error.message}`);
      }
    });
    await Promise.all(deletePromises);

    // Delete from Firestore
    console.log('\n🗑️  Deleting from Firestore...');
    const firestorePromises = testUsers.map(async (user) => {
      try {
        const userRef = db.collection('users').doc(user.uid);
        await userRef.delete();
        console.log(`  ✅ Deleted ${user.email} from Firestore`);
      } catch (error) {
        console.error(`  ❌ Failed to delete ${user.email} from Firestore: ${error.message}`);
      }
    });
    await Promise.all(firestorePromises);

    // Clean up queue entries
    console.log('\n🗑️  Cleaning up queue entries...');
    const queueRef = db.collection('queues').doc('quickMatch').collection('tickets');
    const queueSnapshot = await queueRef.get();
    let deletedFromQueue = 0;

    const batch = db.batch();
    queueSnapshot.docs.forEach((doc) => {
      const uid = doc.id;
      if (testUsers.some((u) => u.uid === uid)) {
        batch.delete(doc.ref);
        deletedFromQueue++;
      }
    });

    if (deletedFromQueue > 0) {
      await batch.commit();
      console.log(`  ✅ Deleted ${deletedFromQueue} queue entries`);
    } else {
      console.log('  ℹ️  No queue entries to delete');
    }

    console.log(`\n✅ Cleanup complete! Deleted ${testUsers.length} test users`);
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

deleteTestUsers()
  .then(() => {
    console.log('\n✅ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

