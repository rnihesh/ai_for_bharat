# CivicLemma - Design Specification

## 1. System Architecture

### 1.1 High-Level Architecture

CivicLemma follows a microservices architecture with four independent services:

```
┌─────────────────────────────────────────────────────────────┐
│                         Client Layer                        │
│              (Next.js 16 + React 18 + Tailwind)             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway Layer                      │
│                    (Express.js Backend)                     │
└─────────────────────────────────────────────────────────────┘
                              │
                 ┌────────────┼────────────┐
                 ▼            ▼            ▼
         ┌──────────┐  ┌──────────┐  ┌──────────┐
         │    ML    │  │  Agent   │  │ Firebase │
         │ Service  │  │ Service  │  │Firestore │
         │(FastAPI) │  │(FastAPI) │  │          │
         └──────────┘  └──────────┘  └──────────┘
                │            │
                ▼            ▼
         ┌──────────┐  ┌──────────┐
         │  Gemini  │  │  Azure   │
         │   API    │  │  OpenAI  │
         └──────────┘  └──────────┘
```

### 1.2 Service Responsibilities

#### Client Service (Port 3000)
- User interface and experience
- Form handling and validation
- State management
- Authentication flow
- Real-time updates

#### Server Service (Port 3001)
- API endpoint management
- Authentication middleware
- Request validation
- Business logic orchestration
- Database operations

#### ML Service (Port 8000)
- Image classification using MobileNetV2
- Issue type prediction
- AI description generation via Gemini
- Model serving and inference

#### Agent Service (Port 8001)
- Chat agent for conversational queries
- Voice agent for audio interactions
- Priority scoring algorithm
- Telegram bot integration

## 2. Data Architecture

### 2.1 Database Schema (Firestore)

#### Users Collection (Administrative Only)
```typescript
{
  uid: string,              // Firebase Auth UID (for admin users only)
  email: string,
  displayName: string,
  role: 'MUNICIPALITY_USER' | 'PLATFORM_MAINTAINER',
  municipality?: string,    // For MUNICIPALITY_USER
  createdAt: Timestamp,
  updatedAt: Timestamp,
  lastActive: Timestamp
}
```

Note: No citizen user accounts exist. This collection is only for administrative staff.

#### Issues Collection
```typescript
{
  id: string,
  trackingCode: string,     // Short, memorable code (e.g., "HYD-ABC-1234")
  type: IssueType,          // One of 9 categories
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED',
  title: string,
  description: string,      // AI-generated or user-provided
  imageUrl: string,         // Cloudinary URL
  additionalImages?: string[], // Supporting photos from community
  location: {
    latitude: number,
    longitude: number,
    address?: string,
    municipality: string,
    ward?: string
  },
  contactInfo?: {          // Optional for notifications only
    phone?: string,        // Hashed for privacy
    email?: string,        // Hashed for privacy
    notificationPreference: 'SMS' | 'EMAIL' | 'BOTH' | 'NONE'
  },
  priority: number,         // 1-10 scale
  upvotes: number,          // Community engagement
  upvotedBy: string[],      // Anonymous session IDs (browser fingerprints)
  aiClassification: {
    predictedType: IssueType,
    confidence: number,
    modelVersion: string
  },
  responses: Array<{
    userId?: string,        // Only for municipality responses
    userName: string,
    message: string,
    timestamp: Timestamp,
    isOfficial: boolean    // From municipality
  }>,
  metadata: {
    source: 'WEB' | 'TELEGRAM' | 'WHATSAPP' | 'SMS',
    deviceType?: string,
    ipHash?: string,       // Hashed IP for spam prevention only
    duplicateOf?: string,  // Reference to original issue if duplicate
    userAgent?: string     // For analytics only
  },
  createdAt: Timestamp,
  updatedAt: Timestamp,
  resolvedAt?: Timestamp,
  viewCount: number,        // Public engagement metric
  shareCount: number        // How many times shared
}
```

Note: No userId field - all citizen submissions are completely anonymous.

#### Notifications Collection
```typescript
{
  id: string,
  issueId: string,
  trackingCode: string,
  type: 'STATUS_CHANGE' | 'NEW_RESPONSE' | 'RESOLVED' | 'UPVOTE_MILESTONE',
  message: string,
  deliveryMethod: 'SMS' | 'EMAIL',
  recipient: string,        // Hashed phone or email
  delivered: boolean,
  deliveredAt?: Timestamp,
  createdAt: Timestamp
}
```

Note: No userId - notifications sent directly to provided contact info.

