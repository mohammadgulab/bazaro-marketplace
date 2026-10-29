require('dotenv').config({ quiet: true });

// Central place for settings so the rest of the code never reads process.env directly.
module.exports = {
  port: Number(process.env.PORT) || 3000,
  dbFile: process.env.DB_FILE || './data/bazaro.db',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@bazaro.test',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
  // Shop rules, shared with the storefront through /api/config
  freeShippingFrom: 200,
  shippingFee: 15,
  vatRate: 0.15
};
