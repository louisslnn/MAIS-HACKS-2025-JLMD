"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { ref, set, onValue, serverTimestamp as rtdbServerTimestamp } from "firebase/database";
import { Timestamp } from "firebase/firestore";

import { firestore, realtimeDb } from "@/lib/firebase/client";
import { createMockState } from "@/lib/game/mock";
import { requestQuickMatch, cancelQueue, forfeitMatch } from "@/lib/firebase/functions";
import { useAuth } from "@/components/auth/AuthProvider";
import type {
  MatchDocument,
  MatchMode,
  MatchState,
  RoundDocument,
  AnswerDocument,
} from "@/lib/game/types";
import { DEFAULT_ROUND_DURATION_MS } from "@/lib/game/types";

type MatchmakingStatus = "idle" | "searching" | "found" | "error";

interface OpponentState {
  currentRound: number;
  currentInputPreview?: string;
  lastEditAt?: number;
  answered?: boolean;
}

interface MatchContextValue {
  state: MatchState;
  setActiveMatchId: (matchId: string | null) => void;
  startLocalMatch: (mode: MatchMode, options?: { writingMode?: boolean; problemCategory?: "addition" | "integrals" }) => void;
  requestMatch: (category?: "addition" | "integrals") => Promise<void>;
  matchmakingStatus: MatchmakingStatus;
  matchmakingError: string | null;
  cancelMatchmaking: () => Promise<void>;
  opponentState: OpponentState | null;
  submitPracticeAnswer: (roundId: string, value: string | number, isCorrect?: boolean) => void;
  quitMatch: () => Promise<void>;
}

const MatchContext = createContext<MatchContextValue | null>(null);

