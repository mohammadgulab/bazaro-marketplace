const request = require('supertest');
const { openDb } = require('../src/db');
const { createApp } = require('../src/app');
const { seed } = require('../src/seed');

// Fresh in-memory shop for each test file.
function makeShop() {
  const db = openDb(':memory:');
  seed(db);
  const app = createApp(db);
  const api = request(app);
  const login = async (email, password) => (await api.post('/api/auth/login').send({ email, password })).body.token;
  return { db, app, api, login };
}

module.exports = { makeShop };
