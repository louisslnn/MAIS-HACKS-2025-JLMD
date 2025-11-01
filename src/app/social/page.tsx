"use client";

import { useState, useEffect } from "react";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";

const friends = [
  { id: "1", name: "Nova", status: "Online", streak: 4 },
  { id: "2", name: "Kai", status: "In match", streak: 7 },
  { id: "3", name: "Rin", status: "Offline", streak: 2 },
];

interface LeaderboardEntry {
  uid: string;
  displayName: string;
  rating: number;
  stats?: {
    wins: number;
    losses: number;
    draws: number;
  };
}

export default function SocialPage() {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firestore) {
      console.warn("Firebase not initialized");
      // Don't set loading here - let it be set by the effect cleanup
      return () => {
        setLoading(false);
      };
    }

    const usersRef = collection(firestore, "users");
    const leaderboardQuery = query(
      usersRef,
      orderBy("rating", "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      leaderboardQuery,
      (snapshot) => {
        const entries: LeaderboardEntry[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            uid: doc.id,
            displayName: data.displayName || "Anonymous",
            rating: data.rating || 1000,
            stats: data.stats,
          };
        });
        setLeaderboard(entries);
        setLoading(false);
      },
      (error) => {
        console.error("Leaderboard subscription error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);
  return (
    <div className="space-y-12">
      <header className="space-y-4">
        <Badge variant="blue">Community pulse</Badge>
        <h1>Track your squad, spark rematches, and climb the ladder.</h1>
        <p className="max-w-2xl">
          Friends, streaks, and rankings live in two focused panels. Presence and Elo
          updates stream in real time so you always know who is ready to play.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Friends list</CardTitle>
              <CardDescription>
                See who is online, in a match, or on a hot streak at a glance.
              </CardDescription>
            </div>
            <Button variant="secondary" size="sm">
              Add friend
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {friends.map((friend) => (
              <div
                key={friend.id}
                className="flex flex-col gap-3 rounded-[var(--radius-sm)] border border-border bg-surface px-4 py-4 text-sm text-ink sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-base font-semibold text-ink">{friend.name}</p>
                  <p className="text-sm text-ink-soft">
                    {friend.status} · {friend.streak}-match streak
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="primary" size="sm">
                    Rematch
                  </Button>
                  <Button variant="outline" size="sm">
                    Spectate
                  </Button>
                </div>
              </div>
            ))}
            <p className="text-xs text-ink-subtle">
              Offline players drop off automatically to keep the roster accurate.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-2">
            <CardTitle>Global leaderboard</CardTitle>
            <CardDescription>
              Watch rankings shift after every match and filter by region to scout new
              rivals.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="text-center py-8">
                <p className="text-ink-soft">Loading leaderboard...</p>
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-ink-soft">No players yet. Be the first to play!</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-[var(--radius-sm)] border border-border">
                <table className="min-w-full divide-y divide-border text-left text-sm text-ink">
                  <thead className="bg-surface-muted text-xs uppercase tracking-[0.18em] text-ink-subtle">
                    <tr>
                      <th className="px-4 py-3">Rank</th>
                      <th className="px-4 py-3">Player</th>
                      <th className="px-4 py-3">Rating</th>
                      <th className="px-4 py-3">Record</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/70">
                    {leaderboard.map((player, index) => {
                      const isCurrentUser = user && player.uid === user.uid;
                      return (
                        <tr 
                          key={player.uid} 
                          className={`hover:bg-surface-muted ${isCurrentUser ? "bg-brand-secondary/10" : ""}`}
                        >
                          <td className="px-4 py-3 font-semibold text-ink">
                            #{index + 1}
                          </td>
                          <td className="px-4 py-3">
                            {player.displayName}
                            {isCurrentUser && (
                              <span className="ml-2 text-xs text-brand">(You)</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-medium text-brand">
                            {player.rating}
                          </td>
                          <td className="px-4 py-3 text-xs text-ink-subtle">
                            {player.stats ? (
                              <>
                                {player.stats.wins}W-{player.stats.losses}L-{player.stats.draws}D
                              </>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-ink-subtle">
              Ratings update the moment a match ends, so streaks and placements are
              always current.
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle>Keep the loop social</CardTitle>
          <CardDescription>
            Clean actions encourage rematches and quick practice hops straight from
            the leaderboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {[
            "Send a rematch invite instantly once the final round locks.",
            "Spectate friends live without interrupting their match.",
            "Share invite links that expire quickly to keep rooms secure.",
          ].map((note) => (
            <div
              key={note}
              className="rounded-[var(--radius-sm)] border border-border bg-surface-muted px-4 py-3 text-sm text-ink-soft"
            >
              {note}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
