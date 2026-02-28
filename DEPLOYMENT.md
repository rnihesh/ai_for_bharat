# CivicLemma Deployment Guide

This guide explains how to deploy CivicLemma to production:
- **Frontend (Client)**: Vercel
- **Backend (Server)**: Render
- **ML Service**: Render

## Prerequisites

1. **Firebase Project** with:
   - Authentication enabled (Email/Password + Google)
   - Firestore Database
   - Service Account Key (JSON file)

2. **Cloudinary Account** for image uploads

3. **Google Cloud Console** with:
   - Maps JavaScript API enabled
   - Gemini API key (for ML service)

4. **Accounts on**:
   - [Vercel](https://vercel.com)
   - [Render](https://render.com)

---

## Step 1: Deploy ML Service to Render

### 1.1 Create Web Service
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **New** → **Web Service**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `civiclemma-ml`
   - **Root Directory**: `ml`
   - **Runtime**: Python 3
   - **Build Command**: `pip install --upgrade pip && pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### 1.2 Set Environment Variables
In Render dashboard, add:
```
GEMINI_API_KEY=your-gemini-api-key
```

### 1.3 Note the URL
After deployment, note the URL (e.g., `https://civiclemma-ml.onrender.com`)

---

## Step 2: Deploy Backend to Render

### 2.1 Create Web Service
1. In Render Dashboard, click **New** → **Web Service**
2. Connect your GitHub repository
3. Configure:
   - **Name**: `civiclemma-api`
   - **Root Directory**: `server`
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

### 2.2 Set Environment Variables
In Render dashboard, add these environment variables:

```bash
# Server
NODE_ENV=production
PORT=10000

# Firebase - IMPORTANT: Paste your entire serviceAccountKey.json as a single line
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"your-project",...}
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com

# CORS - Set to your Vercel frontend URL (add this after Vercel deployment)
CORS_ORIGIN=https://your-app.vercel.app

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Google Maps
GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# ML Service URL
ML_SERVICE_URL=https://civiclemma-ml.onrender.com
```

### 2.3 Getting FIREBASE_SERVICE_ACCOUNT_KEY
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to **Project Settings** → **Service Accounts**
4. Click **Generate new private key**
5. Open the downloaded JSON file
6. **Copy the entire contents** and paste as the value for `FIREBASE_SERVICE_ACCOUNT_KEY`

### 2.4 Note the URL
After deployment, note the URL (e.g., `https://civiclemma-api.onrender.com`)

---

## Step 3: Deploy Frontend to Vercel

### 3.1 Import Project
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **Add New** → **Project**
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `client`

### 3.2 Set Environment Variables
In Vercel project settings → Environment Variables, add:

```bash
# API URLs (from Render deployments)
NEXT_PUBLIC_API_URL=https://civiclemma-api.onrender.com/api
NEXT_PUBLIC_ML_API_URL=https://civiclemma-ml.onrender.com

# Firebase (Client-side - these are public keys)
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456

# Google Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# App
NEXT_PUBLIC_APP_NAME=CivicLemma
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

### 3.3 Getting Firebase Client Config
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to **Project Settings** → **General**
4. Scroll to **Your apps** → Select your web app
5. Copy the `firebaseConfig` values

### 3.4 Deploy
Click **Deploy** and wait for the build to complete.

---

## Step 4: Update CORS (Post-Deployment)

After Vercel deployment:

1. Go back to **Render** → your `civiclemma-api` service
2. Update the `CORS_ORIGIN` environment variable with your Vercel URL:
   ```
   CORS_ORIGIN=https://your-app.vercel.app
   ```
3. The service will automatically redeploy

---

## Verification Checklist

### ML Service
- [ ] Visit `https://civiclemma-ml.onrender.com/health` - should return `{"status":"ok","model_loaded":true}`
- [ ] Visit `https://civiclemma-ml.onrender.com/docs` - should show API documentation

### Backend Service  
- [ ] Visit `https://civiclemma-api.onrender.com/api/health` - should return health status
- [ ] Check Render logs for "Firebase initialized" message

### Frontend
- [ ] Visit your Vercel URL
- [ ] Try logging in with Google
- [ ] Try creating a test issue

---

## Troubleshooting

### "Firebase credentials not found"
- Ensure `FIREBASE_SERVICE_ACCOUNT_KEY` is set correctly
- Make sure the JSON is valid and complete (single line, no extra quotes)

### "CORS error"
- Update `CORS_ORIGIN` in Render to match your Vercel URL exactly
- Make sure to include `https://` prefix

### "ML service not responding"
- Check if the ML service is healthy at `/health` endpoint
- Verify `GEMINI_API_KEY` is set correctly

### Build fails on Render
- Check the build logs for specific errors
- Ensure all dependencies are in `package.json` / `requirements.txt`

### Build fails on Vercel
- Check that all `NEXT_PUBLIC_*` environment variables are set
- Review build logs for any missing dependencies

---

## Environment Variables Summary

### Vercel (Client)
| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Backend API URL |
| `NEXT_PUBLIC_ML_API_URL` | Yes | ML Service URL |
| `NEXT_PUBLIC_FIREBASE_*` | Yes | Firebase client config |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Yes | Google Maps API key |
| `NEXT_PUBLIC_APP_NAME` | No | App display name |
| `NEXT_PUBLIC_APP_URL` | No | App URL |

### Render (Server)
| Variable | Required | Description |
|----------|----------|-------------|
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Yes | Firebase service account JSON |
| `FIREBASE_PROJECT_ID` | Yes | Firebase project ID |
| `FIREBASE_STORAGE_BUCKET` | Yes | Firebase storage bucket |
| `CORS_ORIGIN` | Yes | Frontend URL for CORS |
| `CLOUDINARY_*` | Yes | Cloudinary credentials |
| `GOOGLE_MAPS_API_KEY` | Yes | Google Maps API key |
| `ML_SERVICE_URL` | Yes | ML service URL |

### Render (ML)
| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key |

---

## Optional: Using render.yaml for Blueprint Deployment

You can also deploy using Render Blueprints:

1. In Render Dashboard, click **New** → **Blueprint**
2. Connect your repository
3. Render will detect `server/render.yaml` and `ml/render.yaml`
4. Set the environment variables marked as `sync: false`
5. Deploy

This method deploys both services at once.
