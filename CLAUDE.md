# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CivicLemma is a civic engagement platform for India that enables citizens to report local infrastructure issues (potholes, garbage, illegal parking, etc.) via photo uploads. An AI classification system identifies issue types and routes them to appropriate municipalities. Includes voice/chat AI agent interface and Telegram bot integration.

## Commands

### Development
```bash
npm run dev              # Run all 4 services concurrently (recommended)
npm run dev:client       # Frontend only (port 3000)
npm run dev:server       # Backend only (port 3001)
npm run dev:ml           # ML service only (port 8000)
npm run dev:agent        # Agent service only (port 8001)
```

### Installation
```bash
npm run install:all      # Install Node.js dependencies for client & server
npm run install:ml       # Set up Python venv and install ML dependencies
npm run install:agent    # Set up Python venv and install agent dependencies
```

### Build & Production
```bash
npm run build            # Build server + client
npm run build:client     # Build frontend
npm run build:server     # Build backend
npm start:server         # Run production server
npm start:client         # Run production frontend
npm start:ml             # Run production ML service
npm start:agent          # Run production agent service
```

### Type Checking & Linting
```bash
cd client && npm run typecheck    # Client TypeScript check
cd server && npm run typecheck    # Server TypeScript check
cd client && npm run lint         # ESLint for client
```

## Architecture

### Four-Service Architecture
- **client/** - Next.js 16 frontend (React 18, TailwindCSS 4, Radix UI)
- **server/** - Express.js backend (TypeScript, Firebase Admin SDK, Zod validation)
- **ml/** - FastAPI Python service (TensorFlow MobileNetV2, Google Gemini API)
- **agent/** - FastAPI Python service (Azure OpenAI GPT-4o, voice/chat agents, Telegram bot)

### Data Flow
```
Image Upload → Cloudinary → ML Classification → Firestore Storage
                                    ↓
                         Gemini for AI Description
```

### Key Directories
- `client/src/app/` - Next.js App Router pages
- `client/src/components/ui/` - Radix-based UI component library
- `client/src/lib/api.ts` - Centralized API client
- `client/src/lib/agentApi.ts` - Agent service API client
- `client/src/contexts/AuthContext.tsx` - Authentication state
- `server/src/routes/` - Express API route handlers
- `server/src/shared/types.ts` - Shared TypeScript types (IssueType, UserRole, etc.)
- `server/src/shared/validation.ts` - Zod validation schemas
- `server/src/middleware/auth.ts` - Firebase token verification
- `ml/models/` - Trained Keras model and class mappings
- `agent/agents/` - Chat, voice, and priority scoring agents
- `agent/telegram_bot/` - Telegram bot integration

### User Roles
- `USER` - Reports issues, tracks status (default citizen role)
- `MUNICIPALITY_USER` - Responds to/closes issues for their municipality
- `PLATFORM_MAINTAINER` - Admin access to all features

### Issue Types (9 categories)
Defined in `server/src/shared/types.ts`: POTHOLE, GARBAGE, ILLEGAL_PARKING, DAMAGED_SIGN, FALLEN_TREE, VANDALISM, DEAD_ANIMAL, DAMAGED_CONCRETE, DAMAGED_ELECTRICAL

## TypeScript Configuration

- Client path alias: `@/*` maps to `./src/*`
- Server builds to CommonJS via tsup

## Critical Sync Points

Issue types must stay synchronized across:
1. `server/src/shared/types.ts` (IssueType enum + ML_CLASS_TO_ISSUE_TYPE mapping)
2. `server/src/shared/validation.ts` (Zod schemas)
3. `ml/main.py` (ML_CLASS_TO_ISSUE_TYPE mapping)

## Firebase Setup

Requires `server/serviceAccountKey.json` (download from Firebase Console > Project Settings > Service Accounts). This file is gitignored.

## Test Credentials

- **Citizen**: Register with any email
- **Municipality User**: lemma_hyderabad@gmail.com / lemma@123
- **Admin**: admin@mail.com / techsprint
