/**
 * Tenant Model - Multi-Tenant Core Entity
 * Handles tenant (organization) management and operations
 */

import { BaseD1Client } from '../../clients/d1/BaseD1Client.js';
import { v4 as uuidv4 } from 'uuid';

export class TenantModel extends BaseD1Client {
  constructor({ db }) {
    super(db);
    this.tableName = 'tenants';
  }

  /**
   * Create a new tenant
   * @param {Object} tenantData - Tenant data
   * @param {string} tenantData.name - Organization name
   * @param {string} tenantData.slug - URL-safe identifier
   * @param {string} [tenantData.domain] - Custom domain
   * @param {string} [tenantData.subscriptionTier='starter'] - Subscription tier
   * @returns {Promise<Object>} Created tenant
   */
  async create({ name, slug, domain = null, subscriptionTier = 'starter', logoUrl = null, themeConfig = {}, settings = {} }) {
    try {
      const id = uuidv4();
      const now = new Date().toISOString();
      
      // Validate slug is unique
      const existing = await this.findBySlug(slug);
      if (existing) {
        throw new Error(`Tenant with slug '${slug}' already exists`);
      }
      
      // Validate domain is unique if provided
      if (domain) {
        const existingDomain = await this.findByDomain(domain);
        if (existingDomain) {
          throw new Error(`Tenant with domain '${domain}' already exists`);
        }
      }
      
      const result = await this.run(
        `INSERT INTO ${this.tableName} 
         (id, name, slug, domain, subscription_tier, logo_url, theme_config, settings, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, name.trim(), slug.toLowerCase(), domain, subscriptionTier, logoUrl, JSON.stringify(themeConfig), JSON.stringify(settings), now, now]
      );

      if (!result.success) {
        throw new Error('Failed to create tenant');
      }

      return await this.findById(id);
    } catch (error) {
      console.error('[TenantModel] Error creating tenant:', error);
      throw error;
    }
  }

  /**
   * Find tenant by slug
   * @param {string} slug - Tenant slug
   * @returns {Promise<Object|null>} Tenant or null if not found
   */
  async findBySlug(slug) {
    if (!slug) return null;
    
    return await this.first(
      `SELECT * FROM ${this.tableName} WHERE slug = ? AND is_active = 1`,
      [slug.toLowerCase()]
    );
  }

  /**
   * Find tenant by custom domain
   * @param {string} domain - Custom domain
   * @returns {Promise<Object|null>} Tenant or null if not found
   */
  async findByDomain(domain) {
    if (!domain) return null;
    
    return await this.first(
      `SELECT * FROM ${this.tableName} WHERE domain = ? AND is_active = 1`,
      [domain.toLowerCase()]
    );
  }

  /**
   * Find tenant by ID
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Object|null>} Tenant or null if not found
   */
  async findById(tenantId) {
    return await this.first(
      `SELECT * FROM ${this.tableName} WHERE id = ? AND is_active = 1`,
      [tenantId]
    );
  }

  /**
   * Update tenant
   * @param {string} tenantId - Tenant ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated tenant
   */
  async update(tenantId, updates) {
    try {
      const now = new Date().toISOString();
      const allowedFields = ['name', 'domain', 'subscription_tier', 'logo_url', 'theme_config', 'settings'];
      
      const setClause = [];
      const values = [];
      
      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          setClause.push(`${key} = ?`);
          if (key === 'theme_config' || key === 'settings') {
            values.push(JSON.stringify(value));
          } else {
            values.push(value);
          }
        }
      }
      
      if (setClause.length === 0) {
        throw new Error('No valid fields to update');
      }
      
      setClause.push('updated_at = ?');
      values.push(now, tenantId);
      
      const result = await this.run(
        `UPDATE ${this.tableName} SET ${setClause.join(', ')} WHERE id = ?`,
        values
      );
      
      if (!result.success) {
        throw new Error('Failed to update tenant');
      }
      
      return await this.findById(tenantId);
    } catch (error) {
      console.error('[TenantModel] Error updating tenant:', error);
      throw error;
    }
  }

  /**
   * Get all tenants with pagination
   * @param {Object} options - Query options
   * @param {number} [options.limit=50] - Results limit
   * @param {number} [options.offset=0] - Results offset
   * @returns {Promise<Object>} Results with tenants and total count
   */
  async findAll({ limit = 50, offset = 0 } = {}) {
    try {
      const tenants = await this.all(
        `SELECT * FROM ${this.tableName} 
         WHERE is_active = 1 
         ORDER BY created_at DESC 
         LIMIT ? OFFSET ?`,
        [limit, offset]
      );
      
      const countResult = await this.first(
        `SELECT COUNT(*) as total FROM ${this.tableName} WHERE is_active = 1`,
        []
      );
      
      return {
        tenants,
        total: countResult?.total || 0,
        limit,
        offset
      };
    } catch (error) {
      console.error('[TenantModel] Error finding tenants:', error);
      throw error;
    }
  }

  /**
   * Deactivate tenant (soft delete)
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<boolean>} Success status
   */
  async deactivate(tenantId) {
    try {
      const result = await this.run(
        `UPDATE ${this.tableName} SET is_active = 0, updated_at = ? WHERE id = ?`,
        [new Date().toISOString(), tenantId]
      );
      
      return result.success;
    } catch (error) {
      console.error('[TenantModel] Error deactivating tenant:', error);
      throw error;
    }
  }

  /**
   * Get tenant statistics
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Object>} Tenant statistics
   */
  async getStatistics(tenantId) {
    try {
      const [companies, locations, applications, users] = await Promise.all([
        this.first('SELECT COUNT(*) as count FROM companies WHERE tenant_id = ? AND is_active = 1', [tenantId]),
        this.first('SELECT COUNT(*) as count FROM locations WHERE company_id IN (SELECT id FROM companies WHERE tenant_id = ? AND is_active = 1)', [tenantId]),
        this.first('SELECT COUNT(*) as count FROM applications WHERE location_id IN (SELECT id FROM locations WHERE company_id IN (SELECT id FROM companies WHERE tenant_id = ? AND is_active = 1))', [tenantId]),
        this.first('SELECT COUNT(*) as count FROM users WHERE tenant_id = ? AND is_active = 1', [tenantId])
      ]);
      
      return {
        companies: companies?.count || 0,
        locations: locations?.count || 0,
        applications: applications?.count || 0,
        users: users?.count || 0
      };
    } catch (error) {
      console.error('[TenantModel] Error getting tenant statistics:', error);
      throw error;
    }
  }

  /**
   * Validate tenant slug format
   * @param {string} slug - Slug to validate
   * @returns {boolean} Is valid
   */
  static isValidSlug(slug) {
    // Allow letters, numbers, and hyphens, 3-50 characters
    const slugPattern = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;
    return slugPattern.test(slug);
  }

  /**
   * Generate a unique slug from name
   * @param {string} name - Organization name
   * @returns {Promise<string>} Unique slug
   */
  async generateUniqueSlug(name) {
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 40);
    
    let slug = baseSlug;
    let counter = 1;
    
    while (await this.findBySlug(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
    
    return slug;
  }
}
