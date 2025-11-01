'use client';

import { useState } from 'react';
import { cleanupOldMatches, resetAllRatings, backfillUserDocuments } from '@/lib/firebase/functions';
import { Button } from '@/components/ui';

export default function AdminPage() {
  const [isRunningCleanup, setIsRunningCleanup] = useState(false);
  const [isRunningReset, setIsRunningReset] = useState(false);
  const [isRunningBackfill, setIsRunningBackfill] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [backfillResult, setBackfillResult] = useState<string | null>(null);

  async function runCleanup() {
    setIsRunningCleanup(true);
    setCleanupResult(null);
    
    try {
      const response = await cleanupOldMatches();
      setCleanupResult(JSON.stringify(response.data, null, 2));
    } catch (error) {
      setCleanupResult(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsRunningCleanup(false);
    }
  }

  async function runResetRatings() {
    if (!confirm('⚠️ This will reset ALL users to 1000 Elo rating.\n\nAre you absolutely sure?')) {
      return;
    }
    
    setIsRunningReset(true);
    setResetResult(null);
    
    try {
      console.log('Starting rating reset...');
      const response = await resetAllRatings();
      console.log('Reset complete:', response.data);
      setResetResult(JSON.stringify(response.data, null, 2));
      alert(`✅ Success! Reset ${response.data.count} users to 1000 Elo`);
    } catch (error) {
      console.error('Reset failed:', error);
      const errorMsg = `Error: ${error instanceof Error ? error.message : String(error)}`;
      setResetResult(errorMsg);
      alert(`❌ ${errorMsg}`);
    } finally {
      setIsRunningReset(false);
    }
  }

  async function runBackfill() {
    if (!confirm('🔧 This will create missing user documents for all Firebase Auth users.\n\nContinue?')) {
      return;
    }
    
    setIsRunningBackfill(true);
    setBackfillResult(null);
    
    try {
      console.log('Starting user document backfill...');
      const response = await backfillUserDocuments();
      console.log('Backfill complete:', response.data);
      setBackfillResult(JSON.stringify(response.data, null, 2));
      alert(`✅ Backfill complete!\n\nTotal users: ${response.data.totalUsers}\nCreated/Updated: ${response.data.backfilledCount}\nAlready complete: ${response.data.existingCount}\nErrors: ${response.data.errorCount}`);
    } catch (error) {
      console.error('Backfill failed:', error);
      const errorMsg = `Error: ${error instanceof Error ? error.message : String(error)}`;
      setBackfillResult(errorMsg);
      alert(`❌ ${errorMsg}`);
    } finally {
      setIsRunningBackfill(false);
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Admin Panel</h1>
      
      <div className="space-y-6">
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4 text-blue-900">🔧 Backfill User Documents</h2>
          <p className="text-blue-700 mb-4">
            Creates missing Firestore user documents for all Firebase Auth users. This ensures rating persistence works correctly.
            <br/><strong>Run this first if you're seeing +0 rating changes!</strong>
          </p>
          
          <Button
            onClick={runBackfill}
            disabled={isRunningBackfill}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isRunningBackfill ? 'Running Backfill...' : 'Backfill User Documents'}
          </Button>
          
          {backfillResult && (
            <pre className="mt-4 p-4 bg-white rounded text-sm overflow-auto border border-blue-200">
              {backfillResult}
            </pre>
          )}
        </div>

        <div className="border border-red-200 bg-red-50 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4 text-red-900">🔄 Reset All Ratings</h2>
          <p className="text-red-700 mb-4">
            This will reset ALL users to 1000 Elo rating (Chess.com baseline).
          </p>
          
          <Button
            onClick={runResetRatings}
            disabled={isRunningReset}
            className="bg-red-600 hover:bg-red-700"
          >
            {isRunningReset ? 'Resetting...' : 'Reset All Ratings to 1000'}
          </Button>
          
          {resetResult && (
            <pre className="mt-4 p-4 bg-white rounded text-sm overflow-auto border border-red-200">
              {resetResult}
            </pre>
          )}
        </div>

        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">🧹 Cleanup Old Matches</h2>
          <p className="text-ink-soft mb-4">
            This will close all active matches older than 1 hour and reset all player states.
          </p>
          
          <Button
            onClick={runCleanup}
            disabled={isRunningCleanup}
          >
            {isRunningCleanup ? 'Running...' : 'Run Cleanup'}
          </Button>
          
          {cleanupResult && (
            <pre className="mt-4 p-4 bg-ink-light rounded text-sm overflow-auto">
              {cleanupResult}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
