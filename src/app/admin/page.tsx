'use client';

import { useState } from 'react';
import { cleanupOldMatches, resetAllRatings } from '@/lib/firebase/functions';
import { Button } from '@/components/ui';

export default function AdminPage() {
  const [isRunningCleanup, setIsRunningCleanup] = useState(false);
  const [isRunningReset, setIsRunningReset] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<string | null>(null);

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

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Admin Panel</h1>
      
      <div className="space-y-6">
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
