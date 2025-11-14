export type MatchMode = "ranked-1v1" | "private" | "solo";
export type MatchStatus = "pending" | "active" | "completed" | "cancelled";
export type RoundStatus = "pending" | "active" | "locked";
export type Difficulty = "easy" | "medium" | "hard";

export interface PlayerSummary {
  uid: string;
  displayName: string;
  ratingAtStart: number;
  score: number;
  correctCount: number;
  totalTimeMs: number;
  surrendered: boolean;
}

export interface RatingChangeEntry {
  oldRating: number;
  newRating: number;
  delta: number;
}

export interface MatchSettings {
  rounds: number;
  roundDurationMs: number;
  shareOpponentPage: boolean;
  writingMode?: boolean;
  problemCategory?: "addition" | "integrals";
}

export interface MatchDocument {
  id: string;
  status: MatchStatus;
  mode: MatchMode;
  settings: MatchSettings;
  playerIds: string[];
  players: Record<string, PlayerSummary>;
  startedAt?: string;
  endsAt?: string;
  createdAt?: string;
  updatedAt?: string;
  seed?: string;
  ratingChanges?: Record<string, RatingChangeEntry>;
  ratingProcessed?: boolean;
  winner?: string | null;
  activeRoundId?: string | null;
  celebration?: {
    emoteId: string;
    triggeredBy: string;
    triggeredAt?: string;
  };
}

export interface CanonicalPrompt {
  type: string;
  params: Record<string, unknown>;
}

export interface RoundDocument {
  id: string;
  status: RoundStatus;
  prompt: string;
  canonical: CanonicalPrompt;
  answerHash?: string;
  difficulty?: Difficulty;
  createdBy?: string;
  startAt?: string;
  endsAt?: string;
}

export interface AnswerDocument {
  uid: string;
  value: string;
  submittedAt: string;
  timeMs: number;
  correct: boolean;
  judgedAt: string;
  judgeVersion?: number;
  ocrConfidence?: number;
  ocrNotes?: string;
}

export interface LeaderboardEntry {
  uid: string;
  rating: number;
  displayName: string;
  photoURL?: string;
}

export interface MatchState {
  match: MatchDocument | null;
  rounds: RoundDocument[];
  answers: Record<string, AnswerDocument[]>;
  activeRoundIndex: number;
  practiceFeedback?: string | null;
}

export interface OCRVerificationResult {
  id: number;
  type: string;
  is_correct: boolean;
  confidence: number;
  notes: string;
}

export interface WritingModeSubmission {
  pageNumber: number;
  imageBase64: string;
  problemIds: string[];
  expectedAnswers: Array<{ id: string; answer: string; type: string }>;
}

export const DEFAULT_ROUND_DURATION_MS = 45_000;
