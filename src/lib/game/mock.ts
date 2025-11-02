import { DEFAULT_ROUND_DURATION_MS } from "./types";
import type {
  AnswerDocument,
  MatchDocument,
  MatchMode,
  MatchState,
  RoundDocument,
} from "./types";
import { getAllProblems, type Problem } from "./problems";

export const mockMatch: MatchDocument = {
  id: "mock-match",
  status: "active",
  mode: "ranked-1v1",
  settings: {
    rounds: 10,
    roundDurationMs: DEFAULT_ROUND_DURATION_MS,
    shareOpponentPage: true,
  },
  playerIds: ["alpha", "beta"],
  players: {
    alpha: {
      uid: "alpha",
      displayName: "Alex",
      ratingAtStart: 2100,
      score: 6,
      correctCount: 42,
      totalTimeMs: 18_240,
      surrendered: false,
    },
    beta: {
      uid: "beta",
      displayName: "Jamie",
      ratingAtStart: 2055,
      score: 4,
      correctCount: 39,
      totalTimeMs: 19_780,
      surrendered: false,
    },
  },
  startedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
  updatedAt: new Date().toISOString(),
  seed: "mock-seed-43812",
};

export const mockRounds: RoundDocument[] = Array.from({ length: 3 }).map((_, index) => {
  const round = index + 1;
  return {
    id: String(round),
    status: round === 3 ? "active" : "locked",
    prompt: `${12 + round} × ${7 + round} + ${18 + round} ÷ 3 = ?`,
    canonical: {
      type: "arith.mixed",
      params: { a: 12 + round, b: 7 + round, c: 18 + round },
    },
    difficulty: round === 1 ? "easy" : round === 2 ? "medium" : "hard",
    createdBy: "generator:v1",
    startAt: new Date(Date.now() - round * 45_000).toISOString(),
    endsAt: new Date(Date.now() - (round - 1) * 45_000).toISOString(),
  } satisfies RoundDocument;
});

export const mockAnswers: Record<string, AnswerDocument[]> = {
  alpha: [
    {
      uid: "alpha",
      value: "96",
      submittedAt: new Date(Date.now() - 90_000).toISOString(),
      timeMs: 12_450,
      correct: true,
      judgedAt: new Date(Date.now() - 85_000).toISOString(),
    },
  ],
  beta: [
    {
      uid: "beta",
      value: "98",
      submittedAt: new Date(Date.now() - 88_000).toISOString(),
      timeMs: 14_120,
      correct: false,
      judgedAt: new Date(Date.now() - 84_000).toISOString(),
    },
  ],
};

export const mockState: MatchState = {
  match: mockMatch,
  rounds: mockRounds,
  answers: mockAnswers,
  activeRoundIndex: 0,
  practiceFeedback: null,
};

export function createMockState(mode: MatchMode, options?: { writingMode?: boolean; problemCategory?: "addition" | "integrals" }): MatchState {
  const timestamp = Date.now();
  const nowIso = new Date(timestamp).toISOString();

  if (mode === "solo") {
    const soloPlayerId = "solo-player";
    const writingMode = options?.writingMode || false;
    const problemCategory = options?.problemCategory || "addition";
    const isIntegral = problemCategory === "integrals";
    
    // Writing mode: 15 additions or 3 integrals
    // Normal mode: 10 additions or 10 integrals
    const totalRounds = writingMode ? (isIntegral ? 3 : 15) : 10;
    const roundDuration = writingMode ? 300_000 : DEFAULT_ROUND_DURATION_MS; // 5 min for writing mode
    const now = Date.now();
    const integralPool = isIntegral ? getAllProblems("integrals") : [];

    const sampledIntegrals: Problem[] = [];
    if (isIntegral) {
      const pool = [...integralPool];
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      while (sampledIntegrals.length < totalRounds) {
        if (pool.length === 0) {
          sampledIntegrals.push({
            id: 0,
            problem: "$\\int x \\, dx$",
            answer: "$\\frac{x^2}{2} + C$",
          });
        } else {
          sampledIntegrals.push(
            pool[sampledIntegrals.length % pool.length],
          );
        }
      }
    }
    
    // Create practice rounds with proper future timestamps
    const practiceRounds: RoundDocument[] = Array.from({ length: totalRounds }).map((_, index) => {
      const roundNum = index + 1;
      const roundStart = now + (index * roundDuration);
      const roundEnd = roundStart + roundDuration;
      
      // Generate practice problems
      let prompt: string;
      let canonical: { type: string; params: Record<string, unknown> };
      
      if (isIntegral) {
        const integralProblem = sampledIntegrals[index];
        prompt = integralProblem.problem;
        canonical = {
          type: "integral",
          params: {
            problemId: integralProblem.id,
            // No answer field - OCR will solve the integral itself
          },
        };
      } else {
        // Addition problems
        const a = 10 + Math.floor(Math.random() * 40);
        const b = 5 + Math.floor(Math.random() * 30);
        const answer = a + b;
        prompt = `${a} + ${b} = ?`;
        canonical = {
          type: "addition",
          params: { a, b, answer },
        };
      }
      
      return {
        id: String(roundNum),
        status: index === 0 ? "active" : "pending",
        prompt,
        canonical,
        difficulty: index < 3 ? "easy" : index < 7 ? "medium" : "hard",
        createdBy: "practice:v1",
        startAt: new Date(roundStart).toISOString(),
        endsAt: new Date(roundEnd).toISOString(),
      } satisfies RoundDocument;
    });
    
    return {
      match: {
        id: `practice-${timestamp}`,
        status: "active",
        mode: "solo",
        settings: { 
          rounds: totalRounds,
          roundDurationMs: roundDuration,
          shareOpponentPage: false,
          writingMode,
          problemCategory,
        },
        playerIds: [soloPlayerId],
        players: {
          [soloPlayerId]: {
            uid: soloPlayerId,
            displayName: "You",
            ratingAtStart: 0,
            score: 0,
            correctCount: 0,
            totalTimeMs: 0,
            surrendered: false,
          },
        },
        startedAt: nowIso,
        updatedAt: nowIso,
        seed: `practice-seed-${timestamp}`,
      },
    rounds: practiceRounds,
    answers: {},
    activeRoundIndex: 0,
    practiceFeedback: null,
  };
  }

  const matchClone: MatchDocument = {
    ...mockMatch,
    id: `${mode}-demo-${timestamp}`,
    mode,
    playerIds: [...mockMatch.playerIds],
    players: Object.fromEntries(
      Object.entries(mockMatch.players).map(([key, player]) => [
        key,
        { ...player },
      ]),
    ),
    settings: { ...mockMatch.settings },
    startedAt: new Date(timestamp - 2 * 60 * 1000).toISOString(),
    updatedAt: nowIso,
    seed: `${mode}-seed-${timestamp}`,
  };

  const roundsClone = mockRounds.map((round) => ({ ...round }));
  const answersClone = Object.fromEntries(
    Object.entries(mockAnswers).map(([key, entries]) => [
      key,
      entries.map((entry) => ({ ...entry })),
    ]),
  ) as Record<string, AnswerDocument[]>;

  return {
    match: matchClone,
    rounds: roundsClone,
    answers: answersClone,
    activeRoundIndex: 0,
    practiceFeedback: null,
  };
}
