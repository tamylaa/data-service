/**
 * Database Migration: Extend Users for Trading Network
 * Run this to add trader-specific fields to your existing users table
 */

const TRADING_USER_MIGRATION = `
-- Add trader-specific fields to existing users table
ALTER TABLE users ADD COLUMN company_name TEXT;
ALTER TABLE users ADD COLUMN country TEXT;
ALTER TABLE users ADD COLUMN business_type TEXT; -- 'exporter', 'importer', 'both'
ALTER TABLE users ADD COLUMN trade_categories TEXT; -- JSON array
ALTER TABLE users ADD COLUMN verification_status TEXT DEFAULT 'pending';
ALTER TABLE users ADD COLUMN reputation_score INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN company_registration TEXT;
ALTER TABLE users ADD COLUMN contact_phone TEXT;
ALTER TABLE users ADD COLUMN business_address TEXT;
ALTER TABLE users ADD COLUMN website_url TEXT;
ALTER TABLE users ADD COLUMN profile_description TEXT;
ALTER TABLE users ADD COLUMN profile_photo_url TEXT;
ALTER TABLE users ADD COLUMN is_trader BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN trade_verified BOOLEAN DEFAULT FALSE;

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  trader_id TEXT NOT NULL,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  origin_country TEXT,
  certifications TEXT, -- JSON array
  photos TEXT, -- JSON array of URLs
  hs_code TEXT, -- International trade classification
  is_active BOOLEAN DEFAULT TRUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (trader_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Create inventory table (what traders have available or need)
CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY,
  trader_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  type TEXT NOT NULL, -- 'available' (selling) or 'needed' (buying)
  quantity INTEGER NOT NULL,
  unit TEXT NOT NULL, -- 'tons', 'kg', 'containers', etc.
  price_per_unit DECIMAL,
  currency TEXT DEFAULT 'USD',
  available_from DATE,
  valid_until DATE,
  location TEXT, -- Port/warehouse location
  notes TEXT,
  status TEXT DEFAULT 'active', -- 'active', 'reserved', 'sold', 'expired'
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (trader_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
);

-- Create trade opportunities (matches between buyers/sellers)
CREATE TABLE IF NOT EXISTS trade_opportunities (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL,
  buyer_id TEXT,
  product_id TEXT NOT NULL,
  seller_inventory_id TEXT NOT NULL,
  buyer_inventory_id TEXT, -- Optional: if buyer has specific request
  status TEXT DEFAULT 'open', -- 'open', 'interested', 'negotiating', 'agreed', 'completed', 'cancelled'
  match_score INTEGER DEFAULT 0,
  proposed_quantity INTEGER,
  proposed_price DECIMAL,
  proposed_currency TEXT DEFAULT 'USD',
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (seller_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (buyer_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
  FOREIGN KEY (seller_inventory_id) REFERENCES inventory (id) ON DELETE CASCADE,
  FOREIGN KEY (buyer_inventory_id) REFERENCES inventory (id) ON DELETE CASCADE
);

-- Create simple messaging system
CREATE TABLE IF NOT EXISTS trade_messages (
  id TEXT PRIMARY KEY,
  from_trader_id TEXT NOT NULL,
  to_trader_id TEXT NOT NULL,
  opportunity_id TEXT, -- Optional: linked to specific trade
  subject TEXT,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TEXT NOT NULL,
  FOREIGN KEY (from_trader_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (to_trader_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (opportunity_id) REFERENCES trade_opportunities (id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_trader_id ON products (trader_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);
CREATE INDEX IF NOT EXISTS idx_inventory_trader_id ON inventory (trader_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON inventory (product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_type_status ON inventory (type, status);
CREATE INDEX IF NOT EXISTS idx_trade_opportunities_seller ON trade_opportunities (seller_id);
CREATE INDEX IF NOT EXISTS idx_trade_opportunities_buyer ON trade_opportunities (buyer_id);
CREATE INDEX IF NOT EXISTS idx_trade_messages_participants ON trade_messages (from_trader_id, to_trader_id);
`;

/**
 * African Trade Categories
 */
export const AFRICAN_TRADE_CATEGORIES = [
  // Agriculture & Food
  'Coffee',
  'Cocoa',
  'Tea', 
  'Cashews',
  'Shea Butter',
  'Palm Oil',
  'Sesame Seeds',
  'Ginger',
  'Hibiscus',
  'Spices',
  'Dried Fruits',
  'Processed Foods',
  'Grains & Cereals',
  'Nuts & Seeds',
  
  // Textiles & Fashion
  'Cotton',
  'Fabric',
  'Garments',
  'Traditional Textiles',
  'Leather Products',
  'Footwear',
  
  // Natural Resources
  'Timber',
  'Wood Products',
  'Essential Oils',
  'Natural Rubber',
  'Bamboo Products',
  
  // Handicrafts & Art
  'Handicrafts',
  'Traditional Art',
  'Jewelry',
  'Sculptures',
  'Baskets & Weavings',
  
  // Beauty & Cosmetics
  'African Black Soap',
  'Beauty Products',
  'Hair Products',
  'Skincare',
  
  // Technology & Services
  'Software Services',
  'Digital Products',
  'Consulting Services',
  'Educational Services',
  
  // Other
  'Construction Materials',
  'Packaging Materials',
  'Industrial Equipment',
  'Agricultural Equipment'
];

/**
 * African Countries for dropdown
 */
export const AFRICAN_COUNTRIES = [
  'Nigeria', 'Kenya', 'South Africa', 'Ghana', 'Ethiopia',
  'Tanzania', 'Uganda', 'Morocco', 'Algeria', 'Egypt',
  'Senegal', 'Mali', 'Burkina Faso', 'Niger', 'Chad',
  'Cameroon', 'Central African Republic', 'Democratic Republic of Congo',
  'Republic of Congo', 'Gabon', 'Equatorial Guinea',
  'Angola', 'Zambia', 'Zimbabwe', 'Botswana', 'Namibia',
  'Madagascar', 'Mauritius', 'Seychelles', 'Comoros',
  'Djibouti', 'Eritrea', 'Somalia', 'Sudan', 'South Sudan',
  'Libya', 'Tunisia', 'Rwanda', 'Burundi', 'Malawi',
  'Mozambique', 'Swaziland', 'Lesotho', 'Guinea',
  'Guinea-Bissau', 'Sierra Leone', 'Liberia', 'Ivory Coast',
  'Togo', 'Benin', 'Cape Verde', 'Gambia', 'Mauritania'
];

/**
 * Business Types
 */
export const BUSINESS_TYPES = [
  'exporter',
  'importer', 
  'both',
  'manufacturer',
  'distributor',
  'agent',
  'cooperative',
  'processor'
];

/**
 * Common Trade Units
 */
export const TRADE_UNITS = [
  'kg', 'tons', 'metric tons', 'pounds',
  'containers', '20ft container', '40ft container',
  'pieces', 'units', 'dozens',
  'liters', 'gallons', 'barrels',
  'square meters', 'cubic meters',
  'bags', 'sacks', 'boxes', 'pallets'
];

/**
 * Currencies commonly used in African trade
 */
export const TRADE_CURRENCIES = [
  'USD', 'EUR', 'GBP',
  'NGN', 'KES', 'GHS', 'ZAR', 'ETB',
  'XOF', 'XAF', 'MAD', 'EGP'
];

export default TRADING_USER_MIGRATION;
