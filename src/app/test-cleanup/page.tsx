"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui";
import { cleanupOldMatches } from "@/lib/firebase/functions";

export default function TestCleanupPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<string>("Ready");
  const [result, setResult] = useState<any>(null);

  const runCleanup = async () => {
    if (!user) {
      setStatus("Please sign in first");
      return;
    }

    try {
      setStatus("Running cleanup...");
      const response = await cleanupOldMatches();
      setResult(response.data);
      setStatus("✅ Complete!");
    } catch (error) {
      setStatus("❌ Error: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  return (
    <div className="min-h-screen p-8 bg-surface">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-ink">Quick Cleanup</h1>
        
        <div className="bg-white rounded-lg border p-6 mb-4">
          <p className="mb-4 text-ink-soft">
            Click to clean up all old matches and reset player states:
          </p>
          <Button onClick={runCleanup} size="lg" className="mb-4">
            Run Cleanup Now
          </Button>
          
          <div className="mt-4 p-3 bg-gray-100 rounded">
            <p className="font-mono text-sm">Status: {status}</p>
          </div>
        </div>

        {result && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <h3 className="font-bold text-green-900 mb-2">Results:</h3>
            <ul className="text-sm text-green-800 space-y-1">
              <li>Matches closed: {result.matchesClosed}</li>
              <li>Queue entries removed: {result.queueEntriesRemoved}</li>
              <li>User states reset: {result.userStatesReset}</li>
            </ul>
          </div>
        )}

        <div className="mt-8 text-center">
          <p className="text-sm text-ink-soft">
            After cleanup, go to <a href="/play" className="text-brand underline">/play</a> to test matchmaking
          </p>
        </div>
      </div>
    </div>
  );
}





