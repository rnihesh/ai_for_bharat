# Firebase Service Account Setup

To fix the "Unable to detect a Project Id" error, you need to download your Firebase service account key:

## Steps:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **civiclemma**
3. Click the **gear icon** (Settings) → **Project settings**
4. Go to the **Service accounts** tab
5. Click **"Generate new private key"**
6. Save the downloaded JSON file as `serviceAccountKey.json` in the `server/` folder

## After downloading:

Update `server/.env`:
```
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
```

Or if deploying to Render/Vercel, you can paste the entire JSON content:
```
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"civiclemma",...}
```

## Current Status:

The server will show warnings but won't crash. Firebase operations will fail until you add the service account.
