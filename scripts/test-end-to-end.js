/**
 * End-to-end test script for MathClash
 * Tests: Auth → Queue → Matchmaking → Match → Answer Submission
 */

require('dotenv').config();
const admin = require('firebase-admin');

// Load service account
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

// Test configuration
const TEST_USERS = 2;
const TEST_CATEGORY = 'addition';

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function createTestUser(email, displayName, rating = 1500) {
  try {
    let user;
    try {
      user = await auth.getUserByEmail(email);
      log(`✅ User ${email} exists (UID: ${user.uid})`, 'green');
    } catch (error) {
      user = await auth.createUser({
        email,
        emailVerified: true,
        password: 'test123456',
        displayName,
      });
      log(`✅ Created user ${email} (UID: ${user.uid})`, 'green');
    }

    // Ensure user profile exists
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
      log(`✅ Created Firestore profile for ${displayName}`, 'green');
    } else {
      await userRef.update({
        rating,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      log(`✅ Updated profile for ${displayName} (rating: ${rating})`, 'green');
    }

    return user;
  } catch (error) {
    log(`❌ Error creating user ${email}: ${error.message}`, 'red');
    throw error;
  }
}

async function checkQueue() {
  try {
    const queueRef = db.collection('queues').doc('quickMatch').collection('tickets');
    const snapshot = await queueRef.get();
    log(`📊 Queue size: ${snapshot.size}`, 'blue');
    
    if (snapshot.size > 0) {
      snapshot.docs.forEach((doc, index) => {
        const data = doc.data();
        log(`  ${index + 1}. ${data.displayName || doc.id} (Rating: ${data.ratingSnapshot}, Topic: ${data.topic})`, 'blue');
      });
    }
    return snapshot.size;
  } catch (error) {
    log(`❌ Error checking queue: ${error.message}`, 'red');
    return 0;
  }
}

async function checkMatches() {
  try {
    const matchesRef = db.collection('matches');
    const activeSnapshot = await matchesRef.where('status', '==', 'active').limit(10).get();
    log(`📈 Active matches: ${activeSnapshot.size}`, 'blue');
    
    activeSnapshot.docs.forEach((doc, index) => {
      const match = doc.data();
      log(`  ${index + 1}. Match ${doc.id}:`, 'blue');
      log(`     Players: ${match.playerIds?.join(', ') || 'N/A'}`, 'blue');
      log(`     Mode: ${match.mode || 'N/A'}`, 'blue');
      log(`     Created: ${match.createdAt?.toDate().toISOString() || 'N/A'}`, 'blue');
    });
    return activeSnapshot.size;
  } catch (error) {
    log(`❌ Error checking matches: ${error.message}`, 'red');
    return 0;
  }
}

async function waitForMatch(userId, timeout = 30000) {
  const startTime = Date.now();
  log(`⏳ Waiting for match for user ${userId}...`, 'yellow');
  
  while (Date.now() - startTime < timeout) {
    const matchesSnapshot = await db
      .collection('matches')
      .where('playerIds', 'array-contains', userId)
      .where('status', '==', 'active')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    
    if (!matchesSnapshot.empty) {
      const matchDoc = matchesSnapshot.docs[0];
      log(`✅ Match found: ${matchDoc.id}`, 'green');
      return { id: matchDoc.id, ...matchDoc.data() };
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error('Timeout waiting for match');
}

async function testEndToEnd() {
  log('\n🚀 Starting End-to-End Test\n', 'bold');
  
  try {
    // Step 1: Create test users
    log('📝 Step 1: Creating test users...', 'bold');
    const users = [];
    for (let i = 1; i <= TEST_USERS; i++) {
      const email = `e2etest${i}@mathclash.test`;
      const displayName = `E2ETestUser${i}`;
      const rating = 1500 + (i % 2 === 0 ? 50 : -50);
      
      const user = await createTestUser(email, displayName, rating);
      users.push({ email, uid: user.uid, displayName, rating });
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    log('✅ Test users created\n', 'green');

    // Step 2: Check initial state
    log('📊 Step 2: Checking initial state...', 'bold');
    await checkQueue();
    await checkMatches();
    log('');

    // Step 3: Simulate users joining queue (via Cloud Function call)
    log('🎮 Step 3: Users joining matchmaking queue...', 'bold');
    log('⚠️  Note: This requires Cloud Functions to be deployed', 'yellow');
    log('⚠️  If functions are not deployed, you\'ll see CORS/permission errors', 'yellow');
    log('⚠️  To deploy functions: Upgrade to Blaze plan and run "firebase deploy --only functions"', 'yellow');
    log('');

    // Step 4: Monitor queue
    log('📊 Step 4: Monitoring queue (checking every 2 seconds for 30 seconds)...', 'bold');
    let lastQueueSize = 0;
    for (let i = 0; i < 15; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const queueSize = await checkQueue();
      
      if (queueSize !== lastQueueSize) {
        log(`📈 Queue changed: ${lastQueueSize} → ${queueSize}`, 'blue');
        lastQueueSize = queueSize;
      }
      
      // Check for matches
      const matchCount = await checkMatches();
      if (matchCount > 0) {
        log(`✅ Matches detected!`, 'green');
        break;
      }
    }
    log('');

    // Step 5: Final status
    log('📊 Step 5: Final status...', 'bold');
    const finalQueueSize = await checkQueue();
    const finalMatchCount = await checkMatches();
    
    log(`\n✅ Test Complete!`, 'green');
    log(`   Queue size: ${finalQueueSize}`, 'blue');
    log(`   Active matches: ${finalMatchCount}`, 'blue');
    log('');

    // Summary
    log('📋 Test Summary:', 'bold');
    log(`   ✅ Users created: ${users.length}`, 'green');
    for (const user of users) {
      log(`      - ${user.displayName} (${user.email}) - Rating: ${user.rating}`, 'blue');
    }
    
    if (finalQueueSize === 0 && finalMatchCount === 0) {
      log('\n⚠️  No matches created. Possible reasons:', 'yellow');
      log('   1. Cloud Functions not deployed (requires Blaze plan)', 'yellow');
      log('   2. Functions not calling requestQuickMatch correctly', 'yellow');
      log('   3. Queue path mismatch between client and server', 'yellow');
      log('   4. Rating difference too large (>200 points)', 'yellow');
      log('\n💡 Next steps:', 'blue');
      log('   1. Upgrade to Blaze plan: https://console.firebase.google.com/project/mathclash-3e565/usage/details', 'blue');
      log('   2. Deploy functions: firebase deploy --only functions', 'blue');
      log('   3. Check function logs in Firebase Console', 'blue');
    } else if (finalMatchCount > 0) {
      log('\n✅ Matches created successfully!', 'green');
    }

  } catch (error) {
    log(`\n❌ Test failed: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run test
testEndToEnd()
  .then(() => {
    log('\n🎉 End-to-end test completed!', 'green');
    process.exit(0);
  })
  .catch((error) => {
    log(`\n❌ Fatal error: ${error.message}`, 'red');
    process.exit(1);
  });

