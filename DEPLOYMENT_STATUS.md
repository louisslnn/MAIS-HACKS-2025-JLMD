# Deployment Status - Async Ranked Mode

**Date:** November 2, 2025  
**Feature:** Asynchronous Ranked Gameplay with Writing Mode

---

## ✅ Successfully Deployed

### Frontend (Firebase Hosting)
- **Status:** ✅ Deployed successfully
- **URL:** https://mathclash-3e565.web.app
- **Features Live:**
  - Async ranked gameplay UI
  - Writing mode toggle for ranked
  - Opponent progress tracking
  - Waiting screen
  - Next question button
  - Question counter (X of 10)

### Functions - 1st Gen (Working)
- ✅ `generateRankedFeedback` - NEW competitive AI feedback
- ✅ `generatePracticeFeedback` - Updated
- ✅ `verifyWrittenAnswers` - Updated with userId support

### Firestore Indexes
- ✅ New index deployed: `tickets` (mode + topic + writingMode + createdAt)
- **Build Status:** Index is building (1-5 minutes typical)

---

## ⚠️ Deployment Issues

### Functions - 2nd Gen (Healthcheck Failures)
**Status:** Container healthcheck timeouts  
**Affected Functions:**
- `requestQuickMatch` ⚠️ CRITICAL
- `submitAnswer` ⚠️ CRITICAL
- `onRoundLocked` ⚠️ CRITICAL
- `onMatchCompleted` ⚠️ CRITICAL
- `quickMatchmaker` ⚠️ CRITICAL
- `cancelQueue`
- `forfeitMatch`
- `lockOverdueRounds`
- `detectInactivePlayers`
- `cleanupOldMatches`
- `resetAllRatings`
- `backfillUserDocuments`
- `acceptFriendInvite`
- `getGameFeedback`

**Error:** "Container failed to start and listen on PORT=8080 within timeout"

---

## 🐛 Known Bugs (From Production Test)

### Bug #1: Missing `writingMode` in Match Settings
**Symptom:** Match document shows no `writingMode: true` despite both players selecting it  
**Cause:** Old function version still running (deployment failed)  
**Fix:** ✅ Code updated, awaiting successful deployment

### Bug #2: Missing `currentRoundIndex` in PlayerState
**Symptom:** Player objects don't have `currentRoundIndex` field  
**Cause:** Old function version still running  
**Fix:** ✅ Code updated, awaiting successful deployment

### Bug #3: Pre-Answered Questions
**Symptom:** Player had answer already submitted for question 1  
**Cause:** Old match logic or timing issue  
**Fix:** ✅ Added duplicate answer prevention

### Bug #4: Pending Rounds Never Activate
**Symptom:** Rounds 2-10 stay "pending" forever  
**Cause:** Missing activation logic  
**Fix:** ✅ Added round activation when players reach them

---

## 🔧 Fixes Implemented (Awaiting Deployment)

### 1. Round Activation Logic (`functions/src/answers.ts`)
- When player submits answer and advances to next question
- Activates the next pending round
- Starts timer when player reaches that round
- Each player gets independent timer

### 2. Per-Player Timer Validation (`functions/src/answers.ts`)
- Only allows answering current question (prevents skipping)
- Validates `playerRoundIndex === submittingRoundNum`
- Prevents duplicate answer submissions

### 3. Settings Merge Fix (`functions/src/matchLifecycle.ts`)
- Properly merges writingMode into settings
- Sets default values correctly
- Uses `problemCategory` instead of `category`

### 4. Round Generation Fix (`functions/src/matchLifecycle.ts`)
- Pending rounds have placeholder timers (time 0)
- Only first round starts with real timer
- Prevents all rounds from timing out immediately

### 5. Queue Cleanup (`functions/src/matchmaking.ts`)
- Auto-cleans old tickets without `writingMode` field
- Backward compatible with existing queue

---

## 🚀 Solutions

### Option 1: Wait and Retry (Recommended)
Cloud Run healthcheck issues are often transient. Wait 10-15 minutes and retry:
```bash
cd functions && firebase deploy --only functions
```

### Option 2: Check Cloud Run Logs
Visit the provided log URLs to see specific errors:
- [submitAnswer logs](https://console.cloud.google.com/logs/viewer?project=mathclash-3e565&resource=cloud_run_revision/service_name/submitanswer)
- Check for memory issues, import errors, or startup failures

### Option 3: Delete and Redeploy
Delete failing functions and redeploy fresh:
```bash
# Via Firebase Console:
# 1. Go to Functions
# 2. Delete submitAnswer, requestQuickMatch, etc.
# 3. Redeploy: firebase deploy --only functions
```

### Option 4: Increase Cloud Run Resources
If logs show memory/timeout issues, increase resources via Firebase Console:
- Go to Cloud Run service
- Edit container
- Increase memory (512MB → 1GB)
- Increase timeout (60s → 300s)

---

## 📊 Current State

**What's Working:**
- ✅ Frontend with all async features
- ✅ AI feedback for ranked matches
- ✅ OCR with multi-player support
- ✅ Firestore indexes deploying

**What's Broken:**
- ⚠️ Matchmaking (old version running)
- ⚠️ Answer submission (old version running)
- ⚠️ Match lifecycle (old version running)

**Impact:**
- New matches will use OLD logic (synchronous, no writingMode filtering)
- Frontend has new features but backend isn't ready
- Users will experience inconsistent behavior

---

## ✅ Verification Checklist

Once deployment succeeds, verify:

1. **Index Built:** Check Firebase Console → Firestore → Indexes
2. **Functions Deployed:** All functions show latest deployment time
3. **Test Match:** Create ranked match with writingMode
4. **Check Data:** Match has `writingMode: true` and `currentRoundIndex: 1`
5. **Test Async:** Both players can progress independently
6. **Test Waiting:** First finisher sees waiting screen
7. **Test Feedback:** Ranked matches get competitive AI feedback

---

## 🆘 If Deployment Keeps Failing

Contact Firebase Support or:
1. Check project quotas (Cloud Run API limits)
2. Verify billing account is active
3. Check for region-specific outages
4. Consider migrating to Cloud Functions v2 with explicit runtime config
