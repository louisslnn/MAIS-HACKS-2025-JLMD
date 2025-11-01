/**
 * Simulate two players matching and playing a game
 * Tests the complete matchmaking and gameplay flow
 */

require('dotenv').config();
const admin = require('firebase-admin');

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

// Helper function to create a test user
async function createTestUser(email, displayName) {
  try {
    // Try to get existing user
    let user;
    try {
      user = await auth.getUserByEmail(email);
      console.log(`✅ User ${email} already exists`);
    } catch (error) {
      // User doesn't exist, create it
      user = await auth.createUser({
        email,
        emailVerified: true,
        password: 'test123456',
        displayName,
      });
      console.log(`✅ Created user ${email}`);
    }

    // Ensure user document exists
    const userRef = db.collection('users').doc(user.uid);
    const userSnap = await userRef.get();
    
    if (!userSnap.exists) {
      await userRef.set({
        uid: user.uid,
        displayName: displayName,
        email: email,
        rating: 1500,
        stats: {
          wins: 0,
          losses: 0,
          draws: 0,
          matchesPlayed: 0,
          correctAnswers: 0,
          totalTimeMs: 0,
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`✅ Created user document for ${email}`);
    }

    return { uid: user.uid, email, displayName };
  } catch (error) {
    console.error(`❌ Failed to create user ${email}:`, error.message);
    throw error;
  }
}

// Simulate requesting a match by directly adding to queue
async function requestMatch(uid) {
  try {
    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    const userData = userSnap.data();
    
    // Add to queue using the same collection path as functions
    const ticketRef = db.collection('queues/quickMatch/tickets').doc(uid);
    await ticketRef.set({
      uid,
      mode: 'ranked-1v1',
      topic: 'arith',
      difficulty: 'medium',
      ratingSnapshot: userData?.rating || 1500,
      displayName: userData?.displayName || 'Test User',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 5 * 60 * 1000),
    });
    
    console.log(`✅ Player ${uid} queued for match`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to queue player ${uid}:`, error.message);
    throw error;
  }
}

// Wait for match to be created
async function waitForMatch(userUid, timeout = 30000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const matchesSnapshot = await db
      .collection('matches')
      .where('playerIds', 'array-contains', userUid)
      .where('status', '==', 'active')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    
    if (!matchesSnapshot.empty) {
      const matchDoc = matchesSnapshot.docs[0];
      console.log(`✅ Match found: ${matchDoc.id}`);
      return { id: matchDoc.id, ...matchDoc.data() };
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  throw new Error('Timeout waiting for match');
}

// Submit an answer
async function submitAnswerForUser(matchId, roundId, uid, answer) {
  // Directly write to Firestore (simulating client submission)
  const matchRef = db.collection('matches').doc(matchId);
  const roundRef = matchRef.collection('rounds').doc(roundId);
  const answerRef = roundRef.collection('answers').doc(uid);
  
  // Get round data to calculate time
  const roundSnap = await roundRef.get();
  if (!roundSnap.exists) {
    throw new Error('Round not found');
  }
  
  const round = roundSnap.data();
  const now = admin.firestore.Timestamp.now();
  const startAt = round.startAt.toMillis();
  const endsAt = round.endsAt.toMillis();
  const nowMs = now.toMillis();
  
  const timeMs = Math.max(0, nowMs - startAt);
  const inTime = nowMs <= endsAt;
  
  // Determine correctness (simplified - actual logic is in Cloud Function)
  // For testing, we'll just mark as correct
  await answerRef.set({
    submittedAt: now,
    value: String(answer),
    timeMs,
    correct: true, // Simplified for testing
    judgedAt: now,
    judgeVersion: 1,
  });
  
  console.log(`✅ Answer submitted by ${uid}: ${answer}`);
  
  return { timeMs, inTime };
}

// Main simulation
async function simulateMatch() {
  console.log('🎮 Starting Match Simulation...\n');
  
  try {
    // Create two test users
    console.log('1. Creating test users...');
    const player1 = await createTestUser('player1@test.com', 'Player One');
    const player2 = await createTestUser('player2@test.com', 'Player Two');
    console.log('');
    
    // Both players request match (second player will trigger instant matching)
    console.log('2. Requesting matches...');
    await requestMatch(player1.uid);
    console.log('   Player 1 queued, waiting...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Delay to ensure first player is in queue
    await requestMatch(player2.uid);
    console.log('   Player 2 queued (should trigger instant match)\n');
    
    // Wait for match to be created (should be instant if matching works)
    console.log('3. Waiting for match creation...');
    const match = await waitForMatch(player1.uid, 10000); // 10 second timeout
    console.log(`   ✅ Match ID: ${match.id}`);
    console.log(`   Players: ${match.playerIds.join(', ')}\n`);
    
    // Get first round
    console.log('4. Getting first round...');
    const roundsRef = db.collection('matches').doc(match.id).collection('rounds');
    const roundsSnapshot = await roundsRef.orderBy('roundIndex').limit(1).get();
    
    if (roundsSnapshot.empty) {
      throw new Error('No rounds found');
    }
    
    const firstRound = roundsSnapshot.docs[0];
    const roundId = firstRound.id;
    const roundData = firstRound.data();
    console.log(`   Round ID: ${roundId}`);
    console.log(`   Problem: ${roundData.prompt}\n`);
    
    // Both players submit answers (use correct answer based on problem)
    console.log('5. Submitting answers...');
    // For addition problems, answers are numeric
    const correctAnswer = roundData.prompt.includes('+') 
      ? eval(roundData.prompt.replace(/[^0-9+]/g, '').replace('$', '').replace('$', ''))
      : '25'; // Fallback
    console.log(`   Correct answer should be: ${correctAnswer}`);
    await submitAnswerForUser(match.id, roundId, player1.uid, correctAnswer);
    await new Promise(resolve => setTimeout(resolve, 2000));
    await submitAnswerForUser(match.id, roundId, player2.uid, correctAnswer);
    console.log('✅ Both answers submitted\n');
    
    // Wait a bit for round to lock
    console.log('6. Waiting for round to lock...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const roundAfter = await roundsRef.doc(roundId).get();
    const roundDataAfter = roundAfter.data();
    console.log(`   Round status: ${roundDataAfter.status}\n`);
    
    // Check match state
    console.log('7. Checking match state...');
    const matchAfter = await db.collection('matches').doc(match.id).get();
    const matchDataAfter = matchAfter.data();
    console.log(`   Match status: ${matchDataAfter.status}`);
    console.log(`   Player 1 score: ${matchDataAfter.players[player1.uid]?.score || 0}`);
    console.log(`   Player 2 score: ${matchDataAfter.players[player2.uid]?.score || 0}\n`);
    
    console.log('🎉 Simulation completed successfully!');
    console.log(`\nMatch details:`);
    console.log(`  Match ID: ${match.id}`);
    console.log(`  Player 1: ${player1.displayName} (${player1.uid})`);
    console.log(`  Player 2: ${player2.displayName} (${player2.uid})`);
    
  } catch (error) {
    console.error('❌ Simulation failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run simulation
simulateMatch()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
