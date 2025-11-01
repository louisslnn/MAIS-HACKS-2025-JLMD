import { Timestamp } from "firebase-admin/firestore";
import type { DocumentData } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";

import { db, increment, serverTimestamp, collections } from "./config";
import { generateDeterministicRound } from "./lib/questions";
import { updatePlayerState } from "./playerState";
import type { MatchDocument } from "./lib/types";
import { elo } from "./lib/elo";

const DRAW_EPSILON_MS = 100;

function determineWinner(match: MatchDocument) {
  const [uidA, uidB] = match.playerIds;
  const a = match.players[uidA];
  const b = match.players[uidB];

  if (a.correctCount > b.correctCount) {
    return { winner: uidA, resultA: 1 as const };
  }

  if (b.correctCount > a.correctCount) {
    return { winner: uidB, resultA: 0 as const };
  }

  const timeDiff = Math.abs(a.totalTimeMs - b.totalTimeMs);
  if (timeDiff <= DRAW_EPSILON_MS) {
    return { winner: null, resultA: 0.5 as const };
  }

  if (a.totalTimeMs < b.totalTimeMs) {
    return { winner: uidA, resultA: 1 as const };
  }

  return { winner: uidB, resultA: 0 as const };
}

export const onRoundLocked = onDocumentUpdated(
  {
    document: "matches/{matchId}/rounds/{roundId}",
    region: "us-central1",
  },
  async (event) => {
    const beforeStatus = event.data?.before?.data()?.status;
    const after = event.data?.after?.data();

    if (!after) return;
    if (after.status !== "locked") return;
    if (beforeStatus === "locked") return;
    if (after.finalizedAt) return;

    const { matchId, roundId } = event.params;
    const matchRef = db.collection(collections.matches).doc(matchId);
    const roundRef = matchRef.collection("rounds").doc(roundId);

    const answersSnap = await roundRef.collection("answers").get();
    const answers = answersSnap.docs.reduce<Record<string, DocumentData>>((acc, doc) => {
      acc[doc.id] = doc.data();
      return acc;
    }, {});

    await db.runTransaction(async (tx) => {
      const matchSnap = await tx.get(matchRef);
      if (!matchSnap.exists) return;
      const match = matchSnap.data() as MatchDocument & {
        ratingProcessed?: boolean;
      };

      const roundSnap = await tx.get(roundRef);
      const freshRound = roundSnap.data();
      if (!freshRound) return;
      if (freshRound.finalizedAt) {
        return;
      }

      const now = Timestamp.now();
      const roundIndex = Number(roundId);

      const updates: Record<string, unknown> = {
        updatedAt: now,
      };

      const roundResults: Record<string, { correct: boolean; timeMs: number }> =
        {};

      match.playerIds.forEach((uid) => {
        const answer = answers[uid];
        const correct = Boolean(answer?.correct);
        const timeMs =
          typeof answer?.timeMs === "number"
            ? answer.timeMs
            : match.settings.roundDurationMs;

        roundResults[uid] = { correct, timeMs };

        updates[`players.${uid}.correctCount`] = increment(correct ? 1 : 0);
        updates[`players.${uid}.totalTimeMs`] = increment(timeMs);
        updates[`players.${uid}.score`] = increment(correct ? 1 : 0);
      });

      const isFinalRound = roundIndex >= match.settings.rounds;

      if (isFinalRound) {
        const projectedMatch: MatchDocument = JSON.parse(
          JSON.stringify(match),
        );

        projectedMatch.players = { ...projectedMatch.players };
        projectedMatch.playerIds.forEach((uid) => {
          const player = projectedMatch.players[uid];
          const delta = roundResults[uid];
          player.correctCount += delta.correct ? 1 : 0;
          player.totalTimeMs += delta.timeMs;
          player.score += delta.correct ? 1 : 0;
        });

        const { winner } = determineWinner(projectedMatch);
        updates.status = "completed";
        updates.completedAt = now;
        updates.winner = winner ?? null;
        
        // Update player states to idle when match completes
        match.playerIds.forEach((playerId) => {
          updatePlayerState(playerId, "idle").catch((error) => {
            logger.error("Failed to update player state on match completion", {
              playerId,
              error: error instanceof Error ? error.message : String(error),
            });
          });
        });
      } else {
        const nextRoundIndex = roundIndex + 1;
        const nextRoundRef = matchRef
          .collection("rounds")
          .doc(String(nextRoundIndex));

        const nextRoundExists = await tx.get(nextRoundRef);
        if (!nextRoundExists.exists) {
          // Determine category from match settings or default to addition
          const settings = match.settings as unknown as Record<string, unknown>;
          const category = settings?.category || 'addition';
          const generated = generateDeterministicRound(
            match.seed,
            nextRoundIndex,
            category as 'addition' | 'integrals',
          );
          const startAt = Timestamp.fromMillis(now.toMillis() + 2_000);
          const endsAt = Timestamp.fromMillis(
            startAt.toMillis() + match.settings.roundDurationMs,
          );

          tx.set(nextRoundRef, {
            status: "active",
            prompt: generated.prompt,
            canonical: generated.canonical,
            answerHash: generated.answerHash,
            startAt,
            endsAt,
            difficulty: generated.difficulty,
            createdBy: "generator:v1",
            roundIndex: nextRoundIndex,
          });
        }
      }

      tx.update(matchRef, updates);
      tx.update(roundRef, {
        finalizedAt: now,
        results: roundResults,
        updatedAt: now,
      });
    });

    logger.info("Finalised round", { matchId, roundId });
  },
);

