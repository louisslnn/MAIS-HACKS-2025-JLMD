/**
 * Migration script to add new fields to existing data
 * Run with: node scripts/migrate-existing-data.js
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

const db = admin.firestore();

async function migrateData() {
  console.log('Starting data migration...\n');

  const buildSearchPrefixes = (name, maxPrefixes = 50) => {
    const normalized = (name || '').toLowerCase().trim();
    if (!normalized) {
      return [];
    }

    const prefixes = new Set();
    const words = normalized.split(/\s+/).filter(Boolean);

    for (const word of words) {
      let current = '';
      for (const char of word) {
        current += char;
        prefixes.add(current);
      }
    }

    let running = '';
    for (const char of normalized) {
      if (char === ' ') {
        running = '';
        continue;
      }
      running += char;
      prefixes.add(running);
    }

    prefixes.add(normalized);

    return Array.from(prefixes).filter(Boolean).slice(0, maxPrefixes);
  };
  
  // 1. Migrate existing queue tickets (add writingMode: false)
  console.log('1. Migrating queue tickets...');
  const ticketsRef = db.collection('queues/quickMatch/tickets');
  const ticketsSnap = await ticketsRef.get();
  
  const ticketBatch = db.batch();
  let ticketCount = 0;
  
  ticketsSnap.docs.forEach(doc => {
    const data = doc.data();
    if (data.writingMode === undefined) {
      ticketBatch.update(doc.ref, { writingMode: false });
      ticketCount++;
    }
  });
  
  if (ticketCount > 0) {
    await ticketBatch.commit();
    console.log(`✓ Updated ${ticketCount} queue tickets with writingMode: false\n`);
  } else {
    console.log('✓ No queue tickets to migrate\n');
  }
  
  // 2. Migrate existing active matches (add currentRoundIndex and handle async fields)
  console.log('2. Migrating active matches...');
  const matchesRef = db.collection('matches');
  const activeMatchesSnap = await matchesRef.where('status', '==', 'active').get();
  
  let matchCount = 0;
  
  for (const matchDoc of activeMatchesSnap.docs) {
    const matchData = matchDoc.data();
    const updates = {};
    let needsUpdate = false;
    
    // Add currentRoundIndex to players if missing
    for (const playerId of matchData.playerIds || []) {
      const player = matchData.players?.[playerId];
      if (player && player.currentRoundIndex === undefined) {
        // Set to 1 (they'll be on the first question)
        updates[`players.${playerId}.currentRoundIndex`] = 1;
        needsUpdate = true;
      }
    }
    
    if (needsUpdate) {
      await matchDoc.ref.update(updates);
      matchCount++;
    }
  }
  
  console.log(`✓ Updated ${matchCount} active matches with player progress fields\n`);

  // 3. Index user documents with search prefixes for name lookup
  console.log('3. Indexing user documents...');
  const usersRef = db.collection('users');
  const usersSnap = await usersRef.get();
  let userUpdateCount = 0;
  let batch = db.batch();
  const BATCH_LIMIT = 400;

  for (const userDoc of usersSnap.docs) {
    const data = userDoc.data() || {};
    const rawName = (data.displayName || '').trim();
    const resolvedName =
      rawName.length > 0
        ? rawName
        : data.email?.split('@')[0]?.trim() || 'Anonymous';
    const resolvedLower = resolvedName.toLowerCase();
    const prefixes = buildSearchPrefixes(resolvedName);

    const updates = {};

    if (data.displayName !== resolvedName) {
      updates.displayName = resolvedName;
    }
    if (data.displayNameLower !== resolvedLower) {
      updates.displayNameLower = resolvedLower;
    }
    if (!Array.isArray(data.searchPrefixes) || data.searchPrefixes.length === 0) {
      updates.searchPrefixes = prefixes;
    }

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
      batch.update(userDoc.ref, updates);
      userUpdateCount++;

      if (userUpdateCount % BATCH_LIMIT === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }
  }

  if (userUpdateCount % BATCH_LIMIT !== 0) {
    await batch.commit();
  }

  if (userUpdateCount > 0) {
    console.log(`✓ Indexed ${userUpdateCount} user documents with search prefixes\n`);
  } else {
    console.log('✓ All user documents already include search prefixes\n');
  }
  
  console.log('Migration complete! ✨');
  process.exit(0);
}

migrateData().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});
