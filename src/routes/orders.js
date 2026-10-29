const express = require('express');
const { requireAuth } = require('../auth');
const { parse, checkoutSchema } = require('../validate');
const { HttpError, notFound } = require('../errors');
const { orderTotals } = require('../money');
const config = require('../config');

const router = express.Router();
router.use(requireAuth);

function makeOrderNo(db) {
  const n = db.prepare('SELECT COUNT(*) AS n FROM orders').get().n + 1;
  return `BZ-${new Date().getFullYear()}-${String(n).padStart(5, '0')}`;
}

function readOrder(db, order) {
  const items = db.prepare('SELECT product_id AS productId, name, image, price, qty FROM order_items WHERE order_id = ?').all(order.id);
  return {
    orderNo: order.order_no, status: order.status, createdAt: order.created_at, payment: order.payment,
    address: JSON.parse(order.address), items,
    totals: { subtotal: order.subtotal, shipping: order.shipping, vatIncluded: order.vat_included, total: order.total }
  };
}

// Places an order. Prices and stock always come from the database, never from the browser.
router.post('/', (req, res) => {
  const { items, address, payment } = parse(checkoutSchema, req.body);
  const db = req.app.locals.db;
  const getProduct = db.prepare('SELECT id, name, price, stock, images FROM products WHERE id = ?');

  const place = db.transaction(() => {
    const lines = items.map((item) => {
      const p = getProduct.get(item.productId);
      if (!p) throw new HttpError(400, `Product ${item.productId} no longer exists`);
      if (p.stock < item.qty) throw new HttpError(409, `Only ${p.stock} left of ${p.name}`);
      return { productId: p.id, name: p.name, image: JSON.parse(p.images)[0], price: p.price, qty: item.qty };
    });
    const totals = orderTotals(lines, config);
    const orderNo = makeOrderNo(db);
    const orderId = db.prepare(`INSERT INTO orders (order_no, user_id, subtotal, shipping, vat_included, total, payment, address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(orderNo, req.user.id, totals.subtotal, totals.shipping, totals.vatIncluded, totals.total, payment, JSON.stringify(address)).lastInsertRowid;
    const addItem = db.prepare('INSERT INTO order_items (order_id, product_id, name, image, price, qty) VALUES (?, ?, ?, ?, ?, ?)');
    const takeStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
    for (const l of lines) {
      addItem.run(orderId, l.productId, l.name, l.image, l.price, l.qty);
      takeStock.run(l.qty, l.productId);
    }
    db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(req.user.id);
    return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  });

  res.status(201).json({ data: readOrder(db, place()) });
});

router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC').all(req.user.id);
  res.json({ data: orders.map((o) => readOrder(db, o)) });
});

router.get('/:orderNo', (req, res) => {
  const db = req.app.locals.db;
  const order = db.prepare('SELECT * FROM orders WHERE order_no = ? AND user_id = ?').get(req.params.orderNo, req.user.id);
  if (!order) throw notFound('Order');
  res.json({ data: readOrder(db, order) });
});

module.exports = router;
