# MathClash (frontend)

MathClash is a competitive, Firebase-backed math battle experience. This repo contains the Next.js (App Router + TypeScript + Tailwind) frontend that talks to Firebase Auth, Firestore, Realtime Database, and Cloud Functions for matchmaking, scoring, and Elo updates.

## Project status

- ✅ UI scaffolding for Home, Play, Settings, and Social/Leaderboard flows
- ✅ Firebase client bootstrap with support for local emulators
- ✅ React context that can attach to live Firestore matches or fall back to mock data
- ✅ Firebase Functions for matchmaking, submissions, round locking, Elo updates, and sweepers

Everything you need to run MathClash locally now ships in this repo (frontend, backend, rules, and indexes). Deploy the functions, point the app at your Firebase project, and battles are ready to launch.

## Getting started

```bash
npm install
npm run dev
```

Then open http://localhost:3000. The app renders mock data until you connect it to a live Firebase project.

### Environment variables

#### Client-side Firebase configuration (Next.js)

Create a `.env.local` file (or copy `.env.local.example`) with your Firebase web app configuration:

```bash
cp .env.local.example .env.local
# Fill in the Firebase web app keys for mathclash-3e565
```

#### Server-side Firebase Admin SDK (for testing/scripts)

For running admin scripts or tests that use the Firebase Admin SDK:

1. Create a `.env` file from the template:
   ```bash
   cp .env.example .env
   ```

2. Fill in your Firebase service account credentials in `.env`

**Important:** The `.env` file contains sensitive credentials and is already in `.gitignore`. Never commit this file to version control.

If you want to use Firebase emulators locally, set `NEXT_PUBLIC_APP_ENV=development` and run the emulators before starting the Next.js dev server. Call `attachFirebaseEmulators()` after your Firebase project is initialised.

### Project structure

```
src/
├── app/
│   ├── layout.tsx      # global shell & navigation
│   ├── page.tsx        # landing page hero
│   ├── play/           # mode & question selection
│   ├── settings/       # account update surface
│   └── social/         # friends + leaderboard hub
├── contexts/
│   └── match-context.tsx
└── lib/
    ├── firebase/client.ts  # Firebase SDK bootstrapper
    └── game/               # shared types & mock state
```

## Wiring up Firebase data

1. **Auth:** Use Firebase Auth UI or custom flows. When sign-in completes, store profile info in `/users/{uid}` and expose the data through a React hook/provider.
2. **Match lifecycle:** Point `MatchProvider` at real Firestore documents by calling `setActiveMatchId(matchId)` when a user joins/creates a match. Extend the provider to subscribe to answers and presence data once those collections exist.
3. **Realtime mirroring:** Stream `/clientState/{matchId}/{uid}` from the Realtime Database inside the Play page to render opponent progress bars live.
4. **Leaderboards:** Hydrate the Social page by reading `/leaderboards/global/current` and `/users` stats. Consider server actions or ISR for public leaderboards if you need caching.

## Backend (Firebase Functions)

MathClash ships with typed Cloud Functions under `functions/`:

- `requestQuickMatch` (callable) enqueues the signed-in player for ranked 1v1s.
- `quickMatchmaker` (scheduled) pairs queued tickets, seeds deterministic rounds, and creates `/matches` docs.
- `submitAnswer` (callable) judges a player answer, locks rounds when both players submit, and emits telemetry.
- `onRoundLocked` (trigger) aggregates answers, spins up the next round, or completes the match.
- `onMatchCompleted` (trigger) calculates Elo, writes rating history, and nudges leaderboard docs.
- `lockOverdueRounds` (scheduled) force-locks stale rounds as a safety net.

### Running the backend locally

```bash
npm run functions:install   # once
npm run functions:build
firebase emulators:start --project mathclash-3e565
```

The callable endpoints are exposed on the emulator suite; the Next.js UI already knows how to target emulators when `NEXT_PUBLIC_APP_ENV=development`.

### Deploying

1. Authenticate with Firebase (`firebase login`).
2. Select the MathClash project (`firebase use mathclash-3e565`).
3. Deploy functions and security rules:

   ```bash
   npm run functions:deploy
   firebase deploy --only firestore:rules,database:rules
   ```

## Next steps

1. Wire the Play page buttons to the callable functions (`requestQuickMatch`, `submitAnswer`).
2. Hydrate leaderboards with scheduled aggregation or Cloud Functions when writing match results.
3. Add handwriting / tablet input support for the answer surface.
4. Extend the question generator with advanced topics (fractions, algebra, calculus) and optional LLM batches.
5. Add integration tests around Elo deltas and round finalisation using `firebase-functions-test`.

## Useful references

- Firebase: https://firebase.google.com/docs
- Next.js App Router: https://nextjs.org/docs/app
- Tailwind CSS: https://tailwindcss.com/docs

Feel free to reuse modules from the `ai-prep-pal` project (e.g. env handling, Firebase utilities) where it accelerates bringing MathClash online.
