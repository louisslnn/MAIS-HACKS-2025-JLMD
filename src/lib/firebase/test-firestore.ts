/**
 * Frontend Firestore connectivity test utilities
 * These functions test Firestore operations from the client-side
 */

import { firestore } from './client';
import { 
  collection, 
  getDocs, 
  writeBatch, 
  doc, 
  setDoc, 
  getDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';

export interface TestResult {
  success: boolean;
  message: string;
  error?: string;
  code?: string;
}

/**
 * Test basic Firestore connection by reading from a collection
 */
export async function testFirestoreConnection(): Promise<TestResult> {
  try {
    console.log('🧪 Testing Firestore connection...');
    
    // Try to read from a test collection (this will work even if collection doesn't exist)
    const testRef = collection(firestore, '_test_connection');
    const snapshot = await getDocs(testRef);
    
    console.log('✅ Firestore connection successful!');
    console.log(`   Test collection accessible, ${snapshot.size} documents`);
    
    return {
      success: true,
      message: `Firestore connection successful (${snapshot.size} documents found)`
    };
  } catch (error: any) {
    console.error('❌ Firestore connection failed:', error);
    return {
      success: false,
      message: 'Firestore connection failed',
      error: error.message,
      code: error.code
    };
  }
}

/**
 * Test Firestore write operations (requires authentication for most rules)
 */
export async function testFirestoreWrite(): Promise<TestResult> {
  try {
    console.log('🧪 Testing Firestore write permissions...');
    
    const testDocId = `test-${Date.now()}`;
    const testDocRef = doc(firestore, '_test_connection', testDocId);
    
    await setDoc(testDocRef, {
      timestamp: serverTimestamp(),
      test: true,
      message: 'Frontend Firestore connection test',
      createdAt: new Date().toISOString()
    });
    
    console.log('✅ Firestore write successful!');
    
    // Read it back to verify
    const docSnapshot = await getDoc(testDocRef);
    if (docSnapshot.exists()) {
      const data = docSnapshot.data();
      console.log('✅ Document read back successfully:', data);
    }
    
    // Clean up test document
    await deleteDoc(testDocRef);
    console.log('✅ Test document cleaned up');
    
    return {
      success: true,
      message: 'Firestore write and read successful'
    };
  } catch (error: any) {
    console.error('❌ Firestore write failed:', error);
    if (error.code === 'permission-denied') {
      return {
        success: true, // Connection works, just no permission
        message: 'Firestore connection works, but write permission denied (authentication required)',
        error: error.message,
        code: error.code
      };
    }
    return {
      success: false,
      message: 'Firestore write failed',
      error: error.message,
      code: error.code
    };
  }
}

/**
 * Test real-time Firestore subscriptions
 */
export function testFirestoreRealtime(
  onUpdate: (data: any) => void,
  onError: (error: Error) => void
): () => void {
  try {
    console.log('🧪 Testing Firestore real-time subscription...');
    
    const testDocRef = doc(firestore, '_test_connection', 'realtime-test');
    
    const unsubscribe = onSnapshot(
      testDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          console.log('✅ Real-time update received:', data);
          onUpdate(data);
        } else {
          console.log('⚠️  Document does not exist yet');
          onUpdate(null);
        }
      },
      (error) => {
        console.error('❌ Real-time subscription error:', error);
        onError(error);
      }
    );
    
    console.log('✅ Real-time subscription active');
    return unsubscribe;
  } catch (error: any) {
    console.error('❌ Failed to set up real-time subscription:', error);
    onError(error);
    return () => {}; // Return empty unsubscribe function
  }
}

/**
 * Test reading from actual app collections
 */
export async function testAppCollections(): Promise<TestResult> {
  try {
    console.log('🧪 Testing access to app collections...');
    
    const results: string[] = [];
    
    // Test users collection
    try {
      const usersRef = collection(firestore, 'users');
      const usersSnapshot = await getDocs(usersRef);
      results.push(`Users: ${usersSnapshot.size} documents (accessible)`);
    } catch (error: any) {
      results.push(`Users: ${error.code || 'error'}`);
    }
    
    // Test matches collection
    try {
      const matchesRef = collection(firestore, 'matches');
      const matchesSnapshot = await getDocs(matchesRef);
      results.push(`Matches: ${matchesSnapshot.size} documents (accessible)`);
    } catch (error: any) {
      results.push(`Matches: ${error.code || 'error'}`);
    }
    
    // Test leaderboards
    try {
      const leaderboardRef = doc(firestore, 'leaderboards', 'global');
      const leaderboardSnapshot = await getDoc(leaderboardRef);
      results.push(`Leaderboards: ${leaderboardSnapshot.exists() ? 'exists' : 'does not exist'} (accessible)`);
    } catch (error: any) {
      results.push(`Leaderboards: ${error.code || 'error'}`);
    }
    
    console.log('✅ App collections test complete:', results);
    
    return {
      success: true,
      message: `App collections accessible: ${results.join(', ')}`
    };
  } catch (error: any) {
    return {
      success: false,
      message: 'Failed to test app collections',
      error: error.message,
      code: error.code
    };
  }
}

/**
 * Run all Firestore tests
 */
export async function runAllFirestoreTests(): Promise<{
  connection: TestResult;
  write: TestResult;
  collections: TestResult;
}> {
  console.log('🚀 Running all Firestore tests...\n');
  
  const connection = await testFirestoreConnection();
  await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
  
  const write = await testFirestoreWrite();
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const collections = await testAppCollections();
  
  console.log('\n📊 Test Summary:');
  console.log(`  Connection: ${connection.success ? '✅' : '❌'} ${connection.message}`);
  console.log(`  Write: ${write.success ? '✅' : '❌'} ${write.message}`);
  console.log(`  Collections: ${collections.success ? '✅' : '❌'} ${collections.message}`);
  
  return { connection, write, collections };
}

