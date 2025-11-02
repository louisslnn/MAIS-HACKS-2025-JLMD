"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  doc,
  deleteDoc,
  where,
  getDocs,
  getDoc,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";
import { acceptFriendInvite } from "@/lib/firebase/functions";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
} from "@/components/ui";
import { X, Copy, Check, Trophy, Users, Star } from "lucide-react";

interface LeaderboardEntry {
  uid: string;
  displayName: string;
  rating: number;
  stats?: {
    wins: number;
    losses: number;
    draws: number;
    matchesPlayed: number;
  };
}

interface Friend {
  uid: string;
  displayName: string;
  rating: number;
  status: "online" | "in-match" | "offline";
  addedAt: Date;
}

export default function SocialPage() {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFullLeaderboard, setShowFullLeaderboard] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [pendingInvite, setPendingInvite] = useState<{
    uid: string;
    displayName: string;
    loading: boolean;
  } | null>(null);
  const [inviteActionError, setInviteActionError] = useState<string | null>(null);
  const [isAcceptingInvite, setIsAcceptingInvite] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteUidParam = searchParams.get("invite");

  // Generate invite link
  useEffect(() => {
    if (user) {
      const link = `${window.location.origin}/social?invite=${user.uid}`;
      setInviteLink(link);
    }
  }, [user]);

  // Subscribe to global leaderboard
  useEffect(() => {
    if (!firestore) {
      setLoading(false);
      return;
    }

    const usersRef = collection(firestore, "users");
    const leaderboardQuery = query(
      usersRef,
      orderBy("rating", "desc"),
      limit(100)
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

  // Subscribe to friends
  useEffect(() => {
    if (!firestore || !user) return;

    const friendsRef = collection(firestore, `users/${user.uid}/friends`);
    const friendsQuery = query(friendsRef, orderBy("addedAt", "desc"));

    const unsubscribe = onSnapshot(friendsQuery, async (snapshot) => {
      const friendsList: Friend[] = [];
      
      for (const friendDoc of snapshot.docs) {
        const data = friendDoc.data();
        // Fetch friend's current data
        const friendUserDoc = await getDocs(
          query(collection(firestore, "users"), where("__name__", "==", data.friendUid))
        );
        
        if (!friendUserDoc.empty) {
          const friendData = friendUserDoc.docs[0].data();
          friendsList.push({
            uid: data.friendUid,
            displayName: friendData.displayName || "Anonymous",
            rating: friendData.rating || 1000,
            status: determineStatus(friendData),
            addedAt: data.addedAt?.toDate() || new Date(),
          });
        }
      }
      
      setFriends(friendsList);
    });

    return () => unsubscribe();
  }, [user]);

  const addFriend = useCallback(async (friendUid: string) => {
    if (!user) {
      throw new Error("You need to be signed in to add friends.");
    }

    const { data } = await acceptFriendInvite({ inviterUid: friendUid });

    if (!data?.success) {
      throw new Error("Invitation failed to complete.");
    }

    if (data.alreadyFriends) {
      console.debug("Friendship already exists", { friendUid });
    }

    return data;
  }, [user]);

  const clearInviteParam = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("invite");
    const query = params.toString();
    router.replace(`/social${query ? `?${query}` : ""}`, { scroll: false });
  }, [router, searchParams]);

  useEffect(() => {
    if (!user || !firestore) return;

    if (!inviteUidParam) {
      return;
    }

    if (inviteUidParam === user.uid) {
      setPendingInvite({
        uid: inviteUidParam,
        displayName: user.displayName || "You",
        loading: false,
      });
      setInviteActionError("You can't add yourself as a friend.");
      setIsAcceptingInvite(false);
      setInviteModalOpen(true);
      return;
    }

    let cancelled = false;
    setPendingInvite({ uid: inviteUidParam, displayName: "", loading: true });
    setInviteActionError(null);
    setIsAcceptingInvite(false);
    setInviteModalOpen(true);

    (async () => {
      try {
        const profileSnap = await getDoc(doc(firestore, "users", inviteUidParam));
        if (cancelled) return;
        if (profileSnap.exists()) {
          const data = profileSnap.data() as { displayName?: string };
          setPendingInvite({
            uid: inviteUidParam,
            displayName: data.displayName || "Anonymous",
            loading: false,
          });
        } else {
          setPendingInvite({
            uid: inviteUidParam,
            displayName: "Unknown player",
            loading: false,
          });
          setInviteActionError("We couldn't find that player anymore.");
        }
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load invite profile:", error);
        setPendingInvite({
          uid: inviteUidParam,
          displayName: "Unknown player",
          loading: false,
        });
        setInviteActionError("Failed to load player info. Please try again later.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, firestore, inviteUidParam]);

  const handleDismissInvite = useCallback(() => {
    setInviteModalOpen(false);
    setPendingInvite(null);
    setInviteActionError(null);
    setIsAcceptingInvite(false);
    clearInviteParam();
  }, [clearInviteParam]);

  const handleAcceptInvite = useCallback(async () => {
    if (!pendingInvite || pendingInvite.loading) return;

    setIsAcceptingInvite(true);
    setInviteActionError(null);
    try {
      await addFriend(pendingInvite.uid);
      handleDismissInvite();
    } catch (error) {
      console.error("Failed to accept invite:", error);
      const message =
        error instanceof Error ? error.message : "Failed to add friend. Please try again.";
      setInviteActionError(message);
      setIsAcceptingInvite(false);
    }
  }, [pendingInvite, addFriend, handleDismissInvite]);

  const determineStatus = (userData: any): "online" | "in-match" | "offline" => {
    if (!userData.playerState) return "offline";
    
    const lastUpdated = userData.playerState.lastUpdated?.toDate();
    if (lastUpdated && Date.now() - lastUpdated.getTime() > 5 * 60 * 1000) {
      return "offline";
    }
    
    if (userData.playerState.status === "in-match") return "in-match";
    if (userData.playerState.status === "in-queue") return "online";
    return "online";
  };

  const removeFriend = async (friendUid: string) => {
    if (!user || !firestore) return;

    try {
      await deleteDoc(doc(firestore, `users/${user.uid}/friends/${friendUid}`));
      await deleteDoc(doc(firestore, `users/${friendUid}/friends/${user.uid}`));
    } catch (error) {
      console.error("Failed to remove friend:", error);
    }
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const friendsLeaderboard = friends
    .sort((a, b) => b.rating - a.rating)
    .map((friend, index) => ({ ...friend, rank: index + 1 }));

  const topTenLeaderboard = leaderboard.slice(0, 10);
  const userRank = leaderboard.findIndex((entry) => entry.uid === user?.uid) + 1;
  const userEntry = leaderboard.find((entry) => entry.uid === user?.uid);

  return (
    <>
      <Dialog open={inviteModalOpen} onClose={handleDismissInvite} title="Add this player?">
        {pendingInvite?.loading ? (
          <div className="flex items-center gap-3 text-ink-soft">
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Fetching player details…</span>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-ink">
              Do you want to add{" "}
              <span className="font-semibold">
                {pendingInvite?.displayName || "this player"}
              </span>{" "}
              to your friends list?
            </p>
            {inviteActionError && (
              <p className="text-sm text-red-600">{inviteActionError}</p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="subtle"
                onClick={handleDismissInvite}
                disabled={isAcceptingInvite}
              >
                Maybe later
              </Button>
              <Button
                onClick={handleAcceptInvite}
                disabled={isAcceptingInvite || pendingInvite?.loading}
              >
                {isAcceptingInvite ? (
                  <>
                    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Adding…
                  </>
                ) : (
                  "Add Friend"
                )}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
      <div className="space-y-8">
      <header className="space-y-4">
        <Badge variant="blue">Community Hub</Badge>
        <h1 className="text-4xl font-bold">Connect, Compete, Conquer.</h1>
        <p className="max-w-2xl text-lg text-ink-soft">
          Challenge friends, track your progress, and climb the global rankings. Your journey to math mastery starts here.
        </p>
      </header>

      {/* Your Stats Card */}
      {user && userEntry && (
        <Card className="bg-gradient-to-br from-brand/5 to-brand-secondary/5 border-brand/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-ink-soft mb-1">Your Rank</p>
                <p className="text-4xl font-bold text-brand">#{userRank}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-ink-soft mb-1">Your Rating</p>
                <p className="text-4xl font-bold">{userEntry.rating}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-ink-soft mb-1">Record</p>
                <p className="text-lg font-semibold">
                  {userEntry.stats ? (
                    <span className="text-green-600">{userEntry.stats.wins}W</span>
                  ) : "0W"} - {" "}
                  {userEntry.stats ? (
                    <span className="text-red-600">{userEntry.stats.losses}L</span>
                  ) : "0L"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Friends List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-brand" />
                  Friends
                </CardTitle>
                <CardDescription>
                  Connect with other players and track their progress
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Invite Link */}
            <div className="p-4 bg-surface-muted rounded-lg border border-border">
              <p className="text-sm font-medium mb-2">Invite Friends</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inviteLink}
                  readOnly
                  className="flex-1 px-3 py-2 text-sm bg-surface border border-border rounded-lg"
                />
                <Button
                  variant={copied ? "secondary" : "primary"}
                  size="sm"
                  onClick={copyInviteLink}
                  className="flex items-center gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Friends List */}
            {friends.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-ink-soft">No friends yet. Share your invite link to get started!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {friends.map((friend) => (
                  <div
                    key={friend.uid}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface hover:bg-surface-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand to-brand-secondary flex items-center justify-center text-white font-bold">
                          {friend.displayName.charAt(0).toUpperCase()}
                        </div>
                        <div
                          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface ${
                            friend.status === "online"
                              ? "bg-green-500"
                              : friend.status === "in-match"
                              ? "bg-yellow-500"
                              : "bg-gray-400"
                          }`}
                        />
                      </div>
                      <div>
                        <p className="font-semibold">{friend.displayName}</p>
                        <p className="text-sm text-ink-soft">
                          {friend.rating} Elo • {friend.status === "in-match" ? "In Match" : friend.status === "online" ? "Online" : "Offline"}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeFriend(friend.uid)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Friends Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Friends Leaderboard
            </CardTitle>
            <CardDescription>
              See how you stack up against your friends
            </CardDescription>
          </CardHeader>
          <CardContent>
            {friendsLeaderboard.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-ink-soft">Add friends to see your rankings!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {friendsLeaderboard.map((friend) => (
                  <div
                    key={friend.uid}
                    className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-surface-muted font-bold text-sm">
                        #{friend.rank}
                      </div>
                      <div>
                        <p className="font-semibold">{friend.displayName}</p>
                      </div>
                    </div>
                    <p className="font-bold text-brand">{friend.rating}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Global Leaderboard */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-6 w-6 text-yellow-500" />
                Global Leaderboard
              </CardTitle>
              <CardDescription>
                Top players worldwide, updated in real-time
              </CardDescription>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowFullLeaderboard(true)}
            >
              View Top 100
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-brand border-r-transparent"></div>
              <p className="text-ink-soft mt-2">Loading leaderboard...</p>
            </div>
          ) : topTenLeaderboard.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-ink-soft">No players yet. Be the first to play!</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-surface-muted">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-ink-subtle uppercase tracking-wider">
                      Rank
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-ink-subtle uppercase tracking-wider">
                      Player
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-ink-subtle uppercase tracking-wider">
                      Rating
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-ink-subtle uppercase tracking-wider">
                      Record
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-surface">
                  {topTenLeaderboard.map((player, index) => {
                    const isCurrentUser = user && player.uid === user.uid;
                    return (
                      <tr
                        key={player.uid}
                        className={`hover:bg-surface-muted transition-colors ${
                          isCurrentUser ? "bg-brand/10" : ""
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {index < 3 ? (
                              <Trophy
                                className={`h-5 w-5 ${
                                  index === 0
                                    ? "text-yellow-500"
                                    : index === 1
                                    ? "text-gray-400"
                                    : "text-orange-600"
                                }`}
                              />
                            ) : (
                              <span className="font-semibold text-ink">
                                #{index + 1}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-brand to-brand-secondary flex items-center justify-center text-white font-bold text-sm">
                              {player.displayName.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium">
                              {player.displayName}
                              {isCurrentUser && (
                                <span className="ml-2 text-xs text-brand font-semibold">
                                  (You)
                                </span>
                              )}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-lg font-bold text-brand">
                            {player.rating}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-ink-soft">
                          {player.stats ? (
                            <span>
                              <span className="text-green-600">{player.stats.wins}W</span> -{" "}
                              <span className="text-red-600">{player.stats.losses}L</span> -{" "}
                              <span className="text-gray-500">{player.stats.draws}D</span>
                            </span>
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
        </CardContent>
      </Card>

      {/* Full Leaderboard Modal */}
      {showFullLeaderboard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Trophy className="h-6 w-6 text-yellow-500" />
                  Top 100 Players
                </h2>
                <p className="text-sm text-ink-soft mt-1">Global rankings</p>
              </div>
              <button
                onClick={() => setShowFullLeaderboard(false)}
                className="p-2 hover:bg-surface-muted rounded-lg transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-surface-muted sticky top-0">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-ink-subtle uppercase tracking-wider">
                      Rank
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-ink-subtle uppercase tracking-wider">
                      Player
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-ink-subtle uppercase tracking-wider">
                      Rating
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-ink-subtle uppercase tracking-wider">
                      Record
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-ink-subtle uppercase tracking-wider">
                      Games
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {leaderboard.map((player, index) => {
                    const isCurrentUser = user && player.uid === user.uid;
                    return (
                      <tr
                        key={player.uid}
                        className={`hover:bg-surface-muted transition-colors ${
                          isCurrentUser ? "bg-brand/10" : ""
                        }`}
                      >
                        <td className="px-6 py-3 whitespace-nowrap">
                          {index < 3 ? (
                            <Trophy
                              className={`h-5 w-5 ${
                                index === 0
                                  ? "text-yellow-500"
                                  : index === 1
                                  ? "text-gray-400"
                                  : "text-orange-600"
                              }`}
                            />
                          ) : (
                            <span className="font-semibold text-sm">
                              #{index + 1}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-brand to-brand-secondary flex items-center justify-center text-white font-bold text-sm">
                              {player.displayName.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-sm">
                              {player.displayName}
                              {isCurrentUser && (
                                <span className="ml-2 text-xs text-brand font-semibold">
                                  (You)
                                </span>
                              )}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap">
                          <span className="font-bold text-brand">
                            {player.rating}
                          </span>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm">
                          {player.stats ? (
                            <span>
                              <span className="text-green-600">{player.stats.wins}W</span> -{" "}
                              <span className="text-red-600">{player.stats.losses}L</span> -{" "}
                              <span className="text-gray-500">{player.stats.draws}D</span>
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-ink-soft">
                          {player.stats?.matchesPlayed || 0}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