#### Community Engagement Collection
```typescript
{
  id: string,
  issueId: string,
  actionType: 'UPVOTE' | 'SHARE' | 'COMMENT' | 'PHOTO_ADD',
  sessionId: string,        // Anonymous browser fingerprint
  metadata: {
    platform?: string,
    location?: string
  },
  createdAt: Timestamp
}
```

Note: Uses anonymous session IDs only - no user tracking.

#### Tracking Codes Collection (for fast lookups)
```typescript
{
  trackingCode: string,     // Primary key
  issueId: string,
  createdAt: Timestamp,
  expiresAt?: Timestamp     // Optional expiry for old issues
}
```

### 2.2 Issue Type Enumeration

```typescript
enum IssueType {
  POTHOLE = 'POTHOLE',
  GARBAGE = 'GARBAGE',
  ILLEGAL_PARKING = 'ILLEGAL_PARKING',
  DAMAGED_SIGN = 'DAMAGED_SIGN',
  FALLEN_TREE = 'FALLEN_TREE',
  VANDALISM = 'VANDALISM',
  DEAD_ANIMAL = 'DEAD_ANIMAL',
  DAMAGED_CONCRETE = 'DAMAGED_CONCRETE',
  DAMAGED_ELECTRICAL = 'DAMAGED_ELECTRICAL'
}
```

**Critical Synchronization Points:**
- `server/src/shared/types.ts` - TypeScript enum definition
- `server/src/shared/validation.ts` - Zod validation schemas
- `ml/main.py` - Python mapping dictionary

## 3. API Design

### 3.1 Authentication Flow

```
Citizen Flow (Fully Anonymous):
1. User visits platform → No login, no registration, no accounts
2. User submits issue → Tracking code generated immediately
3. Tracking code displayed + optional SMS/email sent
4. User can track via public URL anytime
5. User can bookmark URL or save tracking code
6. No authentication ever required for citizens

Municipality/Admin Flow (Authentication Required):
1. Admin submits credentials → Firebase Auth
2. Firebase returns ID token
3. Client stores token in AuthContext
4. All admin API requests include: Authorization: Bearer <token>
5. Server middleware verifies token with Firebase Admin SDK
6. Role-based access control enforced
```

### 3.2 Core API Endpoints

#### Public Endpoints (No Authentication Required - All Citizen Features)
- `POST /api/issues` - Create new issue anonymously
- `GET /api/issues/track/:trackingCode` - Track issue by code
- `GET /api/issues/public` - List public issues (with filters)
- `GET /api/issues/:id` - Get issue details
- `POST /api/issues/:id/upvote` - Upvote an issue
- `POST /api/issues/:id/photos` - Add supporting photo
- `GET /api/stats/public` - Public statistics dashboard
- `POST /api/issues/check-duplicate` - Check for similar issues
- `GET /api/issues/nearby` - Get issues near location
- `POST /api/issues/:id/share` - Track share count

#### Municipality Endpoints (Requires MUNICIPALITY_USER role)
- `GET /api/municipality/issues` - Issues in jurisdiction
- `PATCH /api/issues/:id/status` - Update issue status
- `POST /api/issues/:id/responses` - Add official response
- `GET /api/municipality/stats` - Municipality analytics

#### Admin Endpoints (Requires PLATFORM_MAINTAINER role)
- `DELETE /api/issues/:id` - Delete issue (moderation)
- `GET /api/admin/stats` - Admin analytics
- `POST /api/admin/users` - Create municipality user
- `PATCH /api/admin/users/:id/role` - Update user role
- `GET /api/admin/audit-logs` - View audit logs

#### ML Classification (Internal)
- `POST /api/ml/classify` - Classify uploaded image
- `POST /api/ml/describe` - Generate AI description

#### Agent Services (Public)
- `POST /api/agent/chat` - Chat with AI agent (no auth)
- `POST /api/agent/voice` - Voice interaction (no auth)
- `GET /api/agent/priority/:issueId` - Get priority score

#### Notification Services (Internal)
- `POST /api/notify/sms` - Send SMS notification
- `POST /api/notify/email` - Send email notification

### 3.3 Request/Response Format

#### Standard Success Response
```json
{
  "success": true,
  "data": { /* response payload */ }
}
```

