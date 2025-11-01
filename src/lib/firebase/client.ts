import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectDatabaseEmulator, getDatabase } from 'firebase/database';

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const resolvedAuthDomain =
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
  (projectId ? `${projectId}.firebaseapp.com` : undefined);

const rawStorageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const resolvedStorageBucket = rawStorageBucket?.endsWith('.firebasestorage.app')
  ? rawStorageBucket.replace('.firebasestorage.app', '.appspot.com')
  : rawStorageBucket;

if (!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN && resolvedAuthDomain) {
  console.warn(
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN is missing. Falling back to',
    resolvedAuthDomain,
  );
}

if (rawStorageBucket && rawStorageBucket !== resolvedStorageBucket) {
  console.warn(
    'Detected legacy Firebase storage bucket domain. Using',
    resolvedStorageBucket,
    'instead.',
  );
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: resolvedAuthDomain,
  projectId,
  storageBucket: resolvedStorageBucket,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const missing = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

// Check if we're using emulators - if so, we can use a minimal config
const useEmulators = process.env.NEXT_PUBLIC_APP_ENV === 'development' || 
                     process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true';

if (missing.length > 0) {
  if (useEmulators && missing.length < Object.keys(firebaseConfig).length) {
    // Some config provided, proceed with warnings for missing values
    console.warn('Missing Firebase config values:', missing.join(', '));
    console.warn('Using provided values. Make sure Firebase emulators are running if missing values are needed.');
  } else if (missing.length === Object.keys(firebaseConfig).length) {
    // All config missing - check if we should use emulators with dummy config
    if (useEmulators) {
      console.warn('All Firebase config values are missing. Using emulator-safe dummy config.');
      // Use dummy values for emulators
      Object.assign(firebaseConfig, {
        apiKey: 'demo-api-key',
        authDomain: 'demo-project.firebaseapp.com',
        projectId: 'demo-project',
        storageBucket: 'demo-project.appspot.com',
        messagingSenderId: '123456789',
        appId: '1:123456789:web:abcdef',
        measurementId: 'G-XXXXXXXXXX',
      });
    } else {
      const errorMsg = `Missing required Firebase config values: ${missing.join(', ')}\n\n` +
        `Please create a .env.local file with your Firebase configuration.\n` +
        `See .env.local.example for a template.`;
      throw new Error(errorMsg);
    }
  } else {
    // Some missing but not all - throw error as it's likely misconfigured
    const errorMsg = `Missing required Firebase config values: ${missing.join(', ')}\n\n` +
      `Please add these to your .env.local file.`;
    throw new Error(errorMsg);
  }
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const firebaseApp = app;
export const auth = getAuth(app);
export const firestore = getFirestore(app);
export const realtimeDb = getDatabase(app);

// Log Firestore initialization in development
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  console.log('✅ Firebase initialized:', {
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
    usingEmulators: process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true'
  });
  console.log('✅ Firestore instance ready');
}

export const attachFirebaseEmulators = () => {
  // Only attach emulators if explicitly enabled
  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS !== 'true') {
    return;
  }

  try {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
    connectDatabaseEmulator(realtimeDb, '127.0.0.1', 9000);
    console.log('✅ Connected to Firebase emulators');
  } catch (error) {
    console.warn('Failed to connect emulators', error);
  }
};

// Only auto-attach emulators if explicitly enabled (not just in development mode)
if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true') {
  if (typeof window === 'undefined') {
    // Server-side: attach emulators immediately
    attachFirebaseEmulators();
  } else {
    // Client-side: attach emulators on first load
    const global = globalThis as typeof globalThis & { __firebase_emulators_attached?: boolean };
    if (!global.__firebase_emulators_attached) {
      attachFirebaseEmulators();
      global.__firebase_emulators_attached = true;
    }
  }
}
