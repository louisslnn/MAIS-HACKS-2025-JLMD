"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui";
import { cleanupOldMatches } from "@/lib/firebase/functions";

export default function AdminPage() {
  const { user, loading } = useAuth();
  const [cleaning, setCleaning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCleanup = async () => {
    if (!confirm("This will close all old matches and reset player states. Continue?")) {
      return;
    }

    setCleaning(true);
    setError(null);
    setResult(null);

    try {
      const response = await cleanupOldMatches();
      setResult(response.data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Cleanup failed";
      setError(errorMessage);
    } finally {
      setCleaning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-ink-soft">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-ink mb-4">Admin Panel</h1>
          <p className="text-ink-soft">Please sign in to access admin functions</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-ink mb-8">Admin Panel</h1>

        <div className="space-y-6">
          {/* Cleanup Old Matches */}
          <div className="bg-white rounded-lg border border-border p-6">
            <h2 className="text-xl font-semibold text-ink mb-3">Clean Up Old Matches</h2>
            <p className="text-ink-soft mb-4">
              Closes all active matches older than 1 hour, resets all player states to idle, 
              and clears the queue. Use this to fix stuck matches and player states.
            </p>
            
            <Button 
              onClick={handleCleanup}
              disabled={cleaning}
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50"
            >
              {cleaning ? "Cleaning up..." : "Run Cleanup"}
            </Button>

            {result && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="font-semibold text-green-800 mb-2">✅ Cleanup Complete!</p>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• Matches closed: {result.matchesClosed}</li>
                  <li>• Queue entries removed: {result.queueEntriesRemoved}</li>
                  <li>• User states reset: {result.userStatesReset}</li>
                </ul>
              </div>
            )}

            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="font-semibold text-red-800">❌ Error</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="font-semibold text-blue-900 mb-2">ℹ️ When to Use</h3>
            <ul className="text-sm text-blue-800 space-y-2">
              <li>• Players stuck in old matches and can&apos;t queue</li>
              <li>• Multiple users in multiple games simultaneously</li>
              <li>• Queue has stale entries from disconnected players</li>
              <li>• Fresh start needed for testing</li>
            </ul>
          </div>

          {/* Console Alternative */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-2">💻 Console Alternative</h3>
            <p className="text-sm text-gray-700 mb-2">
              You can also run cleanup from the browser console:
            </p>
            <code className="block bg-gray-900 text-green-400 p-3 rounded text-sm font-mono">
              await window.runCleanup()
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}

