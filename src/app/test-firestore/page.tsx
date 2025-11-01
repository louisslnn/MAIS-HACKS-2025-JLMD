"use client";

import { useState } from "react";
import { 
  testFirestoreConnection, 
  testFirestoreWrite, 
  testAppCollections,
  runAllFirestoreTests,
  testFirestoreRealtime,
  type TestResult 
} from "@/lib/firebase/test-firestore";

export default function TestFirestorePage() {
  const [connectionResult, setConnectionResult] = useState<TestResult | null>(null);
  const [writeResult, setWriteResult] = useState<TestResult | null>(null);
  const [collectionsResult, setCollectionsResult] = useState<TestResult | null>(null);
  const [realtimeData, setRealtimeData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const handleConnectionTest = async () => {
    setIsLoading(true);
    const result = await testFirestoreConnection();
    setConnectionResult(result);
    setIsLoading(false);
  };

  const handleWriteTest = async () => {
    setIsLoading(true);
    const result = await testFirestoreWrite();
    setWriteResult(result);
    setIsLoading(false);
  };

  const handleCollectionsTest = async () => {
    setIsLoading(true);
    const result = await testAppCollections();
    setCollectionsResult(result);
    setIsLoading(false);
  };

  const handleAllTests = async () => {
    setIsLoading(true);
    const results = await runAllFirestoreTests();
    setConnectionResult(results.connection);
    setWriteResult(results.write);
    setCollectionsResult(results.collections);
    setIsLoading(false);
  };

  const handleRealtimeTest = () => {
    if (isSubscribed) {
      setIsSubscribed(false);
      setRealtimeData(null);
      return;
    }

    setIsSubscribed(true);
    const unsubscribe = testFirestoreRealtime(
      (data) => {
        setRealtimeData(data);
      },
      (error) => {
        console.error('Realtime error:', error);
        setIsSubscribed(false);
      }
    );

    // Store unsubscribe function
    (window as any).__firestoreUnsubscribe = unsubscribe;
  };

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-4xl font-bold mb-8">Firestore Connection Test</h1>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-800">
          This page tests the frontend&apos;s communication with Firestore.
          Check the browser console for detailed logs.
        </p>
      </div>

      <div className="space-y-6">
        {/* Quick Test All Button */}
        <div className="bg-white border rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Quick Test</h2>
          <button
            onClick={handleAllTests}
            disabled={isLoading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Running Tests..." : "Run All Tests"}
          </button>
        </div>

        {/* Individual Tests */}
        <div className="bg-white border rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Individual Tests</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={handleConnectionTest}
              disabled={isLoading}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              Test Connection
            </button>
            <button
              onClick={handleWriteTest}
              disabled={isLoading}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
            >
              Test Write
            </button>
            <button
              onClick={handleCollectionsTest}
              disabled={isLoading}
              className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
            >
              Test Collections
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-4">
          {/* Connection Result */}
          {connectionResult && (
            <div className={`border rounded-lg p-4 ${
              connectionResult.success 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <h3 className="font-semibold mb-2">
                Connection Test {connectionResult.success ? '✅' : '❌'}
              </h3>
              <p className="text-sm">{connectionResult.message}</p>
              {connectionResult.error && (
                <p className="text-xs text-red-600 mt-2">
                  Error: {connectionResult.error} {connectionResult.code && `(${connectionResult.code})`}
                </p>
              )}
            </div>
          )}

          {/* Write Result */}
          {writeResult && (
            <div className={`border rounded-lg p-4 ${
              writeResult.success 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <h3 className="font-semibold mb-2">
                Write Test {writeResult.success ? '✅' : '❌'}
              </h3>
              <p className="text-sm">{writeResult.message}</p>
              {writeResult.error && (
                <p className="text-xs text-red-600 mt-2">
                  Error: {writeResult.error} {writeResult.code && `(${writeResult.code})`}
                </p>
              )}
            </div>
          )}

          {/* Collections Result */}
          {collectionsResult && (
            <div className={`border rounded-lg p-4 ${
              collectionsResult.success 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <h3 className="font-semibold mb-2">
                Collections Test {collectionsResult.success ? '✅' : '❌'}
              </h3>
              <p className="text-sm">{collectionsResult.message}</p>
              {collectionsResult.error && (
                <p className="text-xs text-red-600 mt-2">
                  Error: {collectionsResult.error} {collectionsResult.code && `(${collectionsResult.code})`}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Real-time Test */}
        <div className="bg-white border rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Real-time Subscription Test</h2>
          <button
            onClick={handleRealtimeTest}
            disabled={isLoading}
            className={`px-4 py-2 rounded ${
              isSubscribed
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            } disabled:opacity-50`}
          >
            {isSubscribed ? "Stop Subscription" : "Start Real-time Test"}
          </button>
          {isSubscribed && (
            <div className="mt-4 p-4 bg-gray-50 rounded">
              <p className="text-sm font-mono">
                {realtimeData ? JSON.stringify(realtimeData, null, 2) : "Waiting for updates..."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

