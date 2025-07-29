# Tamyla Auth Service Deployment Guide

This guide explains how to deploy and test the Tamyla Auth Service using Cloudflare Workers and D1 database.

## Prerequisites

- Node.js 18+
- Cloudflare account with Workers and D1 enabled
- Wrangler CLI (`npm install -g wrangler@latest`)
- Git (for version control)

## Local Development

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   Create or update `.dev.vars` file in the project root:
   ```env
   # Environment
   NODE_ENV=development
   
   # Server Configuration
   PORT=3002
   
   # JWT Configuration
   JWT_SECRET=your-secure-jwt-secret-minimum-32-characters
   MAGIC_LINK_EXPIRY_MINUTES=15
   
   # D1 Database (for local development)
   DB={
     "binding": "DB",
     "type": "D1",
     "database_id": "local-dev-db"
   }
   ```

3. **Start Development Server**
   ```bash
   wrangler dev
   ```

4. **Run Tests**
   ```bash
   node test-d1-worker.js
   ```

## Local Production Testing

Before deploying to production, you can test your production configuration locally using Wrangler's production simulation mode.

### 1. Set Up Production Environment

1. Create or update `.dev.vars` with production-like settings:
   ```bash
   # .dev.vars
   NODE_ENV=production
   JWT_SECRET=your-secure-jwt-secret
   MAGIC_LINK_EXPIRY_MINUTES=15
   ```

2. Start the local production server:
   ```bash
   npm run dev:prod
   ```
   This starts the worker in production mode but runs it locally.

### 2. Run Production Tests

1. In a new terminal, run the production test suite:
   ```bash
   npm run test:prod
   ```

2. The test script will verify:
   - Health check endpoint
   - Magic link request flow
   - Authentication flow

### 3. Manual Testing

You can also test the API manually using curl or Postman:

```bash
# Health check
curl http://localhost:3002/health

# Request magic link
curl -X POST http://localhost:3002/api/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "name": "Test User"}'
```

## Production Deployment

### 1. Prerequisites

1. Login to Cloudflare:
   ```bash
   wrangler login
   ```

2. Create a new D1 database (if not already created):
   ```bash
   wrangler d1 create tamyla-auth-db
   ```
   
   This will output a database ID. Update the `database_id` in `wrangler.toml` with this ID.

### 2. Configure Production

1. Update `wrangler.toml` with your production settings:
   - Update `route` with your production domain
   - Verify D1 database binding
   - Set appropriate environment variables

2. Set production secrets:
   ```bash
   # Set JWT secret
   wrangler secret put JWT_SECRET
   
   # Set any other required secrets
   wrangler secret put MAGIC_LINK_EXPIRY_MINUTES
   ```

### 3. Run Database Migrations

1. Create database tables (if not already created):
   ```bash
   # Run the test script which initializes the database
   node test-d1-worker.js
   ```

   Or manually run the initialization SQL:
   ```sql
   -- Create users table
   CREATE TABLE IF NOT EXISTS users (
     id TEXT PRIMARY KEY,
     email TEXT UNIQUE NOT NULL,
     name TEXT,
     created_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL
   );
   
   -- Create magic_links table
   CREATE TABLE IF NOT EXISTS magic_links (
     token TEXT PRIMARY KEY,
     user_id TEXT NOT NULL,
     email TEXT NOT NULL,
     expires_at INTEGER NOT NULL,
     used INTEGER DEFAULT 0,
     created_at INTEGER NOT NULL,
     FOREIGN KEY (user_id) REFERENCES users(id)
   );
   ```

### 4. Deploy to Production

1. Deploy the worker:
   ```bash
   wrangler deploy --env production
   ```

2. Verify deployment:
   ```bash
   # Check worker status
   wrangler deployment list
   
   # View logs
   wrangler tail
   ```
```

## Verifying the Deployment

1. **Check Health**
   ```bash
   curl https://mongodb-worker.<your-subdomain>.workers.dev/health
   ```

2. **Run Tests Against Production**
   ```bash
   MONGODB_WORKER_URL=https://mongodb-worker.<your-subdomain>.workers.dev \
   MONGODB_WORKER_API_KEY=your-api-key \
   node test-mongodb-worker.js
   ```

## Monitoring and Logs

View logs in the Cloudflare Workers dashboard or via CLI:

```bash
wrangler tail
```

## Updating the Worker

1. Make your changes
2. Test locally
3. Deploy updates:
   ```bash
   wrangler deploy
   ```

## Rollback

To rollback to a previous version:

```bash
wrangler rollback --message "Rollback to previous version"
```

## Security Considerations

- Always use HTTPS in production
- Rotate API keys and secrets regularly
- Monitor usage and set up alerts for suspicious activity
- Keep dependencies up to date
- Use the principle of least privilege for database access
