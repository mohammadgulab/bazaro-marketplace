const express = require('express');
const { parse, productQuerySchema } = require('../validate');
const { SELECT_PRODUCT, toProduct, SORTS, buildFilters } = require('../products');
const { notFound } = require('../errors');

const router = express.Router();

router.get('/categories', (req, res) => {
  const rows = req.app.locals.db.prepare(`
    SELECT c.slug, c.name, COUNT(p.id) AS count
    FROM categories c LEFT JOIN products p ON p.category_id = c.id
    GROUP BY c.id ORDER BY c.id`).all();
  res.json({ data: rows });
});

// Product listing with search, filters, sorting and paging.
router.get('/products', (req, res) => {
  const q = parse(productQuerySchema, req.query);
  const db = req.app.locals.db;
  const { sql, params } = buildFilters(q);
  const total = db.prepare(`SELECT COUNT(*) AS n FROM products p JOIN categories c ON c.id = p.category_id${sql}`).get(params).n;
  const rows = db.prepare(`${SELECT_PRODUCT}${sql} ORDER BY ${SORTS[q.sort]} LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: q.limit, offset: (q.page - 1) * q.limit });

  // Brands and price range for the filter sidebar, based on the search and category only.
  const base = buildFilters({ q: q.q, category: q.category });
  const brands = db.prepare(`SELECT p.brand AS name, COUNT(*) AS count FROM products p JOIN categories c ON c.id = p.category_id${base.sql} GROUP BY p.brand ORDER BY p.brand`).all(base.params);
  const range = db.prepare(`SELECT MIN(p.price) AS min, MAX(p.price) AS max FROM products p JOIN categories c ON c.id = p.category_id${base.sql}`).get(base.params);

  res.json({ data: rows.map(toProduct), total, page: q.page, limit: q.limit, pages: Math.ceil(total / q.limit), facets: { brands, price: range } });
});

// Quick suggestions for the search box.
router.get('/products/suggest', (req, res) => {
  const term = String(req.query.q || '').trim().slice(0, 60);
  if (term.length < 2) return res.json({ data: [] });
  const rows = req.app.locals.db.prepare(`
    SELECT p.slug, p.name, c.name AS category FROM products p JOIN categories c ON c.id = p.category_id
    WHERE p.name LIKE ? OR p.brand LIKE ? ORDER BY p.reviews_count DESC LIMIT 6`).all(`%${term}%`, `%${term}%`);
  res.json({ data: rows });
});

router.get('/products/:slug', (req, res) => {
  const db = req.app.locals.db;
  const product = toProduct(db.prepare(`${SELECT_PRODUCT} WHERE p.slug = ?`).get(req.params.slug));
  if (!product) throw notFound('Product');
  const reviews = db.prepare('SELECT author, rating, body, created_at AS createdAt FROM reviews WHERE product_id = ? ORDER BY id DESC').all(product.id);
  const related = db.prepare(`${SELECT_PRODUCT} WHERE c.slug = ? AND p.id != ? ORDER BY p.rating DESC LIMIT 6`)
    .all(product.category, product.id).map(toProduct);
  res.json({ data: { ...product, reviewList: reviews, related } });
});

module.exports = router;