export const onMatchCompleted = onDocumentUpdated(
  {
    document: "matches/{matchId}",
    region: "us-central1",
  },
  async (event) => {
    const beforeStatus = event.data?.before?.data()?.status;
    const after = event.data?.after?.data() as
      | (MatchDocument & { ratingProcessed?: boolean })
      | undefined;

    if (!after) return;
    if (after.status !== "completed") return;
    if (beforeStatus === "completed") return;
    if (after.ratingProcessed) return;

    const { matchId } = event.params;
    const matchRef = db.collection(collections.matches).doc(matchId);

    await db.runTransaction(async (tx) => {
      const matchSnap = await tx.get(matchRef);
      if (!matchSnap.exists) return;

      const match = matchSnap.data() as MatchDocument & {
        ratingProcessed?: boolean;
      };

      if (match.ratingProcessed) {
        return;
      }

      const [uidA, uidB] = match.playerIds;
      const playerA = match.players[uidA];
      const playerB = match.players[uidB];

      // Get current stats to determine K-factor based on games played
      const userARef = db.collection(collections.users).doc(uidA);
      const userBRef = db.collection(collections.users).doc(uidB);
      const [userASnap, userBSnap] = await Promise.all([
        tx.get(userARef),
        tx.get(userBRef),
      ]);
      
      // Ensure user documents exist - create if missing (critical fix for rating persistence)
      if (!userASnap.exists) {
        logger.warn("User document missing for player A, creating default", { uidA, displayName: playerA.displayName });
        tx.set(userARef, {
          uid: uidA,
          displayName: playerA.displayName || "Anonymous",
          email: "",
          rating: playerA.ratingAtStart || 1000,
          stats: {
            wins: 0,
            losses: 0,
            draws: 0,
            matchesPlayed: 0,
            correctAnswers: 0,
            totalTimeMs: 0,
          },
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      }
      
      if (!userBSnap.exists) {
        logger.warn("User document missing for player B, creating default", { uidB, displayName: playerB.displayName });
        tx.set(userBRef, {
          uid: uidB,
          displayName: playerB.displayName || "Anonymous",
          email: "",
          rating: playerB.ratingAtStart || 1000,
          stats: {
            wins: 0,
            losses: 0,
            draws: 0,
            matchesPlayed: 0,
            correctAnswers: 0,
            totalTimeMs: 0,
          },
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      }
      
      const gamesPlayedA = userASnap.data()?.stats?.matchesPlayed ?? 0;
      const gamesPlayedB = userBSnap.data()?.stats?.matchesPlayed ?? 0;

      const { winner, resultA } = determineWinner(match);
      
      // Chess.com-style Elo with dynamic K-factors
      const { a: newRatingA, b: newRatingB } = elo(
        playerA.ratingAtStart,
        playerB.ratingAtStart,
        resultA,
        {
          gamesPlayedA,
          gamesPlayedB,
        }
      );

      const resultB = 1 - resultA as 0 | 0.5 | 1;
      const now = Timestamp.now();

      const historyARef = db
        .collection(`${collections.ratings}/${uidA}/history`)
        .doc();
      const historyBRef = db
        .collection(`${collections.ratings}/${uidB}/history`)
        .doc();

      const statsUpdates = (result: 0 | 0.5 | 1) => {
        if (result === 1) return { "stats.wins": increment(1) };
        if (result === 0.5) return { "stats.draws": increment(1) };
        return { "stats.losses": increment(1) };
      };

      tx.update(userARef, {
        rating: newRatingA,
        "stats.correctAnswers": increment(playerA.correctCount),
        "stats.totalTimeMs": increment(playerA.totalTimeMs),
        "stats.matchesPlayed": increment(1),
        updatedAt: serverTimestamp(),
        ...statsUpdates(resultA),
      });

      tx.update(userBRef, {
        rating: newRatingB,
        "stats.correctAnswers": increment(playerB.correctCount),
        "stats.totalTimeMs": increment(playerB.totalTimeMs),
        "stats.matchesPlayed": increment(1),
        updatedAt: serverTimestamp(),
        ...statsUpdates(resultB as 0 | 0.5 | 1),
      });

      tx.set(historyARef, {
        matchId,
        oldRating: playerA.ratingAtStart,
        newRating: newRatingA,
        delta: newRatingA - playerA.ratingAtStart,
        createdAt: serverTimestamp(),
      });

      tx.set(historyBRef, {
        matchId,
        oldRating: playerB.ratingAtStart,
        newRating: newRatingB,
        delta: newRatingB - playerB.ratingAtStart,
        createdAt: serverTimestamp(),
      });

      // Store rating changes in match document for instant display
      tx.update(matchRef, {
        ratingProcessed: true,
        winner: winner ?? null,
        updatedAt: now,
        ratingChanges: {
          [uidA]: {
            oldRating: playerA.ratingAtStart,
            newRating: newRatingA,
            delta: newRatingA - playerA.ratingAtStart,
          },
          [uidB]: {
            oldRating: playerB.ratingAtStart,
            newRating: newRatingB,
            delta: newRatingB - playerB.ratingAtStart,
          },
        },
      });

      // NOTE: Leaderboard update commented out - was causing transaction failures
      // TODO: Implement proper leaderboard structure later
      // const leaderboardRef = db
      //   .collection(collections.leaderboards)
      //   .doc("current");
      // tx.set(
      //   leaderboardRef,
      //   {
      //     updatedAt: serverTimestamp(),
      //   },
      //   { merge: true },
      // );
    });

    logger.info("Processed match completion", { matchId });
  },
);