#### Standard Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { /* optional additional context */ }
  }
}
```

## 4. Frontend Architecture

### 4.1 Directory Structure

```
client/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx           # Home page
│   │   ├── dashboard/         # User dashboard
│   │   ├── report/            # Issue reporting
│   │   ├── issues/            # Issue listing
│   │   └── login/             # Authentication
│   ├── components/
│   │   ├── ui/                # Radix UI components
│   │   ├── IssueCard.tsx      # Issue display component
│   │   ├── IssueForm.tsx      # Issue submission form
│   │   └── Navbar.tsx         # Navigation
│   ├── contexts/
│   │   └── AuthContext.tsx    # Authentication state
│   ├── lib/
│   │   ├── api.ts             # Backend API client
│   │   ├── agentApi.ts        # Agent service client
│   │   └── utils.ts           # Utility functions
│   └── types/
│       └── index.ts           # TypeScript type definitions
```

### 4.2 State Management

- **Authentication**: React Context API (AuthContext)
- **Server State**: React Query / SWR for data fetching
- **Form State**: React Hook Form with Zod validation
- **UI State**: Local component state with useState/useReducer

### 4.3 Routing Strategy

Next.js App Router with file-based routing:
- `/` - Landing page with public issue map and statistics
- `/report` - Anonymous issue reporting form (no login)
- `/track` - Public issue tracking page (enter tracking code)
- `/track/[code]` - Direct tracking via URL
- `/issues` - Public issue listing with filters
- `/issues/[id]` - Public issue detail page
- `/about` - About the platform
- `/privacy` - Privacy policy
- `/terms` - Terms of service
- `/municipality/login` - Municipality staff login
- `/municipality/dashboard` - Municipality dashboard (auth required)
- `/admin/login` - Admin login
- `/admin/dashboard` - Admin panel (auth required)

Note: No citizen registration, login, or profile pages.

### 4.4 Component Design Principles

- **Atomic Design**: Build from atoms (buttons) to organisms (forms)
- **Composition**: Prefer composition over inheritance
- **Accessibility**: Use Radix UI primitives for a11y compliance
- **Responsive**: Mobile-first design with Tailwind breakpoints
- **Type Safety**: Strict TypeScript with no implicit any

## 5. Backend Architecture

### 5.1 Directory Structure

```
server/
├── src/
│   ├── routes/
│   │   ├── auth.ts            # Authentication routes
│   │   ├── issues.ts          # Issue management routes
│   │   └── users.ts           # User management routes
│   ├── middleware/
│   │   ├── auth.ts            # Firebase token verification
│   │   ├── errorHandler.ts   # Global error handling
│   │   └── validation.ts     # Request validation
│   ├── services/
│   │   ├── issueService.ts   # Issue business logic
│   │   ├── mlService.ts      # ML service integration
│   │   └── notificationService.ts
│   ├── shared/
│   │   ├── types.ts          # Shared TypeScript types
│   │   └── validation.ts     # Zod schemas
│   └── index.ts              # Express app entry point
```

### 5.2 Middleware Pipeline

```
Request → CORS → Body Parser → Auth Middleware → 
Route Handler → Error Handler → Response
```

### 5.3 Validation Strategy

All incoming requests validated using Zod schemas:

```typescript
// Example: Issue creation validation
const createIssueSchema = z.object({
  type: z.enum([...IssueType values]),
  title: z.string().min(5).max(200),
  description: z.string().optional(),
  imageUrl: z.string().url(),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180)
  })
});
```

## 6. ML Service Architecture

### 6.1 Classification Pipeline

```
Image Upload → Preprocessing → MobileNetV2 Inference → 
Post-processing → Issue Type Mapping → Confidence Score
```

### 6.2 Model Architecture

- **Base Model**: MobileNetV2 (pre-trained on ImageNet)
- **Fine-tuning**: Transfer learning on civic issue dataset
- **Input**: 224x224 RGB images
- **Output**: 9-class probability distribution
- **Framework**: TensorFlow/Keras

### 6.3 AI Description Generation

```python
# Gemini API integration
def generate_description(image_url: str, issue_type: str) -> str:
    prompt = f"Describe this {issue_type} issue for a civic report"
    response = gemini_client.generate(
        prompt=prompt,
        image=image_url,
        max_tokens=150
    )
    return response.text
```

### 6.4 Model Versioning

- Models stored in `ml/models/` directory
- Version tracking in model metadata
- Backward compatibility for older predictions

## 7. Agent Service Architecture

### 7.1 Chat Agent Design

```python
class ChatAgent:
    def __init__(self):
        self.client = AzureOpenAI(...)
        self.context_window = []
    
    def process_query(self, user_message: str) -> str:
        # Add system context about CivicLemma
        # Query Firestore for relevant issue data
        # Generate response using GPT-4o
        # Return formatted response
