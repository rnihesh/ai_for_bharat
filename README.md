# CivicLemma

CivicLemma is a civic engagement platform designed to bridge the gap between citizens and municipal authorities in India. The platform enables citizens to report local infrastructure issues such as potholes, garbage dumping, fallen trees, illegal parking, and more by simply uploading a photo. An AI-powered classification system automatically identifies the type of issue, and the report is routed to the appropriate municipality for resolution. Municipalities can track, respond to, and resolve issues through a dedicated dashboard, while platform administrators have oversight over the entire system. A public leaderboard ranks municipalities based on their responsiveness, promoting transparency and accountability in local governance.

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Getting Started](#getting-started)
5. [Environment Variables](#environment-variables)
6. [Running the Application](#running-the-application)
7. [Deployment](#deployment)
8. [API Reference](#api-reference)
9. [User Roles](#user-roles)
10. [Test Credentials](#test-credentials)

---

## Features

- Report civic issues by uploading photos with automatic location detection
- AI-powered image classification using a trained MobileNetV2 model to identify issue types
- AI-generated issue descriptions using AWS Bedrock
- Interactive map view to browse all reported issues in your area
- Municipality dashboard for officials to manage and respond to issues
- Admin dashboard for platform-wide oversight and municipality management
- Public leaderboard ranking municipalities by performance score
- Real-time status tracking (Open, In Progress, Closed)
- Amazon Cognito authentication with email/password and Google Sign-In
- Responsive design for mobile and desktop

---

## Tech Stack

### Frontend

- Next.js 16 with App Router
- React 18
- TailwindCSS 4
- Radix UI components
- TypeScript

### Backend

- Node.js with Express.js
- TypeScript
- AWS SDK v3
- Zod for validation
- S3 + CloudFront for image storage

### Machine Learning Service

- Python with FastAPI
- TensorFlow/Keras (MobileNetV2)
- AWS Bedrock for description generation
- PIL for image processing

### Infrastructure

- Amazon DynamoDB (Database)
- Amazon Cognito (Authentication)
- Amazon S3 + CloudFront (Image Storage & CDN)
- AWS Bedrock (AI/LLM)
- Amazon Transcribe (Speech-to-Text)
- Amazon Polly (Text-to-Speech)
- Google Maps API

---

## Project Structure

```
civiclemma/
|
|-- client/                 # Next.js Frontend Application
|   |-- src/
|   |   |-- app/           # Next.js App Router pages
|   |   |   |-- admin/     # Admin dashboard pages
|   |   |   |-- auth/      # Login, register, forgot password
|   |   |   |-- leaderboard/
|   |   |   |-- map/       # Interactive issue map
|   |   |   |-- municipality/  # Municipality dashboard
|   |   |   |-- profile/
|   |   |   |-- report/    # Issue reporting page
|   |   |-- components/    # Reusable React components
|   |   |-- contexts/      # React context providers (Auth)
|   |   |-- lib/           # Utilities, API client, Firebase config
|   |-- public/            # Static assets
|   |-- package.json
|
|-- server/                 # Express.js Backend API
|   |-- src/
|   |   |-- routes/        # API route handlers
|   |   |   |-- admin.ts   # Admin endpoints
|   |   |   |-- auth.ts    # Authentication endpoints
|   |   |   |-- issues.ts  # Issue CRUD operations
|   |   |   |-- municipalities.ts
|   |   |   |-- upload.ts  # S3 presigned URL upload handling
|   |   |-- middleware/    # Auth, error handling
|   |   |-- services/      # Business logic (location, classification)
|   |   |-- shared/        # Types, utilities, validation schemas
|   |-- package.json
|
|-- ml/                     # FastAPI Machine Learning Service
|   |-- main.py            # FastAPI application with endpoints
|   |-- models/
|   |   |-- best_model.keras    # Trained MobileNetV2 model
|   |   |-- class_mapping.json  # Issue type mappings
|   |-- requirements.txt
|
|-- package.json            # Root package with dev scripts
```

---

## Getting Started

### Prerequisites

- Node.js version 18.0.0 or higher
- Python version 3.9 or higher
- AWS account with DynamoDB, S3, Cognito, and Bedrock access
- Google Maps API key with Maps JavaScript API and Geocoding API enabled

### Installation

1. Clone the repository:

```bash
git clone https://github.com/rnihesh/techsprint-gdg.git
cd techsprint-gdg
```

2. Install all Node.js dependencies:

```bash
npm run install:all
```

3. Set up the Python virtual environment for the ML service:

```bash
npm run install:ml
```

4. Set up AWS infrastructure:

   - Deploy the CloudFormation stack from `infra/cloudformation.json`
   - Deploy DynamoDB tables from `dynamodb-tables.json`
   - Configure AWS credentials locally (`aws configure`)

5. Create environment files (see Environment Variables section below)

---

## Environment Variables

### Client (client/.env)

```env
NEXT_PUBLIC_COGNITO_USER_POOL_ID=your_cognito_user_pool_id
NEXT_PUBLIC_COGNITO_CLIENT_ID=your_cognito_client_id
NEXT_PUBLIC_COGNITO_REGION=ap-south-1
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_ML_API_URL=http://localhost:8000
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
NEXT_PUBLIC_APP_NAME=CivicLemma
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Server (server/.env)

```env
PORT=3001
NODE_ENV=development
AWS_REGION=ap-south-1
DYNAMODB_TABLE_PREFIX=civiclemma_
S3_BUCKET_NAME=civiclemma-uploads
CLOUDFRONT_DOMAIN=your-distribution.cloudfront.net
COGNITO_USER_POOL_ID=your_cognito_user_pool_id
COGNITO_CLIENT_ID=your_cognito_client_id
BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0
BEDROCK_REGION=us-east-1
CORS_ORIGIN=http://localhost:3000
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
ML_SERVICE_URL=http://localhost:8000
```

### ML Service (ml/.env)

```env
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0
```

---

## Running the Application

### Development Mode

Run all three services concurrently:

```bash
npm run dev
```

Or run services individually:

```bash
# Terminal 1 - Backend API
npm run dev:server

# Terminal 2 - Frontend
npm run dev:client

# Terminal 3 - ML Service
npm run dev:ml
```

### Service URLs

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- ML Service: http://localhost:8000

---

## Deployment

### Frontend to Vercel

1. Connect your repository to Vercel
2. Set the Root Directory to `client`
3. Framework will be auto-detected as Next.js
4. Add all environment variables with the `NEXT_PUBLIC_` prefix
5. Update `NEXT_PUBLIC_API_URL` to your deployed backend URL
6. Update `NEXT_PUBLIC_ML_API_URL` to your deployed ML service URL

### Backend to AWS (Docker)

1. Build the Docker image: `docker build -t civiclemma-server ./server`
2. Push to ECR or deploy on ECS/EC2
3. Set AWS environment variables (region, DynamoDB prefix, S3 bucket, Cognito, Bedrock)
4. Set `CORS_ORIGIN` to your frontend URL

### ML Service to AWS (Docker)

1. Build the Docker image: `docker build -t civiclemma-ml ./ml`
2. Push to ECR or deploy on ECS/EC2
3. Set `AWS_REGION` and `BEDROCK_MODEL_ID` environment variables

### Full Stack with Docker Compose

```bash
# Set environment variables in .env file
docker-compose up --build
```

---

## API Reference

### Public Endpoints

| Method | Endpoint                        | Description                                   |
| ------ | ------------------------------- | --------------------------------------------- |
| GET    | /api/health                     | Health check                                  |
| GET    | /api/issues                     | List all issues with filtering and pagination |
| POST   | /api/issues                     | Create a new issue report                     |
| GET    | /api/issues/:id                 | Get a specific issue                          |
| GET    | /api/municipalities             | List all municipalities                       |
| GET    | /api/municipalities/leaderboard | Get municipality rankings                     |

### Protected Endpoints (Requires Authentication)

| Method | Endpoint                  | Description                       |
| ------ | ------------------------- | --------------------------------- |
| POST   | /api/issues/:id/respond   | Municipality responds to an issue |
| POST   | /api/issues/:id/close     | Close a resolved issue            |
| POST   | /api/upload/presigned  | Get S3 presigned upload URL     |
| GET    | /api/admin/stats          | Platform statistics               |
| GET    | /api/admin/municipalities | Manage municipalities             |

### ML Service Endpoints

| Method | Endpoint              | Description                          |
| ------ | --------------------- | ------------------------------------ |
| GET    | /health               | Health check                         |
| POST   | /classify             | Classify an issue image              |
| POST   | /generate-description | Generate AI description for an issue |

---

## User Roles

The platform has three distinct user roles:

### Citizen (Default)

- Report civic issues with photos
- Track status of submitted reports
- View all issues on the map
- View municipality leaderboard

### Municipality User

- View issues assigned to their municipality
- Respond to and update issue status
- Close resolved issues
- Access municipality dashboard with analytics

### Platform Administrator

- Full access to all platform features
- Manage municipalities (create, edit, delete)
- View platform-wide statistics
- Oversee all issues and responses

---

## Test Credentials

Use these credentials to test different user roles:

### Citizen (Anonymous User)

- No login required for browsing
- Register with any email to report issues

### Municipality User

- Email: lemma_hyderabad@gmail.com
- Password: lemma@123

### Platform Administrator

- Email: admin@mail.com
- Password: techsprint
