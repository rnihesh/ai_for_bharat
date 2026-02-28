# CivicLemma Deployment Guide

This guide explains how to deploy CivicLemma to production using AWS services.

## Architecture

- **Frontend (Client)**: Vercel or Docker
- **Backend (Server)**: AWS ECS/EC2 or Docker
- **ML Service**: AWS ECS/EC2 or Docker
- **Agent Service**: AWS ECS/EC2 or Docker

## Prerequisites

1. **AWS Account** with access to:
   - DynamoDB
   - S3
   - CloudFront
   - Cognito
   - Bedrock (Claude model access enabled)
   - Transcribe
   - Polly

2. **Google Cloud Console** with:
   - Maps JavaScript API enabled
   - Geocoding API enabled

3. **AWS CLI** configured with credentials (`aws configure`)

4. **Docker** installed (for containerized deployment)

---

## Step 1: Deploy AWS Infrastructure

### 1.1 Deploy CloudFormation Stack

```bash
cd infra
chmod +x deploy.sh
./deploy.sh dev
```

This creates:
- S3 bucket for image uploads
- S3 bucket for Transcribe audio
- CloudFront distribution for image CDN
- Cognito User Pool and Client

### 1.2 Enable Bedrock Model Access

1. Go to [AWS Bedrock Console](https://console.aws.amazon.com/bedrock)
2. Navigate to **Model access** → **Manage model access**
3. Enable access for `Anthropic Claude 3 Haiku` (or your preferred model)
4. Wait for access status to show **Access granted**

### 1.3 Note the Outputs

After CloudFormation deployment, note these values from the stack outputs:
- `UploadsBucketName` — S3 bucket name for uploads
- `CloudFrontDomain` — CDN domain for images
- `UserPoolId` — Cognito User Pool ID
- `UserPoolClientId` — Cognito App Client ID

---

## Step 2: Deploy with Docker Compose

### 2.1 Create Root `.env` File

Create a `.env` file in the project root:

```bash
# AWS Credentials
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=ap-south-1

# DynamoDB
DYNAMODB_TABLE_PREFIX=civiclemma_

# S3 + CloudFront
S3_BUCKET_NAME=civiclemma-uploads-dev
CLOUDFRONT_DOMAIN=d1234567890.cloudfront.net

# Cognito
COGNITO_USER_POOL_ID=ap-south-1_xxxxxxxxx
COGNITO_CLIENT_ID=your_cognito_client_id

# Bedrock
BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0
BEDROCK_REGION=us-east-1

# Google Maps
GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# ML Service
ML_SERVICE_URL=http://ml:8000

# CORS
CORS_ORIGIN=http://localhost:3000

# Agent
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
POLLY_VOICE_ID=Kajal
POLLY_ENGINE=neural
TRANSCRIBE_S3_BUCKET=civiclemma-transcribe-dev
```

### 2.2 Build and Run

```bash
docker-compose up --build
```

### Service URLs (Local)
| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:3001 |
| ML Service | http://localhost:8000 |
| Agent Service | http://localhost:8001 |

---

## Step 3: Deploy Frontend to Vercel (Optional)

If you prefer Vercel for the frontend instead of Docker:

### 3.1 Import Project
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **Add New** → **Project**
3. Import your GitHub repository
4. Set **Root Directory** to `client`
5. Framework Preset: **Next.js**

### 3.2 Set Environment Variables

In Vercel project settings → Environment Variables, add:

```bash
# API URLs
NEXT_PUBLIC_API_URL=https://your-api-domain.com/api
NEXT_PUBLIC_ML_API_URL=https://your-ml-domain.com

# Cognito
NEXT_PUBLIC_COGNITO_USER_POOL_ID=ap-south-1_xxxxxxxxx
NEXT_PUBLIC_COGNITO_CLIENT_ID=your_cognito_client_id
NEXT_PUBLIC_COGNITO_REGION=ap-south-1

# Google Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# App
NEXT_PUBLIC_APP_NAME=CivicLemma
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

### 3.3 Update CORS

After Vercel deployment, update `CORS_ORIGIN` on the backend to match:
```
CORS_ORIGIN=https://your-app.vercel.app
```

---

## Verification Checklist

### ML Service
- [ ] `GET /health` returns `{"status":"ok","model_loaded":true}`
- [ ] `GET /docs` shows FastAPI documentation

### Backend Service
- [ ] `GET /api/health` returns health status
- [ ] DynamoDB tables are accessible and populated

### Frontend
- [ ] Login with email/password works via Cognito
- [ ] Creating a test issue works
- [ ] Image upload to S3 works and displays via CloudFront

### Agent Service
- [ ] Telegram bot responds to `/start`
- [ ] Voice messages are transcribed via Transcribe
- [ ] TTS responses play via Polly

---

## Troubleshooting

### "Access Denied" errors
- Verify AWS credentials have appropriate IAM policies
- Ensure the IAM user/role has DynamoDB, S3, Cognito, Bedrock, Transcribe, and Polly access

### "Bedrock model not available"
- Visit the Bedrock console and verify model access is enabled
- Check that `BEDROCK_REGION` is set to a region where the model is available (e.g., `us-east-1`)

### "CORS error"
- Update `CORS_ORIGIN` to match your frontend URL exactly
- Include the `https://` prefix

### "ML service not responding"
- Check the `/health` endpoint
- Verify `BEDROCK_MODEL_ID` is set and model access is granted in the Bedrock console

### DynamoDB errors
- Verify tables exist with the correct prefix (`civiclemma_`)
- Check IAM permissions include `dynamodb:GetItem`, `PutItem`, `Query`, `Scan`, `UpdateItem`, `DeleteItem`

### Image upload fails
- Verify S3 bucket exists and CORS is configured
- Check `S3_BUCKET_NAME` and `CLOUDFRONT_DOMAIN` env vars are set correctly

---

## Environment Variables Summary

### Client
| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Backend API URL |
| `NEXT_PUBLIC_ML_API_URL` | Yes | ML Service URL |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | Yes | Cognito User Pool ID |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | Yes | Cognito App Client ID |
| `NEXT_PUBLIC_COGNITO_REGION` | Yes | AWS region for Cognito |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Yes | Google Maps API key |
| `NEXT_PUBLIC_APP_NAME` | No | App display name |
| `NEXT_PUBLIC_APP_URL` | No | App URL |

### Server
| Variable | Required | Description |
|----------|----------|-------------|
| `AWS_REGION` | Yes | AWS region |
| `DYNAMODB_TABLE_PREFIX` | Yes | DynamoDB table prefix |
| `S3_BUCKET_NAME` | Yes | S3 uploads bucket |
| `CLOUDFRONT_DOMAIN` | Yes | CloudFront CDN domain |
| `COGNITO_USER_POOL_ID` | Yes | Cognito User Pool ID |
| `COGNITO_CLIENT_ID` | Yes | Cognito Client ID |
| `BEDROCK_MODEL_ID` | Yes | Bedrock model identifier |
| `BEDROCK_REGION` | No | Bedrock region (defaults to AWS_REGION) |
| `GOOGLE_MAPS_API_KEY` | Yes | Google Maps API key |
| `ML_SERVICE_URL` | Yes | ML service URL |
| `CORS_ORIGIN` | Yes | Frontend URL for CORS |

### ML Service
| Variable | Required | Description |
|----------|----------|-------------|
| `AWS_REGION` | Yes | AWS region for Bedrock |
| `BEDROCK_MODEL_ID` | Yes | Bedrock model identifier |

### Agent Service
| Variable | Required | Description |
|----------|----------|-------------|
| `AWS_REGION` | Yes | AWS region |
| `BEDROCK_MODEL_ID` | Yes | Bedrock model identifier |
| `DYNAMODB_TABLE_PREFIX` | Yes | DynamoDB table prefix |
| `TELEGRAM_BOT_TOKEN` | Yes | Telegram bot token |
| `POLLY_VOICE_ID` | No | Polly voice (default: Kajal) |
| `POLLY_ENGINE` | No | Polly engine (default: neural) |
| `TRANSCRIBE_S3_BUCKET` | Yes | S3 bucket for audio files |
