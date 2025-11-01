/**
 * Simulate multiple users joining the matchmaking lobby and getting matched
 * Tests the complete lobby/matchmaking flow with multiple concurrent users
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

const envLocalPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
}

const admin = require('firebase-admin');
const { getFunctions, httpsCallable } = require('firebase/functions');
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');

// Load service account from environment
const serviceAccount = {
  type: process.env.FIREBASE_ADMIN_TYPE,
  project_id: process.env.FIREBASE_ADMIN_PROJECT_ID,
  private_key_id: process.env.FIREBASE_ADMIN_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_ADMIN_CLIENT_ID,
  auth_uri: process.env.FIREBASE_ADMIN_AUTH_URI,
  token_uri: process.env.FIREBASE_ADMIN_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_ADMIN_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_ADMIN_CLIENT_X509_CERT_URL,
  universe_domain: process.env.FIREBASE_ADMIN_UNIVERSE_DOMAIN,
};

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
  });
}

const auth = admin.auth();
const db = admin.firestore();

// Firebase client config (for calling functions)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

// Helper to create test user
async function createTestUser(email, displayName, rating = 1000) {
  try {
    let user;
    try {
      user = await auth.getUserByEmail(email);
      console.log(`✅ User ${email} already exists (UID: ${user.uid})`);
    } catch (error) {
      user = await auth.createUser({
        email,
        emailVerified: true,
        password: 'test123456',
        displayName,
      });
      console.log(`✅ Created user ${email} (UID: ${user.uid})`);
    }

    // Ensure user profile exists in Firestore
    const userRef = db.collection('users').doc(user.uid);
    const userSnap = await userRef.get();
    
    if (!userSnap.exists) {
      await userRef.set({
        displayName,
        email,
        rating,
        stats: {
          wins: 0,
          losses: 0,
          draws: 0,
          correctAnswers: 0,
          totalTimeMs: 0,
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`✅ Created Firestore profile for ${displayName}`);
    } else {
      // Update rating if needed
      await userRef.update({
        rating,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`✅ Updated Firestore profile for ${displayName} (rating: ${rating})`);
    }

    return user;
  } catch (error) {
    console.error(`❌ Error creating user ${email}:`, error.message);
    throw error;
  }
}

// Simulate a user requesting a match
async function simulateUserMatchmaking(userEmail, category = 'addition', delay = 0) {
  return new Promise(async (resolve, reject) => {
    try {
      if (delay > 0) {
        console.log(`⏳ Waiting ${delay}ms before ${userEmail} joins queue...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      console.log(`\n🎮 ${userEmail} joining matchmaking queue...`);

      // Initialize Firebase client for this user
      const app = initializeApp(firebaseConfig);
      const authClient = getAuth(app);
      
      // Sign in
      const userCred = await signInWithEmailAndPassword(authClient, userEmail, 'test123456');
      console.log(`✅ ${userEmail} signed in`);

      // Call requestQuickMatch function
      const functions = getFunctions(app, 'us-central1');
      const requestQuickMatch = httpsCallable(functions, 'requestQuickMatch');

      const topic = category === 'integrals' ? 'calculus' : 'arith';
      const result = await requestQuickMatch({
        mode: 'ranked-1v1',
        topic,
        difficulty: 'medium',
      });

      const data = result.data;
      console.log(`📊 ${userEmail} matchmaking result:`, data);

      if (data.matchId) {
        console.log(`🎯 ${userEmail} matched instantly! Match ID: ${data.matchId}`);
        resolve({ userEmail, matchId: data.matchId, instant: true });
      } else if (data.queued) {
        console.log(`⏸️ ${userEmail} queued. Waiting for match...`);
        
        // Listen for match creation
        const unsubscribe = db.collection('matches')
          .where('playerIds', 'array-contains', userCred.user.uid)
          .where('status', '==', 'active')
          .orderBy('createdAt', 'desc')
          .limit(1)
          .onSnapshot(
            (snapshot) => {
              if (!snapshot.empty) {
                const match = snapshot.docs[0];
                console.log(`🎯 ${userEmail} matched! Match ID: ${match.id}`);
                unsubscribe();
                resolve({ userEmail, matchId: match.id, instant: false });
              }
            },
            (error) => {
              console.error(`❌ Error listening for match for ${userEmail}:`, error);
              unsubscribe();
              reject(error);
            }
          );

        // Timeout after 60 seconds
        setTimeout(() => {
          unsubscribe();
          reject(new Error(`Timeout: ${userEmail} not matched within 60s`));
        }, 60000);
      }
    } catch (error) {
      console.error(`❌ Error simulating matchmaking for ${userEmail}:`, error.message);
      reject(error);
    }
  });
}

// Monitor queue status
async function monitorQueue() {
  console.log('\n📊 Monitoring queue...');
  
  const unsubscribe = db
    .collection('queues')
    .doc('quickMatch')
    .collection('tickets')
    .orderBy('createdAt', 'asc')
    .onSnapshot(
      (snapshot) => {
        const queueSize = snapshot.size;
        console.log(`📈 Queue size: ${queueSize} players`);
        
        if (queueSize > 0) {
          snapshot.docs.forEach((doc, index) => {
            const data = doc.data();
            console.log(`  ${index + 1}. ${data.displayName || doc.id} (Rating: ${data.ratingSnapshot}, Topic: ${data.topic})`);
          });
        }
      },
      (error) => {
        console.error('❌ Error monitoring queue:', error);
      }
    );

  return unsubscribe;
}

async function clearQueue() {
  const queueRef = db.collection('queues').doc('quickMatch').collection('tickets');
  const snapshot = await queueRef.get();

  if (snapshot.empty) {
    return;
  }

  console.log(`\n🧹 Clearing existing queue entries (${snapshot.size})...`);
  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  console.log('✅ Queue cleared\n');
}

// Main simulation
async function simulateLobby(numUsers = 4, category = 'addition', staggerDelay = 2000) {
  console.log('🚀 Starting Matchmaking Lobby Simulation');
  console.log(`📋 Configuration:`);
  console.log(`   - Users: ${numUsers}`);
  console.log(`   - Category: ${category}`);
  console.log(`   - Stagger delay: ${staggerDelay}ms`);
  console.log('');

  try {
    // Create test users
    console.log('👥 Creating test users...\n');
    const users = [];
    const baseRating = 1500;
    
    for (let i = 1; i <= numUsers; i++) {
      const email = `testuser${i}@mathclash.test`;
      const displayName = `TestUser${i}`;
      // Vary ratings slightly (±100 points) for better matching
      const rating = baseRating + (i % 2 === 0 ? 50 : -50) + (i - 1) * 20;
      
      const user = await createTestUser(email, displayName, rating);
      users.push({ email, uid: user.uid, displayName, rating });
      
      // Small delay between user creation
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n✅ All test users created\n');

    await clearQueue();

    // Start queue monitoring
    const queueUnsubscribe = await monitorQueue();

    // Simulate users joining queue with staggered delays
    console.log('🎮 Starting matchmaking simulation...\n');
    const matchmakingPromises = users.map((user, index) => {
      const delay = index * staggerDelay;
      return simulateUserMatchmaking(user.email, category, delay)
        .then(result => ({ ...result, user }))
        .catch(error => {
          console.error(`❌ Matchmaking failed for ${user.email}:`, error.message);
          return { userEmail: user.email, error: error.message };
        });
    });

    // Wait for all matchmaking attempts
    const results = await Promise.allSettled(matchmakingPromises);
    
    // Stop queue monitoring
    queueUnsubscribe();

    // Print results
    console.log('\n' + '='.repeat(60));
    console.log('📊 SIMULATION RESULTS');
    console.log('='.repeat(60));
    
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.matchId);
    const failed = results.filter(r => r.status === 'rejected' || r.value?.error);
    
    console.log(`✅ Successful matches: ${successful.length}`);
    console.log(`❌ Failed: ${failed.length}`);
    console.log('');

    successful.forEach((result, index) => {
      const value = result.value;
      const instant = value.instant ? '(instant)' : '(queued)';
      console.log(`${index + 1}. ${value.userEmail} → Match ${value.matchId} ${instant}`);
    });

    if (failed.length > 0) {
      console.log('\n❌ Failures:');
      failed.forEach((result, index) => {
        const reason = result.status === 'rejected' ? result.reason : result.value.error;
        console.log(`${index + 1}. ${result.status === 'fulfilled' ? result.value.userEmail : 'Unknown'}: ${reason}`);
      });
    }

    // Check for created matches
    console.log('\n🔍 Checking created matches...');
    const matchesSnapshot = await db.collection('matches')
      .where('status', '==', 'active')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    console.log(`📈 Total active matches: ${matchesSnapshot.size}`);
    matchesSnapshot.docs.forEach((doc, index) => {
      const match = doc.data();
      console.log(`  ${index + 1}. Match ${doc.id}:`);
      console.log(`     Players: ${match.playerIds.join(', ')}`);
      console.log(`     Mode: ${match.mode}`);
      console.log(`     Created: ${match.createdAt?.toDate().toISOString()}`);
    });

    console.log('\n✅ Simulation complete!');

  } catch (error) {
    console.error('❌ Simulation error:', error);
    process.exit(1);
  }
}

// Run simulation
const args = process.argv.slice(2);
const numUsers = parseInt(args[0]) || 4;
const category = args[1] || 'addition';
const staggerDelay = parseInt(args[2]) || 2000;

simulateLobby(numUsers, category, staggerDelay)
  .then(() => {
    console.log('\n🎉 All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
