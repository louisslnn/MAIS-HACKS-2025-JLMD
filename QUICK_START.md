# MathClash Quick Start Guide

## ✅ What's Been Completed

All implementation is done! The app is ready to deploy with:
- ✅ Complete authentication system (email/password + Google)
- ✅ Beautiful, modern UI/UX
- ✅ Real-time 1v1 matchmaking
- ✅ Live opponent progress tracking
- ✅ Elo rating system
- ✅ Post-match results with rating changes
- ✅ Live leaderboard
- ✅ Settings page for profile management
- ✅ All TypeScript and linting errors fixed
- ✅ Production build successful

## 🚀 Deploy to Firebase (5 Minutes)

### Step 1: Get Firebase Credentials

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project `mathclash-3e565` (or create it if it doesn't exist)
3. Go to Project Settings > General > Your apps
4. If no web app exists, click "Add app" and select Web
5. Copy the Firebase config values

### Step 2: Create Environment File

Create `.env.local` in the project root:

```bash
# Copy the template
cp .env.local.example .env.local

# Then edit .env.local with your Firebase values:
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=mathclash-3e565.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=mathclash-3e565
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=mathclash-3e565.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
# NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID is optional
```

### Step 3: Enable Firebase Services

In Firebase Console for `mathclash-3e565`:

1. **Authentication**:
   - Go to Authentication > Get Started
   - Enable "Email/Password" provider
   - Enable "Google" provider (optional but recommended)

2. **Firestore Database**:
   - Go to Firestore Database > Create database
   - Start in **production mode**
   - Choose a location close to your users

3. **Realtime Database**:
   - Go to Realtime Database > Create database
   - Start in **locked mode** (we'll deploy rules next)
   - Same location as Firestore

4. **Cloud Functions** & **Hosting**:
   - Will be enabled automatically when you deploy

### Step 4: Deploy Everything

```bash
cd /Users/dominique/Desktop/MathClash/mathclash-app

# 1. Login to Firebase
firebase login

# 2. Ensure you're using the right project
firebase use mathclash-3e565

# 3. Build and deploy functions
npm run functions:build
firebase deploy --only functions

# 4. Deploy security rules
firebase deploy --only firestore:rules,firestore:indexes,database:rules

# 5. Build and deploy frontend
npm run build
firebase deploy --only hosting
```

### Step 5: Test Your Deployment

After deployment completes, you'll get a URL like: `https://mathclash-3e565.web.app`

1. **Test Auth**: Sign up with a new account
2. **Test Leaderboard**: Visit `/social` - you should see your account
3. **Test Practice Mode**: Click Play > Practice mode
4. **Test Ranked** (requires 2 players):
   - Open 2 browser windows (or use incognito)
   - Sign in with different accounts in each
   - Both click Play > Ranked > Addition > Start
   - Play through a match
   - Check leaderboard updates

## 🔍 Verify Deployment

### Check Functions are Deployed

```bash
firebase functions:list
```

You should see:
- requestQuickMatch
- quickMatchmaker
- submitAnswer
- onRoundLocked
- onMatchCompleted
- lockOverdueRounds
- getGameFeedback

### Check Firestore Rules

In Firebase Console > Firestore Database > Rules tab, verify rules are deployed.

### Check RTDB Rules

In Firebase Console > Realtime Database > Rules tab, verify rules are deployed.

### Monitor Logs

```bash
# View recent function logs
firebase functions:log --limit 50

# Stream logs in real-time
firebase functions:log --follow
```

## 🐛 Troubleshooting

### "Firebase not initialized" error
- Make sure `.env.local` exists and has correct values
- Rebuild: `npm run build`
- Redeploy: `firebase deploy --only hosting`

### Functions failing
- Check logs: `firebase functions:log`
- Verify billing is enabled (Cloud Functions require Blaze plan)
- Check Node version: `node --version` (should be 18+)

### Matchmaking not working
- Make sure 2 players are queuing (use 2 browser windows)
- Check function logs for errors
- Verify Firestore indexes are deployed

### Elo not updating
- Check `onMatchCompleted` function logs
- Verify match completed successfully
- Check `/ratings/{uid}/history` in Firestore

## 📊 Monitor Performance

### Firebase Console Dashboards
- **Authentication**: See sign-ups and active users
- **Firestore**: Monitor reads/writes and quota usage
- **Functions**: See invocations, errors, and execution time
- **Hosting**: See traffic and bandwidth usage

### Set Up Budget Alerts
1. Go to Google Cloud Console
2. Select `mathclash-3e565`
3. Billing > Budgets & alerts
4. Create alert at $10, $25, $50

## 🎮 How Players Use MathClash

### First-Time User Flow
1. Land on homepage
2. Click "Start Playing"
3. Sign up via email or Google
4. Redirected to Play page
5. Choose Ranked or Practice
6. If Ranked, choose Addition or Integrals
7. Click "Start Battle"
8. Match with opponent (instant or within ~1 minute)
9. Answer 10 rounds of math questions
10. See results with Elo change
11. Click "Play Again" or "View Leaderboard"

### Returning User Flow
1. Sign in (or auto-signed in)
2. Go to Play
3. Start Ranked battle
4. Compete and climb leaderboard

## 🌟 What Makes MathClash Special

- **Real-time**: See opponent's progress live
- **Fair**: Server-side validation prevents cheating
- **Competitive**: Elo rating system like chess
- **Fast**: Instant matchmaking, <1s answer validation
- **Beautiful**: Modern, clean UI that gets out of the way

## 📈 Next Steps After Launch

1. Share with 5-10 friends to test
2. Monitor logs for any errors
3. Collect user feedback
4. Add more question types
5. Consider adding:
   - Friends list functionality
   - Private match rooms
   - Tournament mode
   - Achievement system
   - Mobile app (React Native)

---

**You're ready to go!** Follow the 5 deployment steps above and you'll have MathClash live in production within 5 minutes.