export function MatchProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [activeMatchId, setActiveMatchIdState] = useState<string | null>(null);
  // Start with empty state instead of mock data
  const [state, setState] = useState<MatchState>({
    match: null,
    rounds: [],
    answers: {},
    isLoading: false,
  });
  const [matchmakingStatus, setMatchmakingStatus] = useState<MatchmakingStatus>("idle");
  const [matchmakingError, setMatchmakingError] = useState<string | null>(null);
  const [opponentState, setOpponentState] = useState<OpponentState | null>(null);
  const mountedRef = useRef(true);
  const matchmakingStatusRef = useRef<MatchmakingStatus>("idle");
  const matchmakingUnsubscribeRef = useRef<(() => void) | null>(null);
  const currentRoundRef = useRef<number>(1);

  // Helper to convert Firestore Timestamp to ISO string
  const convertTimestamp = (value: unknown): string | undefined => {
    if (!value) return undefined;
    if (value instanceof Timestamp) {
      return value.toDate().toISOString();
    }
    if (typeof value === "string") {
      return value;
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    // Handle objects with toDate method (Firestore Timestamp-like)
    if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
      return (value as { toDate: () => Date }).toDate().toISOString();
    }
    return undefined;
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    matchmakingStatusRef.current = matchmakingStatus;
  }, [matchmakingStatus]);

  // Subscribe to opponent's RTDB clientState
  useEffect(() => {
    if (!activeMatchId || !user || !state.match) return;
    
    const opponentId = state.match.playerIds.find((id) => id !== user.uid);
    if (!opponentId) return;

    const oppStateRef = ref(realtimeDb, `/clientState/${activeMatchId}/${opponentId}`);
    const unsubscribe = onValue(oppStateRef, (snapshot) => {
      if (!mountedRef.current) return;
      const data = snapshot.val();
      setOpponentState(data || null);
    });

    return () => unsubscribe();
  }, [activeMatchId, user, state.match]);

  // Write current user's state to RTDB
  useEffect(() => {
    if (!activeMatchId || !user || !state.match) return;

    const currentRound = state.rounds.find((r) => r.status === "active");
    if (!currentRound) return;

    const roundNumber = parseInt(currentRound.id, 10);
    if (isNaN(roundNumber)) return;

    currentRoundRef.current = roundNumber;

    const myStateRef = ref(realtimeDb, `/clientState/${activeMatchId}/${user.uid}`);
    set(myStateRef, {
      currentRound: roundNumber,
      lastEditAt: rtdbServerTimestamp(),
    }).catch((error) => {
      console.error("Failed to update RTDB state:", error);
    });
  }, [activeMatchId, user, state.match, state.rounds]);

  useEffect(() => {
    if (!activeMatchId) {
      return;
    }

    if (!firestore) {
      console.warn("Firebase app not initialised; MatchProvider is using mock data.");
      return;
    }

    const matchRef = doc(firestore, "matches", activeMatchId);
    const roundsRef = collection(matchRef, "rounds");
    const roundsQuery = query(roundsRef, orderBy("startAt", "asc"), limit(20));

    const unsubscribers: Unsubscribe[] = [];

    unsubscribers.push(
      onSnapshot(
        matchRef,
        (snapshot) => {
          if (!mountedRef.current) return;
          if (!snapshot.exists()) {
            setState((prev) => ({ ...prev, match: null, error: "Match not found", isLoading: false }));
            return;
          }

          const data = snapshot.data();
          const nextMatch: MatchDocument = {
            id: snapshot.id,
            ...(data as Omit<MatchDocument, "id">),
            // Convert Firestore Timestamps to ISO strings
            startedAt: convertTimestamp(data?.startedAt),
            endsAt: convertTimestamp(data?.endsAt),
            createdAt: convertTimestamp(data?.createdAt),
            updatedAt: convertTimestamp(data?.updatedAt),
          };

          setState((prev) => ({
            ...prev,
            match: nextMatch,
            isLoading: false,
          }));
        },
        (error) => {
          if (!mountedRef.current) return;
          setState((prev) => ({ ...prev, error: error.message, isLoading: false }));
        },
      ),
    );

    unsubscribers.push(
      onSnapshot(
        roundsQuery,
        (snapshot) => {
          if (!mountedRef.current) return;
          const nextRounds: RoundDocument[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              ...(data as Omit<RoundDocument, "id">),
              // Convert Firestore Timestamps to ISO strings
              startAt: convertTimestamp(data?.startAt),
              endsAt: convertTimestamp(data?.endsAt),
            };
          });

          setState((prev) => {
            // Track which rounds we're already subscribed to
            const subscribedRounds = new Set(
              prev.rounds.map((r) => r.id)
            );
            
            // Subscribe to answers for new rounds only
            nextRounds.forEach((round) => {
              if (!subscribedRounds.has(round.id)) {
                const answersRef = collection(matchRef, "rounds", round.id, "answers");
                const answerUnsub = onSnapshot(
                  answersRef,
                  (answerSnapshot) => {
                    if (!mountedRef.current) return;
                    const roundAnswers = answerSnapshot.docs.map((docSnap) => {
                      const data = docSnap.data();
                      return {
                        uid: docSnap.id, // Document ID is the uid
                        ...(data as Omit<AnswerDocument, "uid">),
                        // Convert Firestore Timestamps to ISO strings
                        submittedAt: convertTimestamp(data?.submittedAt) || new Date().toISOString(),
                        judgedAt: convertTimestamp(data?.judgedAt) || new Date().toISOString(),
                      };
                    }) as AnswerDocument[];

                    setState((prevState) => {
                      const newAnswers = { ...prevState.answers };
                      newAnswers[round.id] = roundAnswers;
                      return {
                        ...prevState,
                        answers: newAnswers,
                      };
                    });
                  },
                  (error) => {
                    console.error("Answer subscription error:", error);
                  },
                );
                unsubscribers.push(answerUnsub);
              }
            });
            
            return {
              ...prev,
              rounds: nextRounds,
              isLoading: false,
            };
          });
        },
        (error) => {
          if (!mountedRef.current) return;
          setState((prev) => ({
            ...prev,
            error: error.message,
          }));
        },
      ),
    );

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [activeMatchId]);

  const setActiveMatchId = useCallback((matchId: string | null) => {
    setActiveMatchIdState(matchId);
    if (!matchId) {
      // Clear state when no match
      setState({
        match: null,
        rounds: [],
        answers: {},
        isLoading: false,
      });
      return;
    }

    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: undefined,
    }));
  }, []);

  const startLocalMatch = useCallback((mode: MatchMode, options?: { writingMode?: boolean; problemCategory?: "addition" | "integrals" }) => {
    // For practice mode, create a local mock match
    setActiveMatchIdState(null);
    matchmakingStatusRef.current = "idle";
    setMatchmakingStatus("idle");
    setMatchmakingError(null);
    
    if (mode === "solo") {
      setState(createMockState(mode, options));
    } else {
      // Clear state for ranked (will be set by real match)
      setState({
        match: null,
        rounds: [],
        answers: {},
        isLoading: false,
      });
    }
  }, []);

  const requestMatch = useCallback(async (category: "addition" | "integrals" = "addition") => {
    if (!user) {
      setMatchmakingError("You must be signed in to play");
      matchmakingStatusRef.current = "error";
      setMatchmakingStatus("error");
      return;
    }

    matchmakingStatusRef.current = "searching";
    setMatchmakingStatus("searching");
    setMatchmakingError(null);

    try {
      // Listen for matches where user is a participant
      if (matchmakingUnsubscribeRef.current) {
        matchmakingUnsubscribeRef.current();
      }

      const matchesRef = collection(firestore, "matches");
      // Note: This query requires a composite index
      // Index was deployed, but may take 1-2 minutes to build
      // Check: https://console.firebase.google.com/project/mathclash-3e565/firestore/indexes
      const matchesQuery = query(
        matchesRef,
        where("playerIds", "array-contains", user.uid),
        where("status", "==", "active"),
        orderBy("createdAt", "desc"),
        limit(1)
      );

      // Set up listener for new matches
      const unsubscribe = onSnapshot(
        matchesQuery,
        (snapshot) => {
          if (snapshot.empty) {
            return;
          }

          const latestMatch = snapshot.docs[0];
          const matchId = latestMatch.id;

          if (matchmakingStatusRef.current !== "found") {
            matchmakingStatusRef.current = "found";
            setMatchmakingStatus("found");
          }

          setActiveMatchIdState((prev) => (prev === matchId ? prev : matchId));

          if (matchmakingUnsubscribeRef.current) {
            matchmakingUnsubscribeRef.current();
            matchmakingUnsubscribeRef.current = null;
          }
        },
        (error) => {
          console.error("Match listener error:", error);
          // Check if it's an index error
          if (error.code === 'failed-precondition' && error.message?.includes('index')) {
            setMatchmakingError("Index is still building. Please wait 1-2 minutes and try again.");
          } else {
            setMatchmakingError(error.message);
          }
          matchmakingStatusRef.current = "error";
          setMatchmakingStatus("error");
        }
      );

      matchmakingUnsubscribeRef.current = unsubscribe;

      // Request match via Cloud Function
      const response = await requestQuickMatch({
        mode: "ranked-1v1",
        topic: category === "addition" ? "arith" : "calculus",
      });

      // If match was created immediately, set it directly
      if (response.data?.matchId && !response.data.queued) {
        const matchId = response.data.matchId;
        matchmakingStatusRef.current = "found";
        setMatchmakingStatus("found");
        setActiveMatchIdState((prev) => (prev === matchId ? prev : matchId));
        
        // Unsubscribe from matchmaking listener since we have the match
        if (matchmakingUnsubscribeRef.current) {
          matchmakingUnsubscribeRef.current();
          matchmakingUnsubscribeRef.current = null;
        }
      }

      // Otherwise, listener will catch when match is created
    } catch (error) {
      console.error("Matchmaking error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to start matchmaking";
      setMatchmakingError(errorMessage);
      matchmakingStatusRef.current = "error";
      setMatchmakingStatus("error");
      if (matchmakingUnsubscribeRef.current) {
        matchmakingUnsubscribeRef.current();
        matchmakingUnsubscribeRef.current = null;
      }
    }
  }, [user]);

  const cancelMatchmaking = useCallback(async () => {
    matchmakingStatusRef.current = "idle";
    setMatchmakingStatus("idle");
    setMatchmakingError(null);
    setActiveMatchIdState(null);
    
    // Clear match state
    setState({
      match: null,
      rounds: [],
      answers: {},
      isLoading: false,
    });
    
    if (matchmakingUnsubscribeRef.current) {
      matchmakingUnsubscribeRef.current();
      matchmakingUnsubscribeRef.current = null;
    }

    // Remove from queue via Cloud Function
    if (user) {
      try {
        await cancelQueue();
      } catch (error) {
        console.error("Failed to cancel queue:", error);
        // Continue anyway - cleanup was attempted
      }
    }
  }, [user]);

  // Handle practice mode answer submission
  const submitPracticeAnswer = useCallback((roundId: string, value: string | number, isCorrect?: boolean) => {
    if (!state.match || !state.match.id.startsWith("practice-")) return;
    
    setState((prev) => {
      if (!prev.match || !prev.match.id.startsWith("practice-")) return prev;
      
      const currentRound = prev.rounds.find(r => r.id === roundId);
      if (!currentRound || currentRound.status !== "active" || !currentRound.startAt) return prev;
      
      // Calculate if answer is correct
      // If isCorrect is provided (from OCR), use that; otherwise calculate
      let correct: boolean;
      if (isCorrect !== undefined) {
        correct = isCorrect;
      } else {
        const numericValue = typeof value === "string" ? Number(value) : value;
        correct = currentRound.canonical?.params?.answer === numericValue;
      }
      
      const now = Date.now();
      const roundStart = new Date(currentRound.startAt).getTime();
      const timeMs = Math.max(0, now - roundStart);
      const inTime = timeMs <= DEFAULT_ROUND_DURATION_MS;
      
      const actuallyCorrect = correct && inTime;
      
      // Create answer document
      const answerDoc: AnswerDocument = {
        uid: prev.match.playerIds[0], // Solo player ID
        value: String(value),
        submittedAt: new Date().toISOString(),
        timeMs,
        correct: actuallyCorrect,
        judgedAt: new Date().toISOString(),
      };
      
      // Update answers
      const newAnswers = { ...prev.answers };
      const roundAnswers = newAnswers[roundId] || [];
      newAnswers[roundId] = [...roundAnswers, answerDoc];
      
      // Update player stats
      const playerId = prev.match.playerIds[0];
      const player = prev.match.players[playerId];
      const updatedPlayer = {
        ...player,
        correctCount: player.correctCount + (actuallyCorrect ? 1 : 0),
        totalTimeMs: player.totalTimeMs + timeMs,
        score: player.score + (actuallyCorrect ? 10 : 0),
      };
      
      // Lock current round and activate next round
      const updatedRounds = prev.rounds.map((round, index) => {
        if (round.id === roundId) {
          return { ...round, status: "locked" as const };
        }
        // Activate next round
        const currentIndex = prev.rounds.findIndex(r => r.id === roundId);
        if (index === currentIndex + 1 && round.status === "pending") {
          return { ...round, status: "active" as const };
        }
        return round;
      });
      
      // Check if match is complete
      const allRoundsLocked = updatedRounds.every(r => r.status === "locked");
      const matchStatus = allRoundsLocked ? "completed" as const : "active" as const;
      
      return {
        ...prev,
        match: {
          ...prev.match,
          status: matchStatus,
          players: {
            ...prev.match.players,
            [playerId]: updatedPlayer,
          },
        },
        rounds: updatedRounds,
        answers: newAnswers,
      };
    });
  }, [state.match]);

  const quitMatch = useCallback(async () => {
    if (!state.match || !user) return;

    try {
      await forfeitMatch({ matchId: state.match.id });
      
      // Clear match state
      setActiveMatchIdState(null);
      setState({
        match: null,
        rounds: [],
        answers: {},
        isLoading: false,
      });
    } catch (error) {
      console.error("Failed to quit match:", error);
      // Still clear local state even if forfeit fails
      setActiveMatchIdState(null);
      setState({
        match: null,
        rounds: [],
        answers: {},
        isLoading: false,
      });
    }
  }, [state.match, user]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (matchmakingUnsubscribeRef.current) {
        matchmakingUnsubscribeRef.current();
      }
    };
  }, []);

  const value = useMemo<MatchContextValue>(
    () => ({ 
      state, 
      setActiveMatchId, 
      startLocalMatch,
      requestMatch,
      matchmakingStatus,
      matchmakingError,
      cancelMatchmaking,
      opponentState,
      submitPracticeAnswer,
      quitMatch,
    }),
    [state, setActiveMatchId, startLocalMatch, requestMatch, matchmakingStatus, matchmakingError, cancelMatchmaking, opponentState, submitPracticeAnswer, quitMatch],
  );

  return <MatchContext.Provider value={value}>{children}</MatchContext.Provider>;
}

export function useMatch() {
  const context = useContext(MatchContext);
  if (!context) {
    throw new Error("useMatch must be used within a MatchProvider");
  }
  return context;
}
