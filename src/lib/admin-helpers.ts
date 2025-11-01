/**
 * Admin helper functions for debugging and cleanup
 * These can be called from browser console
 */

import { cleanupOldMatches } from './firebase/functions';

/**
 * Clean up all old matches and reset player states
 * Call this from browser console: window.runCleanup()
 */
export async function runCleanup() {
  try {
    console.log('🧹 Starting cleanup...');
    const result = await cleanupOldMatches();
    console.log('✅ Cleanup complete!', result.data);
    return result.data;
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  }
}

// Expose to window for console access
if (typeof window !== 'undefined') {
  (window as any).runCleanup = runCleanup;
}