```

### 7.2 Voice Agent Design

```
Audio Input → Speech-to-Text → Chat Agent → 
Text-to-Speech → Audio Output
```

### 7.3 Priority Scoring Algorithm

```python
def calculate_priority(issue: Issue) -> int:
    base_score = ISSUE_TYPE_WEIGHTS[issue.type]
    
    # Adjust for location density
    nearby_issues = count_nearby_issues(issue.location)
    density_factor = min(nearby_issues / 10, 2.0)
    
    # Adjust for time sensitivity
    age_hours = (now - issue.created_at).hours
    urgency_factor = 1.0 if age_hours < 24 else 0.8
    
    return int(base_score * density_factor * urgency_factor)
```

### 7.4 Telegram Bot Integration

- Webhook-based architecture
- Command handlers: /start, /report, /status, /help
- Photo upload support
- Inline keyboards for user interaction

## 8. Security Design

### 8.1 Authentication & Authorization

- **Citizen Access**: Fully public - no authentication whatsoever
- **Administrative Authentication**: Firebase ID tokens (JWT) for municipality/admin users only
- **Authorization**: Role-based access control (RBAC) for administrative operations only
- **Token Expiry**: 1 hour (Firebase default)
- **Refresh Strategy**: Client-side token refresh for admin users
- **Session Management**: Browser-based anonymous session IDs for spam prevention only
- **Rate Limiting**: IP-based rate limiting for anonymous submissions

### 8.2 API Security

- CORS configuration for allowed origins
- Strict rate limiting on public endpoints
- CAPTCHA/reCAPTCHA for issue submissions
- Input sanitization and validation
- SQL injection prevention (Firestore NoSQL)
- XSS protection via React's built-in escaping
- CSRF protection for administrative operations
- Content moderation for user-uploaded images
- Image validation (file type, size, content)
- Duplicate submission detection

### 8.3 Data Security & Privacy

- Service account keys in environment variables
- Firestore security rules for data access
- Image URLs signed with Cloudinary
- HTTPS enforcement in production
- Contact information hashing (phone/email)
- IP address anonymization (hashed for spam prevention only)
- No tracking cookies for citizens
- No user accounts or profiles for citizens
- GDPR-compliant data handling
- Right to deletion via tracking code
- Data minimization principles
- Anonymous-by-design architecture
- No personally identifiable information collected

## 9. Performance Optimization

### 9.1 Frontend Optimization

- Next.js automatic code splitting
- Image optimization with next/image
- Lazy loading for non-critical components
- CDN delivery via Vercel/Cloudinary
- Client-side caching with React Query

### 9.2 Backend Optimization

- Database indexing on frequently queried fields
- Connection pooling for external services
- Response compression (gzip)
- Caching layer for ML predictions
- Pagination for large result sets

### 9.3 ML Service Optimization

- Model quantization for faster inference
- Batch prediction support
- GPU acceleration (if available)
- Result caching for duplicate images

## 10. Error Handling & Logging

### 10.1 Error Categories

- **Client Errors (4xx)**: Validation failures, unauthorized access
- **Server Errors (5xx)**: Database failures, external API errors
- **ML Errors**: Classification failures, low confidence predictions
- **Integration Errors**: Firebase, Cloudinary, Gemini API failures

### 10.2 Logging Strategy

```typescript
// Structured logging format
{
  timestamp: ISO8601,
  level: 'INFO' | 'WARN' | 'ERROR',
  service: 'client' | 'server' | 'ml' | 'agent',
  message: string,
  context: {
    userId?: string,
    issueId?: string,
    requestId: string
  },
  error?: {
    stack: string,
    code: string
  }
}
```

## 11. Deployment Architecture

### 11.1 Development Environment

```bash
# All services run concurrently
npm run dev
# Client: localhost:3000
# Server: localhost:3001
# ML: localhost:8000
# Agent: localhost:8001
```

### 11.2 Production Deployment

- **Client**: Vercel / Netlify (static hosting)
- **Server**: Railway / Render / AWS EC2
- **ML Service**: Docker container on cloud VM
- **Agent Service**: Docker container on cloud VM
- **Database**: Firebase Firestore (managed)
- **Storage**: Cloudinary (managed CDN)

### 11.3 Environment Configuration

```
# Client
NEXT_PUBLIC_API_URL
NEXT_PUBLIC_FIREBASE_CONFIG

# Server
PORT
FIREBASE_SERVICE_ACCOUNT
ML_SERVICE_URL
AGENT_SERVICE_URL

