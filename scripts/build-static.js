// Writes public/catalog.json from the seed catalogue so the static demo
// (GitHub Pages, no server) shows exactly the same products as the API.
const fs = require('fs');
const path = require('path');
const { categories, products } = require('../src/catalog');
const { REVIEW_TEXT } = require('../src/seed');

const reviews = REVIEW_TEXT.map(([author, rating, body]) => ({ author, rating, body, createdAt: '2026-10-20' }));
const out = path.join(__dirname, '..', 'public', 'catalog.json');
fs.writeFileSync(out, JSON.stringify({ categories, products, reviews }));
console.log(`Wrote ${products.length} products to ${path.relative(process.cwd(), out)}`);
