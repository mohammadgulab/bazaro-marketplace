const express = require('express');
const { requireAuth } = require('../auth');
const { parse, cartSchema } = require('../validate');
const { SELECT_PRODUCT, toProduct } = require('../products');
const { orderTotals } = require('../money');
const config = require('../config');

const router = express.Router();
router.use(requireAuth);

function readCart(db, userId) {
  const lines = db.prepare('SELECT product_id, qty FROM cart_items WHERE user_id = ?').all(userId)
    .map((line) => {
      const product = toProduct(db.prepare(`${SELECT_PRODUCT} WHERE p.id = ?`).get(line.product_id));
      return { productId: line.product_id, qty: Math.min(line.qty, Math.max(product.stock, 0)), product };
    })
    .filter((l) => l.qty > 0);
  return { items: lines, totals: orderTotals(lines.map((l) => ({ price: l.product.price, qty: l.qty })), config) };
}

router.get('/', (req, res) => res.json(readCart(req.app.locals.db, req.user.id)));

// The storefront sends the whole cart after each change. Unknown products are skipped.
router.put('/', (req, res) => {
  const { items } = parse(cartSchema, req.body);
  const db = req.app.locals.db;
  const exists = db.prepare('SELECT id FROM products WHERE id = ?');
  db.transaction(() => {
    db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(req.user.id);
    const add = db.prepare('INSERT OR REPLACE INTO cart_items (user_id, product_id, qty) VALUES (?, ?, ?)');
    for (const item of items) if (exists.get(item.productId)) add.run(req.user.id, item.productId, item.qty);
  })();
  res.json(readCart(db, req.user.id));
});

module.exports = router;
