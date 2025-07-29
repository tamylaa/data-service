# Tamyla Data Service

A production-ready authentication service built on Cloudflare Workers with D1 database integration. Provides secure magic link authentication, JWT token management, and user management functionality.

## 🎯 Features

- **Magic Link Authentication** - Passwordless authentication via email
- **JWT Token Management** - Secure token generation and verification  
- **User Management** - Registration, verification, and profile management
- **D1 Database Integration** - Cloudflare's SQLite-based database
- **Production Ready** - Comprehensive testing, error handling, and deployment automation
- **Real Database Testing** - 7/7 passing tests with SQLite compatibility

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Cloudflare account with Workers and D1 enabled
- Wrangler CLI (`npm install -g wrangler@latest`)

### Installation

```bash
# Clone and install
git clone <repository-url>
cd data-service
npm install

# Configure environment
cp .env.example .dev.vars
# Edit .dev.vars with your configuration

# Run deployment readiness check
npm run check:deployment

# Start development server
npm run dev
```

### Environment Configuration

Create `.dev.vars` file:

```env
# Environment
NODE_ENV=development

# JWT Configuration  
JWT_SECRET=your-secure-jwt-secret-minimum-32-characters-for-security

# Frontend Configuration
FRONTEND_URL=http://localhost:3000

# Magic Link Configuration
MAGIC_LINK_EXPIRY_MINUTES=15

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

## 📡 API Endpoints

### Authentication

#### Request Magic Link
```http
POST /auth/magic-link
Content-Type: application/json

{
  "email": "user@example.com",
  "name": "User Name"
}
```

#### Verify Magic Link
```http
POST /auth/magic-link/verify
Content-Type: application/json

{
  "token": "magic-link-token"
}
```

#### Get Current User
```http
GET /auth/me
Authorization: Bearer <jwt-token>
```

### System

#### Health Check
```http
GET /health
```

#### User Registration (Alternative)
```http
POST /register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password",
  "name": "User Name"
}
```

## 🧪 Testing

### Unit Tests
```bash
# Run core database tests (7/7 passing)
npm test

# Run specific test suite
npm test tests/d1/BaseD1Client.test.js
```

### Live Endpoint Testing
```bash
# Test against local development server
npm run test:endpoints

# Test against staging
npm run test:endpoints:staging

# Test against production
npm run test:endpoints:prod
```

### Deployment Readiness Check
```bash
# Check development readiness
npm run check:deployment

# Check staging deployment readiness
npm run check:deployment:staging

# Check production deployment readiness
npm run check:deployment:prod
```

## 🚀 Deployment

### Development
```bash
# Start local development server
npm run dev

# Access at http://localhost:8787
```

### Staging
```bash
# Deploy to staging
npm run deploy:staging

# Run deployment check and deploy if ready
npm run check:deployment:staging
```

### Production
```bash
# Deploy to production
npm run deploy:prod

# Full deployment readiness check with auto-deploy
npm run deploy:ready -Environment prod
```

## 🗃️ Database Schema

### Users Table
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  is_email_verified INTEGER DEFAULT 0,
  last_login TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### Magic Links Table  
```sql
CREATE TABLE magic_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  is_used INTEGER DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
```

### Database Migrations

```bash
# Apply initial migration to production
wrangler d1 execute tamyla-auth-prod --file=./migrations/001_initial.sql

# Apply to local development
wrangler d1 execute tamyla-auth-db-local --file=./migrations/001_initial.sql
```

## 🏗️ Project Structure

```
data-service/
├── src/
│   ├── worker/
│   │   ├── index.js              # Main worker entry point
│   │   ├── handlers/
│   │   │   ├── auth.js           # Authentication endpoints
│   │   │   ├── users.js          # User management
│   │   │   └── health.js         # Health check
│   │   └── utils/
│   │       ├── response.js       # Response utilities
│   │       ├── token.js          # JWT utilities
│   │       └── env.js            # Environment utilities
│   └── shared/
│       └── clients/
│           └── d1/
│               ├── BaseD1Client.js    # Database client (250 lines)
│               └── index.js           # Client initialization
├── tests/
│   ├── d1/
│   │   └── BaseD1Client.test.js      # Core tests (7/7 passing)
│   ├── helpers/
│   │   ├── d1.js                     # Test database wrapper
│   │   └── config.js                 # Test configuration
│   └── setup/
│       └── jest.setup.js             # Jest configuration
├── migrations/
│   └── 001_initial.sql               # Production schema
├── wrangler.toml                     # Cloudflare Workers config
├── deployment-readiness-check.ps1    # Deployment automation
├── test-live-endpoints.js            # Live API testing
└── package.json                      # Dependencies and scripts
```

## 🔧 Development Tools

### Deployment Readiness Check
Comprehensive validation script that checks:
- Prerequisites (Node.js, npm, Wrangler)
- Project structure and dependencies
- Database operations and migrations
- API endpoint definitions
- Security configuration
- Production readiness
- Wrangler deployment configuration

```bash
npm run check:deployment
```

### Live Endpoint Testing
Tests all API endpoints against a running service:
- Health check validation
- Magic link request/verification flow
- Authentication and authorization
- Error handling and edge cases

```bash
npm run test:endpoints
```

## 🔒 Security Features

- **JWT Token Security** - Configurable secret with proper expiration
- **Magic Link Expiration** - Configurable timeout (default: 15 minutes)
- **Rate Limiting** - Configurable request limits
- **CORS Configuration** - Proper cross-origin request handling
- **Input Validation** - Email validation and sanitization
- **Error Handling** - Secure error responses without data leakage

## 📊 Monitoring & Logging

- **Health Check Endpoint** - Service status and environment info
- **Structured Logging** - Timestamped logs with context
- **Error Tracking** - Comprehensive error handling and reporting
- **Performance Monitoring** - Database operation timing
- **Deployment Logs** - Detailed deployment and configuration logs

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests (`npm test`)
4. Run deployment check (`npm run check:deployment`)
5. Commit changes (`git commit -m 'Add amazing feature'`)
6. Push to branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## 📝 Scripts Reference

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm test` | Run unit tests |
| `npm run test:endpoints` | Test live API endpoints |
| `npm run check:deployment` | Full deployment readiness check |
| `npm run deploy:staging` | Deploy to staging environment |
| `npm run deploy:prod` | Deploy to production environment |
| `npm run deploy:ready` | Check readiness and deploy |
| `npm run format` | Format code with Prettier |
| `npm run lint` | Lint code with ESLint |

## 🎯 Production Deployment Checklist

- [ ] Environment variables configured in Cloudflare dashboard
- [ ] Database migrations applied (`wrangler d1 execute`)
- [ ] JWT_SECRET set with 32+ character secure value
- [ ] FRONTEND_URL configured for production domain
- [ ] Rate limiting configured appropriately
- [ ] Email service integrated (for production magic links)
- [ ] Monitoring and alerting configured
- [ ] Domain and SSL certificates configured
- [ ] Backup and disaster recovery procedures in place

## 📚 Learn More

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [JWT Best Practices](https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/)

## 📄 License

MIT License - see LICENSE file for details.
