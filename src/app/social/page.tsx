"use client";

import { useState, useEffect, useCallback, Suspense, useMemo, useRef } from "react";
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
  startAt,
  endAt,
  updateDoc,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";
import { acceptFriendInvite, sendFriendRequest } from "@/lib/firebase/functions";
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
  Input,
} from "@/components/ui";
import { X, Copy, Check, Trophy, Users, Star, Bell, Search, UserPlus, Loader2 } from "lucide-react";

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

interface FriendRequest {
  senderUid: string;
  senderDisplayName: string;
  senderRating: number;
  senderPhotoURL: string | null;
  createdAt: Date;
  read: boolean;
}

interface PlayerSearchResult {
  uid: string;
  displayName: string;
  rating: number;
  isFriend: boolean;
  requestPending: boolean;
  incomingRequest: boolean;
}

interface RankTier {
  label: string;
  colorClass: string;
}

function computeRankTier(rank: number, totalPlayers: number): RankTier | null {
  if (!totalPlayers || rank < 1) {
    return null;
  }

  const gmCutoff = Math.max(1, Math.floor(totalPlayers * 0.01)); // Top 1%
  const masterCutoff = Math.max(gmCutoff + 1, Math.floor(totalPlayers * 0.05)); // Top 5%

  if (rank <= gmCutoff) {
    return { label: "GM", colorClass: "bg-purple-600 text-white" };
  }

  if (rank <= masterCutoff) {
    return { label: "Master", colorClass: "bg-brand-secondary/20 text-brand-secondary" };
  }

  return null;
}