# ML Service
PORT
GEMINI_API_KEY
MODEL_PATH

# Agent Service
PORT
AZURE_OPENAI_KEY
AZURE_OPENAI_ENDPOINT
TELEGRAM_BOT_TOKEN
```

## 12. Testing Strategy

### 12.1 Unit Testing

- Component testing with React Testing Library
- API route testing with Supertest
- ML model accuracy testing
- Utility function testing

### 12.2 Integration Testing

- End-to-end API flow testing
- Firebase integration testing
- ML service integration testing
- Agent service integration testing

### 12.3 Manual Testing

- Cross-browser compatibility
- Mobile responsiveness
- Accessibility testing with screen readers
- User acceptance testing

## 13. Monitoring & Analytics

### 13.1 Application Monitoring

- Error tracking (Sentry / LogRocket)
- Performance monitoring (Web Vitals)
- API response time tracking
- ML classification accuracy metrics

### 13.2 Business Metrics

- Issue report volume by type
- Average resolution time
- User engagement metrics
- Municipality response rates
- Geographic distribution of issues

## 14. Future Architecture Considerations

### 14.1 Scalability Enhancements

- Microservices containerization with Kubernetes
- Load balancing for high traffic
- Database sharding for large datasets
- CDN for global content delivery
- Redis caching layer for tracking codes and public data
- Elasticsearch for advanced issue search

### 14.2 Feature Additions

- Real-time WebSocket updates for issue status
- GraphQL API for flexible queries
- Mobile native apps (React Native)
- Advanced analytics dashboard with predictive insights
- Multi-language support (i18n) - Hindi, Tamil, Telugu, Bengali, etc.
- WhatsApp Business API integration
- SMS gateway integration for feature phones
- Blockchain-based transparency and immutability
- Integration with municipal ERP systems
- AI-powered duplicate detection and clustering
- Crowdsourced issue validation
- Geofencing for location-based notifications
- Progressive Web App (PWA) with offline support
- Voice-based reporting in regional languages
- Automated follow-up reminders for municipalities
- Public API for third-party integrations
- Open data portal for researchers and journalists

## 15. Anonymous User Experience Enhancements

### 15.1 Tracking Code System

```
Format: [CITY]-[CATEGORY]-[NUMBER]
Example: HYD-POT-1234 (Hyderabad Pothole #1234)

Benefits:
- Memorable and shareable
- Encodes useful information
- Easy to communicate verbally
- QR code generation for easy scanning
```

### 15.2 Duplicate Detection Algorithm

```python
def detect_duplicates(new_issue: Issue) -> List[Issue]:
    # Find issues within 100m radius
    nearby = find_nearby_issues(new_issue.location, radius=100)
    
    # Filter by same issue type
    same_type = [i for i in nearby if i.type == new_issue.type]
    
    # Check temporal proximity (within 7 days)
    recent = [i for i in same_type if days_ago(i) <= 7]
    
    # Image similarity check using ML
    similar = [i for i in recent if image_similarity(i.image, new_issue.image) > 0.8]
    
    return similar
```

### 15.3 Community Engagement Metrics

- **Issue Impact Score**: upvotes + views + shares
- **Municipality Responsiveness**: avg time to first response
- **Resolution Rate**: % of issues resolved within SLA
- **Community Participation**: active reporters per area
- **Trending Issues**: most upvoted in last 7 days

### 15.4 Notification Strategy for Anonymous Users

```typescript
interface NotificationPreference {
  method: 'SMS' | 'EMAIL' | 'NONE';
  events: {
    statusChange: boolean;
    municipalityResponse: boolean;
    resolution: boolean;
    milestones: boolean; // e.g., 10 upvotes
  };
}
```

### 15.5 Fully Anonymous User Experience

**No Barriers to Entry:**
- Zero registration required
- No login screens for citizens
- No user accounts or profiles
- No email verification
- No password management
- Instant issue reporting

**Tracking Without Accounts:**
- Bookmark tracking URLs in browser
- Save tracking codes in notes app
- Share tracking codes via messaging apps
- Print QR codes for physical reference
- Multiple issue tracking via saved codes

**Privacy-First Design:**
- No user data collection
- No behavioral tracking
- No cookies for citizens
- No analytics on individuals
- Complete anonymity guaranteed

**Optional Contact for Convenience:**
- Provide phone/email only if you want notifications
- Contact info used solely for notifications
- Hashed and secured
- Can be omitted entirely
- No account creation even with contact info

This approach maximizes accessibility and privacy while maintaining full functionality.
