# CivicLemma - Requirements Specification

## 1. Project Overview

CivicLemma is a civic engagement platform designed for India that empowers citizens to report local infrastructure issues through photo uploads. The platform leverages AI for automatic issue classification and intelligent routing to appropriate municipal authorities.

## 2. Functional Requirements

### 2.1 User Management

#### 2.1.1 Fully Anonymous Citizen Access
- All citizens must be able to report issues without any registration or login
- System must NOT require or collect user accounts for citizens
- Each issue submission must generate a unique tracking code
- No user authentication required for issue reporting or tracking
- Citizens remain completely anonymous throughout the process

#### 2.1.2 Administrative User Support
- Two privileged user roles must be supported (authentication required):
  - `MUNICIPALITY_USER` - Municipal staff for issue management
  - `PLATFORM_MAINTAINER` - Administrative access to all features
- Only administrative users require Cognito Authentication
- Administrative access must be protected with secure login

#### 2.1.3 Administrative Dashboards
- Municipality users must be able to view issues assigned to their jurisdiction
- Municipality users must be able to update issue status and add responses
- Platform maintainers must have full system access and analytics
- Administrative users must have role-based permissions

#### 2.1.4 Privacy & Data Protection
- System must NOT collect any personally identifiable information from citizens
- No user accounts, profiles, or authentication for public users
- System must comply with data minimization principles
- IP addresses must be anonymized or not stored
- Location data must be limited to issue location only (no user tracking)
- No cookies or tracking mechanisms for citizens
- Full GDPR compliance with anonymous-by-design approach

### 2.2 Issue Reporting

#### 2.2.1 Issue Submission
- Citizens must be able to report issues by uploading photos without login
- System must support the following issue types:
  - Pothole
  - Garbage accumulation
  - Illegal parking
  - Damaged road signs
  - Fallen trees
  - Vandalism
  - Dead animals
  - Damaged concrete
  - Damaged electrical infrastructure
- Users must be able to add location information (GPS coordinates or address)
- Users must be able to provide optional text descriptions
- System must generate a unique tracking code immediately after submission
- Tracking code must be displayed prominently and optionally sent via SMS/email
- Users must be able to bookmark or save tracking URLs for later reference

#### 2.2.2 Image Processing
- System must upload images to S3 for storage
- Images must be processed by ML service for automatic classification
- System must generate AI-powered descriptions using AWS Bedrock

### 2.3 AI Classification System

#### 2.3.1 Machine Learning Service
- System must use TensorFlow MobileNetV2 for image classification
- ML model must classify images into one of 9 issue categories
- Classification confidence scores must be provided
- System must handle misclassifications gracefully

#### 2.3.2 AI Description Generation
- System must generate contextual descriptions using AWS Bedrock
- Descriptions must be relevant to the classified issue type
- Descriptions must be in user-friendly language

### 2.4 Issue Management

#### 2.4.1 Issue Tracking
- All issues must be stored in Amazon DynamoDB
- Each issue must have a unique identifier
- Issues must track status: OPEN, IN_PROGRESS, RESOLVED, CLOSED
- Issues must be timestamped (creation, updates, resolution)

#### 2.4.2 Municipality Dashboard
- Municipality users must be able to view issues in their jurisdiction
- Municipality users must be able to update issue status
- Municipality users must be able to add response comments
- Municipality users must be able to close resolved issues

#### 2.4.3 Public Issue Tracking
- Citizens must be able to track individual issues via tracking code
- System must provide a public tracking page accessible without any login
- Citizens must optionally receive notifications on issue status changes (via SMS/email if provided)
- Citizens must be able to view issue resolution details publicly
- No user dashboard or account required for citizens
- Citizens can bookmark tracking URLs for easy access to their reported issues

### 2.5 AI Agent Interface

#### 2.5.1 Chat Agent
- System must provide a conversational AI interface
- Users must be able to query issue status via chat
- Agent must provide information about nearby issues
- Agent must support natural language queries

#### 2.5.2 Voice Agent
- System must support voice-based interactions
- Voice agent must use AWS Bedrock
- Voice input must be transcribed and processed
- Responses must be provided in both text and audio formats

