const express = require('express');
const { requireAuth } = require('../auth');
const { SELECT_PRODUCT, toProduct } = require('../products');
const { notFound } = require('../errors');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const rows = req.app.locals.db.prepare(`${SELECT_PRODUCT} JOIN wishlist w ON w.product_id = p.id WHERE w.user_id = ? ORDER BY w.created_at DESC`).all(req.user.id);
  res.json({ data: rows.map(toProduct) });
});

// Adds the product if it is not saved yet, removes it if it is.
router.post('/:productId/toggle', (req, res) => {
  const db = req.app.locals.db;
  const productId = Number(req.params.productId);
  if (!db.prepare('SELECT 1 FROM products WHERE id = ?').get(productId)) throw notFound('Product');
  const removed = db.prepare('DELETE FROM wishlist WHERE user_id = ? AND product_id = ?').run(req.user.id, productId).changes;
  if (!removed) db.prepare('INSERT INTO wishlist (user_id, product_id) VALUES (?, ?)').run(req.user.id, productId);
  res.json({ saved: !removed });
});

module.exports = router;
