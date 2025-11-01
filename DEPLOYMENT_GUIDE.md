# MathClash Deployment Guide

This guide walks you through deploying MathClash to Firebase for production use.

## Prerequisites

1. **Firebase Project**: Make sure you're using project `mathclash-3e565` (already configured in `.firebaserc`)
2. **Firebase CLI**: Install if needed: `npm install -g firebase-tools`
3. **Node.js**: Version 18 or higher
4. **Firebase Configuration**: You'll need environment variables set up

## Step 1: Set Up Environment Variables

### Client-side Configuration (.env.local)

Create `/Users/dominique/Desktop/MathClash/mathclash-app/.env.local` with your Firebase web app credentials:

```bash
# Get these from Firebase Console > Project Settings > General > Your apps > Web app

NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=mathclash-3e565.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=mathclash-3e565
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=mathclash-3e565.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your-measurement-id
```

### Functions Configuration (optional)

If you plan to use AI features later, create `/Users/dominique/Desktop/MathClash/mathclash-app/functions/.env`:

```bash
OPENAI_API_KEY=sk-your-key-here  # Optional, for AI features
MATCH_SALT=your-random-salt      # Optional, for answer hashing
```

## Step 2: Firebase Login

```bash
firebase login
```

## Step 3: Enable Required Firebase Services

Go to the Firebase Console for `mathclash-3e565` and enable:

1. **Authentication**
   - Go to Authentication > Sign-in method
   - Enable Email/Password
   - Enable Google (optional)

2. **Firestore Database**
   - Go to Firestore Database
   - Create database in production mode
   - Choose a location close to your users

3. **Realtime Database**
   - Go to Realtime Database
   - Create database in production mode

4. **Cloud Functions**
   - Should be automatically enabled when deploying

5. **Hosting**
   - Should be automatically enabled when deploying

## Step 4: Deploy Cloud Functions

```bash
cd /Users/dominique/Desktop/MathClash/mathclash-app

# Install dependencies and build functions
npm run functions:install
npm run functions:build

# Deploy functions only
firebase deploy --only functions
```

This will deploy:
- `requestQuickMatch` - Matchmaking queue
- `quickMatchmaker` - Pairs players
- `submitAnswer` - Validates answers
- `onRoundLocked` - Handles round completion
- `onMatchCompleted` - Updates Elo ratings
- `lockOverdueRounds` - Safety sweeper
- `getGameFeedback` - AI feedback (optional)

## Step 5: Deploy Database Rules

```bash
# Deploy Firestore and Realtime Database security rules
firebase deploy --only firestore:rules,firestore:indexes,database:rules
```

This ensures:
- Users can only access their own data
- Match participants can read match data
- Only Cloud Functions can write match/round data
- Opponent progress is visible via RTDB

## Step 6: Build and Deploy Frontend

```bash
# Build the Next.js app for static export
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting
```

## Step 7: Verify Deployment

After deployment completes, you'll see your hosting URL (usually `https://mathclash-3e565.web.app`).

Visit the URL and test:

1. **Sign Up/Sign In**
   - Create a new account
   - Verify email/password works
   - Check that user document is created in Firestore

2. **Leaderboard**
   - Visit /social page
   - Should see your new account listed

3. **Practice Mode**
   - Click "Play" > "Practice"
   - Verify questions appear
   - Submit answers and check they're validated

4. **Ranked Match** (requires 2 players)
   - Use the simulation script in another terminal:
     ```bash
     npm run test:simulate
     ```
   - Or open the site in two different browsers/incognito windows
   - Start matchmaking from both
   - Play through a full match
   - Verify Elo updates in leaderboard

## Step 8: Monitor and Debug

### View Function Logs

```bash
firebase functions:log --limit 50
```

### View Firestore Data

Go to Firebase Console > Firestore Database and check:
- `/users/{uid}` - User profiles with ratings
- `/matches/{matchId}` - Active and completed matches
- `/matches/{matchId}/rounds/{roundId}` - Round data
- `/matches/{matchId}/rounds/{roundId}/answers/{uid}` - Answer submissions

### View Realtime Database

Go to Firebase Console > Realtime Database and check:
- `/clientState/{matchId}/{uid}` - Real-time opponent progress

### Common Issues

**Functions not deploying:**
- Check Node.js version (must be 18+)
- Run `npm run functions:lint` to check for errors
- Verify billing is enabled on Firebase project

**Authentication not working:**
- Verify `.env.local` has correct credentials
- Check auth domain in Firebase Console matches config
- Ensure Email/Password is enabled in Authentication settings

**Matches not starting:**
- Check function logs for errors
- Verify Firestore indexes are deployed
- Make sure both players are in queue

**Elo not updating:**
- Check `onMatchCompleted` trigger logs
- Verify users have initial rating (1500)
- Check `/ratings/{uid}/history` for updates

## Deployment Checklist

- [ ] Environment variables configured
- [ ] Firebase login completed
- [ ] All services enabled in Firebase Console
- [ ] Functions deployed successfully
- [ ] Security rules deployed
- [ ] Frontend built and deployed
- [ ] Can sign up/sign in
- [ ] Leaderboard loads
- [ ] Practice mode works
- [ ] Ranked matchmaking works (with 2 clients)
- [ ] Elo updates after matches
- [ ] Real-time opponent progress visible
- [ ] No errors in function logs

## Ongoing Maintenance

### Updating Functions

```bash
cd /Users/dominique/Desktop/MathClash/mathclash-app
npm run functions:build
firebase deploy --only functions
```

### Updating Frontend

```bash
cd /Users/dominique/Desktop/MathClash/mathclash-app
npm run build
firebase deploy --only hosting
```

### Updating Rules

```bash
firebase deploy --only firestore:rules,database:rules
```

## Cost Management

- **Free Tier**: Firebase offers generous free quotas
- **Functions**: Pay per invocation (first 2M/month free)
- **Firestore**: Pay per read/write (50K reads, 20K writes/day free)
- **RTDB**: Pay per GB downloaded (10GB/month free)
- **Hosting**: Pay per GB served (10GB/month free)

For a small user base, you should stay within free tier limits.

## Next Steps

Once deployed and tested:

1. **Add more question types**
   - Update `/Users/dominique/Desktop/MathClash/mathclash-app/functions/src/lib/problems.ts`
   - Add multiplication, division, fractions, algebra, etc.

2. **Implement AI features** (if desired)
   - Add OpenAI API key to functions config
   - Uncomment AI-powered question generation
   - Enable post-match AI feedback

3. **Add social features**
   - Friends list (currently mock)
   - Private matches
   - Spectator mode

4. **Mobile optimization**
   - PWA installation prompt
   - Touch-optimized controls
   - Responsive design testing

5. **Analytics**
   - Add Firebase Analytics
   - Track user engagement
   - Monitor match completion rates

## Support

For issues, check:
- Firebase Console logs
- Function execution logs: `firebase functions:log`
- Firestore/RTDB rules debugger in console

