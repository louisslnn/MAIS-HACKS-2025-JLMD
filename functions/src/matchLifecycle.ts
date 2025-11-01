import crypto from "node:crypto";

import { Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";

import { db, collections } from "./config";
import { generateDeterministicRound } from "./lib/questions";
import type { MatchDocument, MatchSettings, PlayerState } from "./lib/types";

const DEFAULT_SETTINGS: MatchSettings = {
  rounds: 10,
  roundDurationMs: 45_000,
  shareOpponentPage: true,
};

export interface CreateMatchParams {
  players: [
    {
      uid: string;
      displayName: string;
      rating: number;
    },
    {
      uid: string;
      displayName: string;
      rating: number;
    },
  ];
  mode: MatchDocument["mode"];
  settings?: Partial<MatchSettings>;
  category?: 'addition' | 'integrals';
}

export async function createMatch({
  players,
  mode,
  settings,
  category = 'addition',
}: CreateMatchParams): Promise<string> {
  const [playerA, playerB] = players;
  const resolvedSettings = { ...DEFAULT_SETTINGS, ...settings, category };
  const seed = crypto.randomBytes(16).toString("hex");
  const matchRef = db.collection(collections.matches).doc();

  const startAt = Timestamp.now();
  const endsAt = Timestamp.fromMillis(
    startAt.toMillis() + resolvedSettings.roundDurationMs,
  );

  // Use category from settings
  const firstRound = generateDeterministicRound(seed, 1, category);

  await db.runTransaction(async (tx) => {
    const playersState: Record<string, PlayerState> = {
      [playerA.uid]: {
        uid: playerA.uid,
        displayName: playerA.displayName,
        ratingAtStart: playerA.rating,
        score: 0,
        correctCount: 0,
        totalTimeMs: 0,
        surrendered: false,
      },
      [playerB.uid]: {
        uid: playerB.uid,
        displayName: playerB.displayName,
        ratingAtStart: playerB.rating,
        score: 0,
        correctCount: 0,
        totalTimeMs: 0,
        surrendered: false,
      },
    };

    const matchDoc: MatchDocument = {
      status: "active",
      mode,
      settings: resolvedSettings,
      playerIds: [playerA.uid, playerB.uid],
      players: playersState,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      startedAt: startAt,
      seed,
    };

    tx.set(matchRef, matchDoc);

    tx.set(matchRef.collection("rounds").doc("1"), {
      status: "active",
      prompt: firstRound.prompt,
      canonical: firstRound.canonical,
      answerHash: firstRound.answerHash,
      startAt,
      endsAt,
      difficulty: firstRound.difficulty,
      createdBy: "generator:v1",
      roundIndex: 1,
    });
  });

  logger.info(
    `Created match ${matchRef.id} for ${playerA.uid} vs ${playerB.uid}`,
    { matchId: matchRef.id },
  );

  return matchRef.id;
}