function SocialPageContent() {
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
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<PlayerSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [requestActionError, setRequestActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{ uid: string; type: "send" | "accept" | "decline" } | null>(null);
  const [pendingOutgoingRequests, setPendingOutgoingRequests] = useState<Set<string>>(new Set());
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteUidParam = searchParams.get("invite");
  const notificationsAnchorRef = useRef<HTMLDivElement | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const friendsSet = useMemo(() => new Set(friends.map((friend) => friend.uid)), [friends]);
  const incomingRequestSet = useMemo(
    () => new Set(friendRequests.map((request) => request.senderUid)),
    [friendRequests],
  );
  const unreadRequestCount = useMemo(
    () => friendRequests.filter((request) => !request.read).length,
    [friendRequests],
  );
  const hasSearchTerm = searchTerm.trim().length > 0;

  // Generate invite link
  useEffect(() => {
    if (user) {
      const link = `${window.location.origin}/social?invite=${user.uid}`;
      setInviteLink(link);
    }
  }, [user]);

  useEffect(() => {
    if (!notificationsOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        notificationsAnchorRef.current &&
        !notificationsAnchorRef.current.contains(event.target as Node)
      ) {
        setNotificationsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [notificationsOpen]);

  useEffect(() => {
    if (!notificationsOpen) {
      setRequestActionError(null);
    }
  }, [notificationsOpen]);

  useEffect(() => {
    if (!notificationsOpen || !user || !firestore) return;
    if (friendRequests.length === 0) return;

    const unread = friendRequests.filter((request) => !request.read);
    if (unread.length === 0) return;

    unread.forEach((request) => {
      const requestRef = doc(
        firestore,
        `users/${user.uid}/friendRequests/${request.senderUid}`,
      );
      updateDoc(requestRef, { read: true }).catch((error) => {
        console.error("Failed to mark friend request as read:", error);
      });
    });
  }, [notificationsOpen, friendRequests, user]);

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

  // Subscribe to incoming friend requests
  useEffect(() => {
    if (!firestore || !user) return;

    const requestsRef = collection(firestore, `users/${user.uid}/friendRequests`);
    const requestsQuery = query(requestsRef, orderBy("createdAt", "desc"), limit(20));

    const unsubscribe = onSnapshot(
      requestsQuery,
      (snapshot) => {
        const requests: FriendRequest[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          let createdAt: Date = new Date();
          const rawCreatedAt = data.createdAt;
          if (rawCreatedAt && typeof rawCreatedAt === "object") {
            if (typeof rawCreatedAt.toDate === "function") {
              createdAt = rawCreatedAt.toDate();
            } else if (typeof rawCreatedAt.seconds === "number") {
              createdAt = new Date(rawCreatedAt.seconds * 1000);
            }
          }

          return {
            senderUid: docSnap.id,
            senderDisplayName: data.senderDisplayName || "Anonymous",
            senderRating: data.senderRating || 1000,
            senderPhotoURL: data.senderPhotoURL ?? null,
            createdAt,
            read: Boolean(data.read),
          };
        });
        setFriendRequests(requests);
      },
      (error) => {
        console.error("Friend requests subscription error:", error);
      },
    );

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

  useEffect(() => {
    if (!firestore || !user) return;

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }

    const trimmedRaw = searchTerm.trim();
    if (!trimmedRaw) {
      setIsSearching(false);
      setSearchError(null);
      setSearchResults([]);
      return;
    }

    const normalizedTerm = trimmedRaw.toLowerCase();
    setIsSearching(true);
    setSearchError(null);

    searchDebounceRef.current = setTimeout(async () => {
      try {
        const usersRef = collection(firestore, "users");
        const aggregated = new Map<string, PlayerSearchResult>();

        const primaryQuery = query(
          usersRef,
          where("searchPrefixes", "array-contains", normalizedTerm),
          limit(10),
        );

        let snapshots: QueryDocumentSnapshot<DocumentData>[] = [];
        try {
          const primarySnapshot = await getDocs(primaryQuery);
          snapshots = primarySnapshot.docs;
        } catch (error) {
          console.error("Prefix search query failed:", error);
        }

        if (snapshots.length === 0) {
          try {
            const fallbackSnapshot = await getDocs(
              query(
                usersRef,
                orderBy("displayNameLower"),
                startAt(normalizedTerm),
                endAt(`${normalizedTerm}\uf8ff`),
                limit(10),
              ),
            );
            snapshots = fallbackSnapshot.docs;
          } catch (fallbackError) {
            console.error("Fallback search query failed:", fallbackError);
          }
        }

        await Promise.all(
          snapshots
            .filter((docSnap) => docSnap.id !== user.uid)
            .map(async (docSnap) => {
              if (aggregated.has(docSnap.id)) return;
              const data = docSnap.data();
              const nameLower =
                typeof data.displayNameLower === "string"
                  ? data.displayNameLower
                  : (data.displayName || "").toLowerCase();

              if (nameLower && !nameLower.includes(normalizedTerm)) {
                // Ensure fallback results still match the search
                return;
              }

              const targetUid = docSnap.id;
              const isFriend = friendsSet.has(targetUid);
              const incomingRequest = incomingRequestSet.has(targetUid);
              let requestPending = pendingOutgoingRequests.has(targetUid);

              if (!requestPending && !isFriend) {
                try {
                  const targetRequestSnap = await getDoc(
                    doc(firestore, `users/${targetUid}/friendRequests/${user.uid}`),
                  );
                  requestPending = targetRequestSnap.exists();
                  if (requestPending) {
                    setPendingOutgoingRequests((prev) => {
                      if (prev.has(targetUid)) {
                        return prev;
                      }
                      const next = new Set(prev);
                      next.add(targetUid);
                      return next;
                    });
                  }
                } catch (error) {
                  console.error("Failed to check existing friend request:", error);
                }
              }

              aggregated.set(targetUid, {
                uid: targetUid,
                displayName: data.displayName || "Anonymous",
                rating: data.rating || 1000,
                isFriend,
                requestPending,
                incomingRequest,
              });
            }),
        );

        if (leaderboard.length > 0) {
          leaderboard.forEach((entry) => {
            if (aggregated.has(entry.uid)) {
              return;
            }
            const displayName = entry.displayName || "";
            const lowerName = displayName.toLowerCase();
            if (!lowerName.includes(normalizedTerm)) {
              return;
            }

            const targetUid = entry.uid;
            const isFriend = friendsSet.has(targetUid);
            const incomingRequest = incomingRequestSet.has(targetUid);
            const requestPending = pendingOutgoingRequests.has(targetUid);

            aggregated.set(targetUid, {
              uid: targetUid,
              displayName: displayName || "Anonymous",
              rating: entry.rating || 1000,
              isFriend,
              requestPending,
              incomingRequest,
            });
          });
        }

        setSearchResults(Array.from(aggregated.values()));
      } catch (error) {
        console.error("User search failed:", error);
        setSearchError("We couldn't load players right now. Please try again shortly.");
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
    };
  }, [searchTerm, user, friendsSet, incomingRequestSet, pendingOutgoingRequests, firestore, leaderboard]);

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

  const handleSendFriendRequest = useCallback(
    async (targetUid: string) => {
      if (!user) {
        setSearchError("You need to be signed in to send friend requests.");
        return;
      }

      setPendingAction({ uid: targetUid, type: "send" });
      setRequestActionError(null);
      try {
        const response = await sendFriendRequest({ targetUid });
        const outcome = response.data;

        if (!outcome?.success) {
          throw new Error("Unable to send that friend request right now.");
        }

        setSearchError(null);

        if (outcome.alreadyFriends || outcome.autoAccepted) {
          setSearchResults((prev) =>
            prev.map((result) =>
              result.uid === targetUid
                ? {
                    ...result,
                    isFriend: true,
                    requestPending: false,
                    incomingRequest: false,
                  }
                : result,
            ),
          );
          setPendingOutgoingRequests((prev) => {
            if (!prev.has(targetUid)) {
              return prev;
            }
            const next = new Set(prev);
            next.delete(targetUid);
            return next;
          });
        } else {
          setPendingOutgoingRequests((prev) => {
            if (prev.has(targetUid)) return prev;
            const next = new Set(prev);
            next.add(targetUid);
            return next;
          });
          setSearchResults((prev) =>
            prev.map((result) =>
              result.uid === targetUid
                ? { ...result, requestPending: true }
                : result,
            ),
          );
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "We couldn't send that friend request.";
        setSearchError(message);
      } finally {
        setPendingAction(null);
      }
    },
    [user, sendFriendRequest],
  );

  const handleAcceptFriendRequest = useCallback(
    async (senderUid: string) => {
      if (!user || !firestore) return;

      setPendingAction({ uid: senderUid, type: "accept" });
      setRequestActionError(null);
      try {
        await addFriend(senderUid);
        const requestRef = doc(
          firestore,
          `users/${user.uid}/friendRequests/${senderUid}`,
        );
        await deleteDoc(requestRef).catch(() => {
          // Already removed by backend - nothing to do.
        });
        setSearchResults((prev) =>
          prev.map((result) =>
            result.uid === senderUid
              ? { ...result, isFriend: true, incomingRequest: false, requestPending: false }
              : result,
          ),
        );
        setPendingOutgoingRequests((prev) => {
          if (!prev.has(senderUid)) {
            return prev;
          }
          const next = new Set(prev);
          next.delete(senderUid);
          return next;
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "We couldn't accept that friend request.";
        setRequestActionError(message);
      } finally {
        setPendingAction(null);
      }
    },
    [user, firestore, addFriend],
  );

  const handleDeclineFriendRequest = useCallback(
    async (senderUid: string) => {
      if (!user || !firestore) return;

      setPendingAction({ uid: senderUid, type: "decline" });
      setRequestActionError(null);
      try {
        const requestRef = doc(
          firestore,
          `users/${user.uid}/friendRequests/${senderUid}`,
        );
        await deleteDoc(requestRef);
        setSearchResults((prev) =>
          prev.map((result) =>
            result.uid === senderUid
              ? { ...result, incomingRequest: false, requestPending: false }
              : result,
          ),
        );
        setPendingOutgoingRequests((prev) => {
          if (!prev.has(senderUid)) {
            return prev;
          }
          const next = new Set(prev);
          next.delete(senderUid);
          return next;
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "We couldn't decline that friend request.";
        setRequestActionError(message);
      } finally {
        setPendingAction(null);
      }
    },
    [user, firestore],
  );

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const friendsLeaderboardSource = user ? [
    ...friends,
    {
      uid: user.uid,
      displayName: user.displayName || "You",
      rating: leaderboard.find((entry) => entry.uid === user.uid)?.rating || 1000,
      status: "online" as const,
      addedAt: new Date(),
    },
  ] : friends;

  const friendsLeaderboard = friendsLeaderboardSource
    .reduce<Friend[]>((acc, entry) => {
      if (!acc.some((item) => item.uid === entry.uid)) {
        acc.push(entry);
      }
      return acc;
    }, [])
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
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2 text-center sm:text-left">
          <h1 className="text-4xl font-bold">Connect, Compete, Conquer.</h1>
          <p className="text-ink-soft">
            Build your rival list and challenge friends head-to-head.
          </p>
        </div>
        <div ref={notificationsAnchorRef} className="relative flex justify-end">
          <Button
            variant="subtle"
            size="icon"
            onClick={() => setNotificationsOpen((prev) => !prev)}
            aria-label="Friend requests"
          >
            <Bell className="h-5 w-5" />
          </Button>
          {unreadRequestCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">
              {unreadRequestCount > 9 ? "9+" : unreadRequestCount}
            </span>
          )}
          {notificationsOpen && (
            <div className="absolute right-0 z-20 mt-3 w-80 rounded-2xl border border-border bg-surface p-4 shadow-xl">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-ink">Friend Requests</p>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setNotificationsOpen(false)}
                  aria-label="Close friend requests"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {requestActionError && (
                <p className="mb-3 text-sm text-red-600">{requestActionError}</p>
              )}
              <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                {friendRequests.length === 0 ? (
                  <p className="text-sm text-ink-soft">No pending requests right now.</p>
                ) : (
                  friendRequests.map((request) => {
                    const isProcessing = pendingAction?.uid === request.senderUid;
                    return (
                      <div
                        key={request.senderUid}
                        className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-muted px-3 py-2"
                      >
                        <div>
                          <p className="font-semibold text-ink">{request.senderDisplayName}</p>
                          <p className="text-xs text-ink-soft">Rating {request.senderRating}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleAcceptFriendRequest(request.senderUid)}
                            disabled={isProcessing}
                          >
                            {isProcessing && pendingAction?.type === "accept" ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Accept"
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeclineFriendRequest(request.senderUid)}
                            disabled={isProcessing}
                          >
                            {isProcessing && pendingAction?.type === "decline" ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Decline"
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
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
          <CardContent className="space-y-6">
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

            {/* Friend Search */}
            <div className="p-4 border border-border rounded-lg bg-surface">
              <p className="text-sm font-medium text-ink">Search Players</p>
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search players by name"
                  className="pl-10"
                  aria-label="Search players"
                />
              </div>
              {searchError && <p className="mt-2 text-sm text-red-600">{searchError}</p>}
              <div className="mt-4 space-y-3">
                {isSearching && (
                  <div className="flex items-center gap-2 text-sm text-ink-soft">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Searching players…</span>
                  </div>
                )}
                {!isSearching && hasSearchTerm && searchResults.length === 0 && !searchError && (
                  <p className="text-sm text-ink-soft">No players match that name yet.</p>
                )}
                {!isSearching && searchResults.length > 0 && (
                  <div className="space-y-3">
                    {searchResults.map((result) => {
                      const isSending =
                        pendingAction?.uid === result.uid && pendingAction?.type === "send";
                      if (result.isFriend) {
                        return (
                          <div
                            key={result.uid}
                            className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3"
                          >
                            <div>
                              <p className="font-semibold text-ink">{result.displayName}</p>
                              <p className="text-xs text-ink-soft">Rating {result.rating}</p>
                            </div>
                            <Badge variant="mint">Friends</Badge>
                          </div>
                        );
                      }

                      if (result.incomingRequest) {
                        const isProcessing = pendingAction?.uid === result.uid;
                        return (
                          <div
                            key={result.uid}
                            className="flex items-center justify-between rounded-xl border border-brand/40 bg-brand/5 px-4 py-3"
                          >
                            <div>
                              <p className="font-semibold text-ink">{result.displayName}</p>
                              <p className="text-xs text-ink-soft">Sent you a friend request</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleAcceptFriendRequest(result.uid)}
                                disabled={isProcessing}
                              >
                                {isProcessing && pendingAction?.type === "accept" ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  "Accept"
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeclineFriendRequest(result.uid)}
                                disabled={isProcessing}
                              >
                                {isProcessing && pendingAction?.type === "decline" ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  "Decline"
                                )}
                              </Button>
                            </div>
                          </div>
                        );
                      }

                      if (result.requestPending) {
                        return (
                          <div
                            key={result.uid}
                            className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3"
                          >
                            <div>
                              <p className="font-semibold text-ink">{result.displayName}</p>
                              <p className="text-xs text-ink-soft">Rating {result.rating}</p>
                            </div>
                            <Badge variant="amber">Pending</Badge>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={result.uid}
                          className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3"
                        >
                          <div>
                            <p className="font-semibold text-ink">{result.displayName}</p>
                            <p className="text-xs text-ink-soft">Rating {result.rating}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleSendFriendRequest(result.uid)}
                            disabled={isSending}
                          >
                            {isSending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <UserPlus className="h-4 w-4" />
                                Send request
                              </>
                            )}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
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
                          {friend.rating} Elo
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
                    const tier = computeRankTier(index + 1, leaderboard.length);
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
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {player.displayName}
                                {isCurrentUser && (
                                  <span className="ml-2 text-xs text-brand font-semibold">
                                    (You)
                                  </span>
                                )}
                              </span>
                              {tier && (
                                <Badge
                                  variant="slate"
                                  className={`border border-transparent px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] ${tier.colorClass}`}
                                >
                                  {tier.label}
                                </Badge>
                              )}
                            </div>
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
                    const tier = computeRankTier(index + 1, leaderboard.length);
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
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">
                                {player.displayName}
                                {isCurrentUser && (
                                  <span className="ml-2 text-xs text-brand font-semibold">
                                    (You)
                                  </span>
                                )}
                              </span>
                              {tier && (
                                <Badge
                                  variant="slate"
                                  className={`border border-transparent px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] ${tier.colorClass}`}
                                >
                                  {tier.label}
                                </Badge>
                              )}
                            </div>
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

export default function SocialPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p>Loading...</p></div>}>
      <SocialPageContent />
    </Suspense>
  );
}
