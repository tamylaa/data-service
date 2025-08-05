/**
 * Enhanced Database Schema for Multi-Tenant Architecture
 * This migration extends the existing schema to support multi-tenancy
 */

export const MULTI_TENANT_SCHEMA = [
  // Tenants table - Top-level organizations
  `CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    domain TEXT UNIQUE,
    subscription_tier TEXT DEFAULT 'starter',
    logo_url TEXT,
    theme_config JSON DEFAULT '{}',
    settings JSON DEFAULT '{}',
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  
  // Companies within tenants
  `CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    registration_number TEXT,
    tax_id TEXT,
    website TEXT,
    settings JSON DEFAULT '{}',
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
  )`,
  
  // Locations/Addresses per company
  `CREATE TABLE IF NOT EXISTS locations (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    country TEXT,
    postal_code TEXT,
    phone TEXT,
    email TEXT,
    is_headquarters INTEGER DEFAULT 0,
    timezone TEXT DEFAULT 'UTC',
    settings JSON DEFAULT '{}',
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
  )`,
  
  // Applications per location
  `CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY,
    location_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'web', 'mobile', 'api'
    slug TEXT NOT NULL,
    description TEXT,
    app_url TEXT,
    api_endpoints JSON DEFAULT '[]',
    settings JSON DEFAULT '{}',
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
  )`,
  
  // User-application access control
  `CREATE TABLE IF NOT EXISTS user_applications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    application_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    permissions JSON DEFAULT '{}',
    granted_at TEXT NOT NULL,
    granted_by TEXT,
    last_accessed TEXT,
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id)
  )`,
  
  // Modify existing users table to add tenant context
  `ALTER TABLE users ADD COLUMN tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE`,
  
  // Modify magic_links to be tenant-scoped
  `ALTER TABLE magic_links ADD COLUMN tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE`,
  
  // Create indexes for performance
  `CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug)`,
  `CREATE INDEX IF NOT EXISTS idx_tenants_domain ON tenants(domain)`,
  `CREATE INDEX IF NOT EXISTS idx_companies_tenant ON companies(tenant_id)`,
  `CREATE INDEX IF NOT EXISTS idx_companies_slug ON companies(tenant_id, slug)`,
  `CREATE INDEX IF NOT EXISTS idx_locations_company ON locations(company_id)`,
  `CREATE INDEX IF NOT EXISTS idx_applications_location ON applications(location_id)`,
  `CREATE INDEX IF NOT EXISTS idx_user_applications_user ON user_applications(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_user_applications_app ON user_applications(application_id)`,
  `CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id)`,
  `CREATE INDEX IF NOT EXISTS idx_users_tenant_email ON users(tenant_id, email)`,
  `CREATE INDEX IF NOT EXISTS idx_magic_links_tenant ON magic_links(tenant_id)`,
  
  // Create unique constraints
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_tenant_slug ON companies(tenant_id, slug)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_location_slug ON applications(location_id, slug)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_user_app_access ON user_applications(user_id, application_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tenant_email_unique ON users(tenant_id, email)`,
];

// Default tenant for migration
export const DEFAULT_TENANT = {
  id: 'default-tenant-tamyla',
  name: 'Tamyla Default',
  slug: 'default',
  domain: null,
  subscription_tier: 'enterprise',
  theme_config: '{}',
  settings: '{"migration": true, "legacy": true}',
  is_active: 1
};

// Migration function
export async function migrateToMultiTenant(db) {
  console.log('Starting multi-tenant migration...');
  
  try {
    // Execute schema changes
    for (const sql of MULTI_TENANT_SCHEMA) {
      await db.exec(sql);
    }
    
    // Create default tenant
    await db.prepare(`
      INSERT OR IGNORE INTO tenants (id, name, slug, domain, subscription_tier, settings, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(
      DEFAULT_TENANT.id,
      DEFAULT_TENANT.name,
      DEFAULT_TENANT.slug,
      DEFAULT_TENANT.domain,
      DEFAULT_TENANT.subscription_tier,
      DEFAULT_TENANT.settings,
      DEFAULT_TENANT.is_active
    ).run();
    
    // Migrate existing users to default tenant
    await db.prepare(`
      UPDATE users 
      SET tenant_id = ? 
      WHERE tenant_id IS NULL
    `).bind(DEFAULT_TENANT.id).run();
    
    // Migrate existing magic links to default tenant
    await db.prepare(`
      UPDATE magic_links 
      SET tenant_id = ? 
      WHERE tenant_id IS NULL
    `).bind(DEFAULT_TENANT.id).run();
    
    console.log('Multi-tenant migration completed successfully');
    
    return {
      success: true,
      message: 'Migration completed successfully',
      defaultTenant: DEFAULT_TENANT
    };
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Rollback function (for development)
export async function rollbackMultiTenant(db) {
  console.log('Rolling back multi-tenant migration...');
  
  const rollbackSQL = [
    'DROP INDEX IF EXISTS idx_users_tenant_email_unique',
    'DROP INDEX IF EXISTS idx_user_app_access',
    'DROP INDEX IF EXISTS idx_applications_location_slug',
    'DROP INDEX IF EXISTS idx_companies_tenant_slug',
    'DROP INDEX IF EXISTS idx_magic_links_tenant',
    'DROP INDEX IF EXISTS idx_users_tenant_email',
    'DROP INDEX IF EXISTS idx_users_tenant',
    'DROP INDEX IF EXISTS idx_user_applications_app',
    'DROP INDEX IF EXISTS idx_user_applications_user',
    'DROP INDEX IF EXISTS idx_applications_location',
    'DROP INDEX IF EXISTS idx_locations_company',
    'DROP INDEX IF EXISTS idx_companies_slug',
    'DROP INDEX IF EXISTS idx_companies_tenant',
    'DROP INDEX IF EXISTS idx_tenants_domain',
    'DROP INDEX IF EXISTS idx_tenants_slug',
    'DROP TABLE IF EXISTS user_applications',
    'DROP TABLE IF EXISTS applications',
    'DROP TABLE IF EXISTS locations',
    'DROP TABLE IF EXISTS companies',
    'DROP TABLE IF EXISTS tenants',
    // Note: Cannot drop columns in SQLite, would need to recreate tables
  ];
  
  for (const sql of rollbackSQL) {
    await db.exec(sql);
  }
  
  console.log('Rollback completed');
}