#### 2.5.3 Priority Scoring
- System must automatically assign priority scores to issues
- Priority must be based on issue type, location, and severity
- High-priority issues must be flagged for immediate attention

### 2.6 Telegram Bot Integration

#### 2.6.1 Bot Functionality
- Users must be able to report issues via Telegram
- Bot must support photo uploads
- Bot must provide issue status updates
- Bot must support basic commands for issue tracking

### 2.7 Notifications

- Citizens must optionally receive notifications if they provide:
  - Phone number (SMS notifications)
  - Email address (email notifications)
- Notification events include:
  - Issue status changes
  - Municipality responses
  - Issue resolution
  - Community milestones (e.g., 10 upvotes)
- Municipality users must receive notifications for new issues in their area
- Public status page must always be available for tracking without notifications
- No account or login required for notification preferences

### 2.8 Features for Anonymous Model

#### 2.8.1 Issue Tracking System
- System must generate short, memorable tracking codes (e.g., ABC-1234)
- Tracking codes must be shareable via URL, QR code, or text
- Public tracking page must show issue status without authentication
- System must support bulk tracking (multiple codes at once)

#### 2.8.2 Community Engagement
- Users must be able to upvote existing issues without login
- System must show number of citizens affected by similar issues
- Users must be able to add supporting photos to existing issues
- Duplicate issue detection must suggest existing reports

#### 2.8.3 Transparency Features
- Public dashboard must show municipality response times
- System must display resolution statistics by area
- Trending issues must be highlighted on homepage
- Success stories must be showcased to encourage participation

#### 2.8.4 Gamification (Optional)
- System may award badges for issue resolution
- Leaderboard for most responsive municipalities
- Community impact metrics (issues resolved, response time improvements)

#### 2.8.5 Offline Support
- Progressive Web App (PWA) for offline issue submission
- Queue reports when offline, submit when connection restored
- Offline map caching for location selection
- Local storage for tracking codes (no account needed)

#### 2.8.6 Accessibility Enhancements
- Voice-based issue reporting for users with disabilities
- Multi-language support (Hindi, English, regional languages)
- Simple SMS-based reporting for feature phone users
- WhatsApp bot integration as alternative to Telegram
- All features accessible without any registration

#### 2.8.7 Citizen Empowerment Without Accounts
- Bookmark tracking URLs for easy access
- Share tracking codes via social media
- Print QR codes for physical distribution
- Multiple issue tracking via saved tracking codes
- No login barrier for any citizen-facing feature

## 3. Non-Functional Requirements

### 3.1 Performance
- Image classification must complete within 5 seconds
- API response time must be under 2 seconds for standard queries
- System must support concurrent users (minimum 100 simultaneous users)
- Frontend must achieve Lighthouse performance score > 80

### 3.2 Security
- Public API endpoints must implement rate limiting to prevent abuse
- Administrative endpoints must be protected with Cognito authentication
- Administrative passwords must be securely hashed
- Service account keys must not be committed to version control
- API requests must use HTTPS in production
- Role-based access control must be enforced for administrative operations
- Anonymous submissions must be protected against spam with:
  - CAPTCHA or reCAPTCHA verification
  - Rate limiting per IP address
  - Image validation to prevent inappropriate content
  - Duplicate submission detection
  - Content moderation for uploaded images
- No authentication required for any citizen-facing features

### 3.3 Scalability
- System must handle increasing number of issue reports
- Database queries must be optimized with proper indexing
- Image storage must scale with S3 and CloudFront CDN
- ML service must support horizontal scaling

### 3.4 Reliability
- System uptime must be 99.5% or higher
- Failed image uploads must be retryable
- ML classification failures must fallback to manual classification
- Data must be backed up regularly

### 3.5 Usability
- Interface must be mobile-responsive
- UI must follow accessibility guidelines (WCAG 2.1 Level AA target)
- Error messages must be user-friendly
- Loading states must be clearly indicated

### 3.6 Maintainability
- Code must follow TypeScript best practices
- API must use Zod for runtime validation
- Issue types must be synchronized across all services
- Comprehensive logging must be implemented

