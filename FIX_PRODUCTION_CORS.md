# 🔧 Fix Production CORS & Firestore Errors

## Issues Found:

1. **CORS Error**: Function call from `mathclash-3e565.web.app` being blocked
2. **Firestore HTTP 400**: Query requires index (may still be building)
3. **FirebaseError: internal**: Function error before CORS headers sent

---

## ✅ Solutions:

### 1. Firestore Index Status

The index was deployed but may still be building:

**Check index status:**
https://console.firebase.google.com/project/mathclash-3e565/firestore/indexes

**Look for:**
- Collection: `matches`
- Fields: `playerIds` (array-contains), `status` (asc), `createdAt` (desc)
- Status should be **"Enabled"** (not "Building")

**If still building:**
- Wait 1-2 minutes
- Refresh the page
- Try matchmaking again

### 2. Function CORS Issue

Firebase v2 callable functions **automatically handle CORS**. However, if the function throws an error before responding, CORS headers might not be sent.

**Possible causes:**
- Function erroring before response
- Firestore query failing (index not ready)
- Authentication issues

**Fix:** The function code is correct. Once the index builds, errors should stop.

### 3. Verify Function Deployment

Functions are deployed. Verify they're working:

```bash
firebase functions:list
```

Should show:
- ✅ requestQuickMatch (callable, us-central1)
- ✅ submitAnswer (callable, us-central1)
- ✅ getGameFeedback (callable, us-central1)

---

## 🧪 Quick Test:

1. **Wait 1-2 minutes** for index to finish building
2. **Check index status** in console (link above)
3. **Refresh production site**: https://mathclash-3e565.web.app
4. **Try matchmaking** again

If index is built but still errors:
- Check function logs: https://console.firebase.google.com/project/mathclash-3e565/functions/logs
- Look for specific error messages

---

## 🔍 Function Logs:

View real-time logs:
```bash
firebase functions:log requestQuickMatch
```

Or in console:
https://console.firebase.google.com/project/mathclash-3e565/functions/logs

---

**Status**: Index deploying, functions deployed. Wait 1-2 minutes then test! 🚀





