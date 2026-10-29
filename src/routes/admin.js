const express = require('express');
const { requireAdmin } = require('../auth');
const { parse, productSchema, productUpdateSchema } = require('../validate');
const { SELECT_PRODUCT, toProduct } = require('../products');
const { HttpError, notFound } = require('../errors');

const router = express.Router();
router.use(requireAdmin);

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);

function categoryId(db, slug) {
  const row = db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug);
  if (!row) throw new HttpError(400, 'Validation failed', { category: 'Unknown category' });
  return row.id;
}

router.get('/stats', (req, res) => {
  const db = req.app.locals.db;
  const one = (sql) => db.prepare(sql).get();
  res.json({
    products: one('SELECT COUNT(*) AS n FROM products').n,
    lowStock: one('SELECT COUNT(*) AS n FROM products WHERE stock < 5').n,
    customers: one("SELECT COUNT(*) AS n FROM users WHERE role = 'customer'").n,
    orders: one('SELECT COUNT(*) AS n FROM orders').n,
    revenue: one('SELECT COALESCE(SUM(total), 0) AS n FROM orders').n
  });
});

router.get('/orders', (req, res) => {
  const rows = req.app.locals.db.prepare(`
    SELECT o.order_no AS orderNo, o.status, o.total, o.payment, o.created_at AS createdAt, u.name AS customer,
      (SELECT SUM(qty) FROM order_items WHERE order_id = o.id) AS items
    FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.id DESC LIMIT 50`).all();
  res.json({ data: rows });
});

router.post('/products', (req, res) => {
  const p = parse(productSchema, req.body);
  const db = req.app.locals.db;
  let slug = slugify(p.name);
  if (db.prepare('SELECT 1 FROM products WHERE slug = ?').get(slug)) slug = `${slug}-${Date.now().toString(36)}`;
  const id = db.prepare(`INSERT INTO products (slug, name, brand, category_id, price, mrp, stock, description, highlights, images, seller, is_deal)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(slug, p.name, p.brand, categoryId(db, p.category), p.price, p.mrp, p.stock,
    p.description, JSON.stringify(p.highlights), JSON.stringify(p.images), p.seller, p.deal ? 1 : 0).lastInsertRowid;
  res.status(201).json({ data: toProduct(db.prepare(`${SELECT_PRODUCT} WHERE p.id = ?`).get(id)) });
});

router.patch('/products/:id', (req, res) => {
  const db = req.app.locals.db;
  const current = toProduct(db.prepare(`${SELECT_PRODUCT} WHERE p.id = ?`).get(req.params.id));
  if (!current) throw notFound('Product');
  const changes = parse(productUpdateSchema, req.body);
  const next = { ...current, ...changes };
  if (next.mrp < next.price) throw new HttpError(400, 'Validation failed', { mrp: 'MRP must be equal to or higher than the price' });
  db.prepare(`UPDATE products SET name = ?, brand = ?, category_id = ?, price = ?, mrp = ?, stock = ?, description = ?,
    highlights = ?, images = ?, seller = ?, is_deal = ? WHERE id = ?`).run(next.name, next.brand, categoryId(db, next.category),
    next.price, next.mrp, next.stock, next.description, JSON.stringify(next.highlights), JSON.stringify(next.images),
    next.seller, next.deal ? 1 : 0, current.id);
  res.json({ data: toProduct(db.prepare(`${SELECT_PRODUCT} WHERE p.id = ?`).get(current.id)) });
});

router.delete('/products/:id', (req, res) => {
  const info = req.app.locals.db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  if (!info.changes) throw notFound('Product');
  res.status(204).end();
});

module.exports = router;
