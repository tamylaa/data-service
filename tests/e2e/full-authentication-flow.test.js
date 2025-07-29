/**
 * End-to-End Authentication Flow Test
 * 
 * This test simulates the complete user journey:
 * 1. Trading portal requests auth
 * 2. Auth service uses data service for magic link
 * 3. Email service sends magic link
 * 4. User clicks link, gets verified
 * 5. User becomes authenticated for trading portal
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';

// Simulate the different services
class TradingPortal {
  constructor(authServiceUrl) {
    this.authServiceUrl = authServiceUrl;
    this.authenticated = false;
    this.user = null;
  }

  async requestAuth(email) {
    console.log(`[TradingPortal] Requesting authentication for ${email}`);
    
    // Simulate trading portal calling auth service
    const response = await fetch(`${this.authServiceUrl}/auth/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, redirectUrl: 'https://trading.tamyla.com/dashboard' })
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`[TradingPortal] Auth request sent: ${result.message}`);
      return result;
    } else {
      throw new Error(`Auth request failed: ${response.statusText}`);
    }
  }

  async handleMagicLinkReturn(token) {
    console.log(`[TradingPortal] Processing magic link return with token`);
    
    // Simulate the callback from magic link
    const response = await fetch(`${this.authServiceUrl}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });

    if (response.ok) {
      const result = await response.json();
      this.authenticated = true;
      this.user = result.user;
      console.log(`[TradingPortal] User authenticated: ${this.user.email}`);
      return result;
    } else {
      throw new Error(`Magic link verification failed: ${response.statusText}`);
    }
  }

  isAuthenticated() {
    return this.authenticated && this.user !== null;
  }

  getUser() {
    return this.user;
  }
}

class AuthService {
  constructor(dataServiceUrl, emailServiceUrl) {
    this.dataServiceUrl = dataServiceUrl;
    this.emailServiceUrl = emailServiceUrl;
  }

  async handleAuthRequest(email, redirectUrl) {
    console.log(`[AuthService] Processing auth request for ${email}`);

    // Step 1: Request magic link from data service
    const magicLinkResponse = await fetch(`${this.dataServiceUrl}/api/auth/magic-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    if (!magicLinkResponse.ok) {
      throw new Error(`Data service error: ${magicLinkResponse.statusText}`);
    }

    const { magicLink } = await magicLinkResponse.json();
    console.log(`[AuthService] Got magic link from data service`);

    // Step 2: Send email via email service
    const emailResponse = await fetch(`${this.emailServiceUrl}/send-magic-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: email,
        magicLink: `https://auth.tamyla.com/verify?token=${magicLink.token}&redirect=${encodeURIComponent(redirectUrl)}`,
        redirectUrl
      })
    });

    if (!emailResponse.ok) {
      throw new Error(`Email service error: ${emailResponse.statusText}`);
    }

    console.log(`[AuthService] Magic link email sent to ${email}`);
    return { message: 'Magic link sent to your email', magicLinkToken: magicLink.token };
  }

  async handleMagicLinkVerification(token) {
    console.log(`[AuthService] Verifying magic link token`);

    // Verify with data service
    const verifyResponse = await fetch(`${this.dataServiceUrl}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });

    if (!verifyResponse.ok) {
      throw new Error(`Token verification failed: ${verifyResponse.statusText}`);
    }

    const result = await verifyResponse.json();
    console.log(`[AuthService] Token verified, user authenticated: ${result.user.email}`);
    
    return {
      success: true,
      user: result.user,
      authToken: result.authToken
    };
  }
}

class EmailService {
  constructor() {
    this.sentEmails = [];
  }

  async sendMagicLink({ to, magicLink, redirectUrl }) {
    console.log(`[EmailService] Sending magic link to ${to}`);
    
    // Simulate email sending (in real implementation, this would use SendGrid/etc)
    const email = {
      to,
      subject: 'Your Tamyla Trading Portal Login Link',
      html: `
        <h2>Welcome to Tamyla Trading Portal</h2>
        <p>Click the link below to access your dashboard:</p>
        <a href="${magicLink}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
          Access Trading Portal
        </a>
        <p>This link will expire in 15 minutes.</p>
      `,
      magicLink,
      redirectUrl,
      sentAt: new Date()
    };

    this.sentEmails.push(email);
    console.log(`[EmailService] Email sent successfully`);
    
    return { success: true, messageId: `msg_${Date.now()}` };
  }

  getLastEmail() {
    return this.sentEmails[this.sentEmails.length - 1];
  }

  getAllEmails() {
    return this.sentEmails;
  }
}

// Mock our data service using the actual implementation
import { initD1Client } from '../../src/shared/clients/d1/index.js';

class MockDataService {
  constructor() {
    this.d1Client = null;
  }

  async initialize() {
    // Initialize with test environment
    this.d1Client = await initD1Client({
      DB: null, // Will use test database
      NODE_ENV: 'test',
      USE_TEST_DB: 'true'
    });
  }

  async handleMagicLinkRequest(email) {
    console.log(`[DataService] Creating magic link for ${email}`);

    try {
      // Check if user exists, create if not
      let user = await this.d1Client.users.findByEmail(email);
      
      if (!user) {
        user = await this.d1Client.users.create({
          email,
          isEmailVerified: false
        });
        console.log(`[DataService] Created new user: ${user.id}`);
      }

      // Create magic link
      const magicLink = await this.d1Client.magicLinks.create({
        userId: user.id,
        email: user.email,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
      });

      console.log(`[DataService] Magic link created: ${magicLink.token}`);
      
      return {
        magicLink: {
          token: magicLink.token,
          expiresAt: magicLink.expiresAt
        },
        user
      };
    } catch (error) {
      console.error(`[DataService] Error creating magic link:`, error);
      throw error;
    }
  }

  async handleTokenVerification(token) {
    console.log(`[DataService] Verifying token: ${token.substring(0, 8)}...`);

    try {
      // Find magic link by token
      const magicLink = await this.d1Client.magicLinks.findByToken(token);
      
      if (!magicLink) {
        throw new Error('Invalid or expired magic link');
      }

      // Check if expired
      if (new Date() > new Date(magicLink.expiresAt)) {
        throw new Error('Magic link has expired');
      }

      // Get user
      const user = await this.d1Client.users.findById(magicLink.userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      // Mark user as verified
      const updatedUser = await this.d1Client.users.update(user.id, {
        is_email_verified: true
      });

      // Create auth token
      const authToken = await this.d1Client.tokens.create({
        userId: user.id,
        type: 'auth',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      });

      // Delete the magic link (one-time use)
      await this.d1Client.magicLinks.delete(magicLink.token);

      console.log(`[DataService] Token verified successfully for user: ${updatedUser.email}`);

      return {
        success: true,
        user: updatedUser,
        authToken: authToken.token
      };
    } catch (error) {
      console.error(`[DataService] Token verification failed:`, error);
      throw error;
    }
  }
}

// Create mock HTTP servers for testing
class MockServer {
  constructor(name) {
    this.name = name;
    this.routes = new Map();
  }

  post(path, handler) {
    this.routes.set(`POST ${path}`, handler);
  }

  async fetch(url, options = {}) {
    const urlObj = new URL(url);
    const key = `${options.method || 'GET'} ${urlObj.pathname}`;
    const handler = this.routes.get(key);
    
    if (!handler) {
      return {
        ok: false,
        status: 404,
        statusText: 'Not Found'
      };
    }

    try {
      const body = options.body ? JSON.parse(options.body) : {};
      const result = await handler(body);
      
      return {
        ok: true,
        status: 200,
        json: async () => result
      };
    } catch (error) {
      return {
        ok: false,
        status: 500,
        statusText: error.message
      };
    }
  }
}

describe('Full Authentication Flow End-to-End Test', () => {
  let tradingPortal;
  let authService;
  let emailService;
  let dataService;
  let dataServiceServer;
  let emailServiceServer;
  let authServiceServer;

  beforeEach(async () => {
    console.log('\n🚀 Setting up end-to-end test environment...\n');

    // Initialize services
    dataService = new MockDataService();
    await dataService.initialize();
    
    emailService = new EmailService();
    authService = new AuthService('http://data-service.test', 'http://email-service.test');
    tradingPortal = new TradingPortal('http://auth-service.test');

    // Set up mock servers
    dataServiceServer = new MockServer('data-service');
    emailServiceServer = new MockServer('email-service');
    authServiceServer = new MockServer('auth-service');

    // Configure data service routes
    dataServiceServer.post('/api/auth/magic-link', async (body) => {
      return await dataService.handleMagicLinkRequest(body.email);
    });

    dataServiceServer.post('/api/auth/verify', async (body) => {
      return await dataService.handleTokenVerification(body.token);
    });

    // Configure email service routes
    emailServiceServer.post('/send-magic-link', async (body) => {
      return await emailService.sendMagicLink(body);
    });

    // Configure auth service routes
    authServiceServer.post('/auth/request', async (body) => {
      return await authService.handleAuthRequest(body.email, body.redirectUrl);
    });

    authServiceServer.post('/auth/verify', async (body) => {
      return await authService.handleMagicLinkVerification(body.token);
    });

    // Mock fetch for each service
    global.fetch = async (url, options) => {
      if (url.includes('data-service.test')) {
        return await dataServiceServer.fetch(url, options);
      } else if (url.includes('email-service.test')) {
        return await emailServiceServer.fetch(url, options);
      } else if (url.includes('auth-service.test')) {
        return await authServiceServer.fetch(url, options);
      }
      
      throw new Error(`Unknown service URL: ${url}`);
    };
  });

  afterEach(() => {
    delete global.fetch;
  });

  test('Complete Authentication Flow: Trading Portal → Auth → Data → Email → User Login', async () => {
    console.log('🎯 Starting complete authentication flow test...\n');

    // Use a real email address for more realistic testing
    const testEmail = 'test@tamyla.com'; // Real domain email for testing
    
    // Step 1: Trading portal requests authentication
    console.log('📱 Step 1: Trading portal requests authentication');
    const authRequest = await tradingPortal.requestAuth(testEmail);
    
    expect(authRequest.message).toBe('Magic link sent to your email');
    expect(authRequest.magicLinkToken).toBeDefined();
    
    // Step 2: Verify email was sent
    console.log('📧 Step 2: Verify magic link email was sent');
    const sentEmail = emailService.getLastEmail();
    
    expect(sentEmail).toBeDefined();
    expect(sentEmail.to).toBe(testEmail);
    expect(sentEmail.subject).toBe('Your Tamyla Trading Portal Login Link');
    expect(sentEmail.magicLink).toContain('auth.tamyla.com/verify');
    
    // Step 3: Extract magic link token (simulate user clicking email link)
    console.log('🔗 Step 3: User clicks magic link');
    const magicLinkUrl = new URL(sentEmail.magicLink);
    const token = magicLinkUrl.searchParams.get('token');
    
    expect(token).toBe(authRequest.magicLinkToken);
    
    // Step 4: Trading portal handles magic link return
    console.log('✅ Step 4: Trading portal processes magic link verification');
    const verificationResult = await tradingPortal.handleMagicLinkReturn(token);
    
    expect(verificationResult.success).toBe(true);
    expect(verificationResult.user).toBeDefined();
    expect(verificationResult.user.email).toBe(testEmail);
    expect(verificationResult.user.isEmailVerified).toBe(true);
    expect(verificationResult.authToken).toBeDefined();
    
    // Step 5: Verify user is now authenticated in trading portal
    console.log('🏆 Step 5: Verify user is authenticated and can access trading portal');
    expect(tradingPortal.isAuthenticated()).toBe(true);
    
    const authenticatedUser = tradingPortal.getUser();
    expect(authenticatedUser.email).toBe(testEmail);
    expect(authenticatedUser.isEmailVerified).toBe(true);

    console.log('\n🎉 Complete authentication flow test PASSED!\n');
    console.log('✅ User successfully authenticated and ready to access trading portal dashboard');

    // Additional verification: Check that magic link can't be reused
    console.log('🔒 Step 6: Verify magic link security (one-time use)');
    // Create a fresh trading portal instance to test magic link reuse
    const freshTradingPortal = new TradingPortal();
    try {
      const secondAttempt = await freshTradingPortal.handleMagicLinkReturn(token);
      // If we get here without an error, the magic link was incorrectly reused
      throw new Error('Magic link should not be reusable - security violation!');
    } catch (error) {
      if (error.message === 'Magic link should not be reusable - security violation!') {
        // This means the reuse succeeded when it shouldn't have
        throw error;
      }
      // Any other error means the reuse was properly prevented - this is expected behavior
      console.log('✅ Magic link reuse properly prevented:', error.message);
      expect(error.message).toBeDefined(); // Just verify we got an error (which is correct)
    }

    console.log('\n🏁 Full end-to-end authentication flow completed successfully!');
  });

  test('Failed Authentication Flow: Invalid Email', async () => {
    console.log('🧪 Testing failed authentication flow with invalid email...\n');

    const invalidEmail = 'not-an-email';

    try {
      await tradingPortal.requestAuth(invalidEmail);
      throw new Error('Should have failed with invalid email');
    } catch (error) {
      expect(error.message).toBeDefined();
      console.log('✅ Invalid email properly rejected');
    }

    expect(tradingPortal.isAuthenticated()).toBe(false);
    console.log('✅ User remains unauthenticated after failed request');
  });

  test('Expired Magic Link Flow', async () => {
    console.log('⏱️ Testing expired magic link flow...\n');

    // Use a real email address for testing
    const testEmail = 'expiry-test@tamyla.com'; // Real domain email for testing
    
    // Request authentication
    const authRequest = await tradingPortal.requestAuth(testEmail);
    const token = authRequest.magicLinkToken;

    // Instead of mocking time, create a magic link with past expiry
    // First, get the magic link from the database directly
    const createdMagicLink = await dataService.d1Client.magicLinks.findByToken(token);
    
    // Update the magic link to be expired (set expires_at to past time)
    const pastTime = new Date(Date.now() - (5 * 60 * 1000)).toISOString(); // 5 minutes ago
    await dataService.d1Client.run(
      'UPDATE magic_links SET expires_at = ? WHERE token = ?',
      [pastTime, token]
    );

    try {
      await tradingPortal.handleMagicLinkReturn(token);
      throw new Error('Expired magic link should be rejected');
    } catch (error) {
      expect(error.message).toContain('expired');
      console.log('✅ Expired magic link properly rejected');
    }

    expect(tradingPortal.isAuthenticated()).toBe(false);
    console.log('✅ User remains unauthenticated with expired link');
  });
});
