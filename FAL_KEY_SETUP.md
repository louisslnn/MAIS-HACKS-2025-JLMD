# FAL API Key Configuration

## Important: .env vs Firebase Functions Config

The FAL_KEY you added to `.env` won't work for Firebase Functions. Firebase Functions use a different configuration system.

## How to Configure FAL_KEY

### Step 1: Get Your FAL API Key
Get your key from: https://fal.ai/dashboard/keys

### Step 2: Set it in Firebase Functions Config
Run this command in your terminal:

```bash
cd /Users/dominique/Desktop/MathClash/mathclash-app
firebase functions:config:set fal.key="YOUR_FAL_API_KEY_HERE"
```

Replace `YOUR_FAL_API_KEY_HERE` with your actual key.

### Step 3: Verify Configuration
Check that it's set correctly:

```bash
firebase functions:config:get
```

You should see:
```json
{
  "fal": {
    "key": "YOUR_KEY"
  }
}
```

### Step 4: Deploy Functions
After setting the config, deploy your functions:

```bash
npm run functions:build
firebase deploy --only functions
```

## Why Not .env?

- `.env` files work for Next.js frontend code
- Firebase Functions run on Google Cloud servers
- They need configuration set via `firebase functions:config:set`
- This keeps secrets secure and separate from your code

## Local Development (Optional)

For local testing with emulators, you can create a `.runtimeconfig.json` file in the `functions` directory:

```json
{
  "fal": {
    "key": "YOUR_KEY_HERE"
  }
}
```

**Important**: Add `.runtimeconfig.json` to `.gitignore` (should already be there)

## Troubleshooting

If you get "FAL_KEY is not configured" error:
1. Make sure you ran `firebase functions:config:set`
2. Deploy the functions again
3. Check logs: `firebase functions:log`





