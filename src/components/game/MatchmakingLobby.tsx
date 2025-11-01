"use client";

import { useEffect, useState, useRef } from "react";
import { collection, onSnapshot, query, where, orderBy } from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui";
import { cancelQueue } from "@/lib/firebase/functions";

interface QueuePlayer {
  uid: string;
  displayName: string;
  ratingSnapshot: number;
  mode: string;
  topic: string;
  createdAt: Date;
}

interface MatchmakingLobbyProps {
  category: "addition" | "integrals";
  onCancel: () => void;
}

export function MatchmakingLobby({ category, onCancel }: MatchmakingLobbyProps) {
  const { user } = useAuth();
  const [queueSize, setQueueSize] = useState(0);
  const [waitTime, setWaitTime] = useState(0);
  const [playersInQueue, setPlayersInQueue] = useState<QueuePlayer[]>([]);
  const [isInQueue, setIsInQueue] = useState(false);
  const mountedRef = useRef(true);

  // Cleanup: Remove from queue when component unmounts (user navigates away)
  useEffect(() => {
    mountedRef.current = true;
    
    return () => {
      mountedRef.current = false;
      
      // When unmounting, cancel queue (user navigated away)
      if (user) {
        cancelQueue().catch((error) => {
          console.error("Failed to cancel queue on unmount:", error);
        });
      }
    };
  }, [user]);

  useEffect(() => {
    if (!firestore || !user) return;

    // Listen to queue for matching mode and topic
    // The queue is stored as a top-level collection "queues" 
    // In Admin SDK, collections.queues.quickMatch = "queues/quickMatch/tickets" 
    // but actually it's accessed as collection("queues").doc("quickMatch").collection("tickets")
    // For client SDK, we'll query the tickets subcollection directly
    // Try: queues/quickMatch/tickets (subcollection)
    const queueRef = collection(firestore, "queues", "quickMatch", "tickets");
    const queueQuery = query(
      queueRef,
      where("mode", "==", "ranked-1v1"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(
      queueQuery,
      (snapshot) => {
        const allPlayers = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            uid: doc.id,
            displayName: data.displayName || "Anonymous",
            ratingSnapshot: data.ratingSnapshot || 1000,
            mode: data.mode,
            topic: data.topic,
            createdAt: data.createdAt?.toDate() || new Date(),
          } as QueuePlayer;
        });

        // Filter by topic/category
        const categoryFilter = category === "integrals" ? "calculus" : "arith";
        const filteredPlayers = allPlayers.filter(
          (p) => p.topic === categoryFilter
        );

        setPlayersInQueue(filteredPlayers);
        setQueueSize(filteredPlayers.length);
        
        // Check if current user is in queue
        const userInQueue = filteredPlayers.some((p) => p.uid === user.uid);
        setIsInQueue(userInQueue);

        // Estimate wait time (rough: 30 seconds per player ahead, with a minimum)
        if (userInQueue) {
          const userIndex = filteredPlayers.findIndex((p) => p.uid === user.uid);
          const playersAhead = Math.max(0, userIndex - (userIndex % 2 === 0 ? 0 : 1));
          setWaitTime(Math.max(10, playersAhead * 15)); // At least 10s, 15s per player ahead
        } else {
          setWaitTime(0);
        }
      },
      (error) => {
        console.error("Queue listener error:", error);
        // If query fails, still show the lobby UI (component won't break)
        setQueueSize(0);
        setWaitTime(0);
        setPlayersInQueue([]);
      }
    );

    return () => unsubscribe();
  }, [user, category]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center gap-8 px-4 py-16">
      <div className="w-full max-w-2xl space-y-8 rounded-2xl border border-border bg-surface p-8 shadow-lg">
        {/* Header */}
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-brand border-t-transparent mb-6"></div>
          <h2 className="text-3xl font-bold text-ink mb-2">Searching for Opponent</h2>
          <p className="text-ink-soft">
            Looking for a player with similar skill level in{" "}
            <span className="font-semibold text-brand">
              {category === "integrals" ? "Integrals" : "Addition"}
            </span>
          </p>
        </div>

        {/* Queue Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl bg-surface-muted p-6 text-center">
            <div className="text-3xl font-bold text-brand mb-2">{queueSize}</div>
            <div className="text-sm text-ink-soft">Players in Queue</div>
          </div>
          <div className="rounded-xl bg-surface-muted p-6 text-center">
            <div className="text-3xl font-bold text-brand mb-2">
              {waitTime > 0 ? `${waitTime}s` : "—"}
            </div>
            <div className="text-sm text-ink-soft">Est. Wait Time</div>
          </div>
        </div>

        {/* Queue Players List (if any) */}
        {playersInQueue.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-ink">Players Waiting:</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {playersInQueue.slice(0, 5).map((player, index) => {
                const isCurrentUser = player.uid === user?.uid;
                return (
                  <div
                    key={player.uid}
                    className={`flex items-center justify-between rounded-lg border p-3 ${
                      isCurrentUser
                        ? "border-brand bg-brand/10"
                        : "border-border bg-surface-muted"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold ${
                          isCurrentUser ? "bg-brand" : "bg-ink-subtle"
                        }`}
                      >
                        {player.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-ink">
                          {player.displayName}
                          {isCurrentUser && (
                            <span className="ml-2 text-xs text-brand">(You)</span>
                          )}
                        </p>
                        <p className="text-xs text-ink-soft">
                          Rating: {player.ratingSnapshot}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-ink-subtle">
                        #{index + 1} in queue
                      </div>
                    </div>
                  </div>
                );
              })}
              {playersInQueue.length > 5 && (
                <p className="text-xs text-center text-ink-soft pt-2">
                  +{playersInQueue.length - 5} more players waiting
                </p>
              )}
            </div>
          </div>
        )}

        {/* Status Message */}
        {!isInQueue && (
          <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4 text-center">
            <p className="text-sm text-yellow-800">
              Joining queue... Please wait while we match you with an opponent.
            </p>
          </div>
        )}

        {/* Cancel Button */}
        <div className="flex justify-center pt-4">
          <Button onClick={onCancel} variant="outline" size="lg">
            Cancel Matchmaking
          </Button>
        </div>
      </div>

      {/* Tips */}
      <div className="w-full max-w-2xl rounded-xl border border-border bg-surface-muted/50 p-6">
        <h4 className="font-semibold text-ink mb-3">Matchmaking Tips</h4>
        <ul className="space-y-2 text-sm text-ink-soft">
          <li>• Matches are created when players with similar ratings are found</li>
          <li>• Rating difference: ±200 points for optimal matches</li>
          <li>• Queue refreshes every minute automatically</li>
          <li>• Your queue ticket expires after 5 minutes</li>
        </ul>
      </div>
    </div>
  );
}