### 3.7 Compatibility
- Frontend must support modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile support for iOS and Android devices
- Telegram bot must work on all Telegram clients

## 4. Technical Requirements

### 4.1 Frontend Stack
- Next.js 16 with App Router
- React 18
- TailwindCSS 4 for styling
- Radix UI for component primitives
- TypeScript for type safety

### 4.2 Backend Stack
- Express.js with TypeScript
- AWS SDK for DynamoDB, S3, Cognito
- Zod for validation
- Node.js runtime

### 4.3 ML Service Stack
- FastAPI framework
- TensorFlow with MobileNetV2
- AWS Bedrock for AI descriptions
- Python 3.9+

### 4.4 Agent Service Stack
- FastAPI framework
- AWS Bedrock
- Python 3.9+
- Telegram Bot API

### 4.5 Infrastructure
- Amazon DynamoDB for database
- Amazon Cognito for user management
- Amazon S3 + CloudFront for image storage and CDN
- Environment-based configuration

## 5. Data Requirements

### 5.1 Data Storage
- User profiles and authentication data in Cognito
- Issue reports in DynamoDB with proper indexing
- Images stored in S3 with CloudFront CDN delivery
- ML model files stored locally in ml/models/

### 5.2 Data Validation
- All API inputs must be validated using Zod schemas
- Image uploads must validate file type and size
- Location coordinates must be validated for Indian geography
- Optional contact information (phone/email) must be validated
- Tracking codes must be unique and collision-resistant

### 5.4 Data Retention
- Issue reports must be retained for minimum 2 years for transparency
- Optional contact information must be deleted after issue resolution
- Citizens can request data deletion via tracking code
- Audit logs must be maintained for administrative actions only
- No user account data to retain (fully anonymous system)

### 5.3 Data Synchronization
- Issue type enums must be synchronized across:
  - server/src/shared/types.ts
  - server/src/shared/validation.ts
  - ml/main.py

## 6. Integration Requirements

### 6.1 External Services
- Amazon Cognito and DynamoDB
- Amazon S3 + CloudFront for image management
- AWS Bedrock for AI descriptions
- AWS Bedrock for agent services
- Telegram Bot API

### 6.2 API Design
- RESTful API architecture
- JSON request/response format
- Proper HTTP status codes
- Consistent error response structure

## 7. Development Requirements

### 7.1 Development Environment
- Node.js for client and server
- Python virtual environments for ML and agent services
- Environment variables for configuration
- Git for version control

### 7.2 Testing
- TypeScript type checking for client and server
- ESLint for code quality
- Manual testing for ML classification accuracy
- Integration testing for API endpoints

### 7.3 Documentation
- API endpoint documentation
- Setup instructions for all services
- Architecture documentation
- Code comments for complex logic

## 8. Deployment Requirements

### 8.1 Production Setup
- Separate build processes for each service
- Environment-specific configuration
- AWS credentials and IAM setup
- API key management for external services

### 8.2 Monitoring
- Error logging and tracking
- Performance monitoring
- API usage analytics
- ML classification accuracy tracking

## 9. Implemented Enhancements for Fully Anonymous Model

- 100% anonymous issue reporting - no registration ever required
- Unique tracking codes for each issue (shareable and memorable)
- Public issue tracking page accessible to everyone
- Optional contact information for notifications only
- Community upvoting and engagement without accounts
- AI-powered duplicate issue detection
- Public transparency dashboard showing municipality performance
- SMS/WhatsApp integration for accessibility
- No user accounts, profiles, or authentication for citizens
- Privacy-first design with data minimization
- Bookmark-based issue tracking (no login needed)
- QR code generation for easy sharing

## 10. Future Enhancements (Out of Scope for v1)

- Mobile native applications (iOS/Android)
- Real-time issue tracking on interactive maps
- Integration with government databases and APIs
- Advanced analytics dashboard with predictive insights
- Automated issue verification using computer vision
- Blockchain-based transparency and audit trail
- Integration with municipal ERP systems
- Crowdsourced issue validation
- Reward system for active community members
- AI-powered issue clustering and pattern detection
