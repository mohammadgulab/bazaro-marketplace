const path = require('path');
const express = require('express');
const config = require('./config');
const { HttpError } = require('./errors');

// Builds the Express app around a database handle, so tests can pass an in-memory one.
function createApp(db) {
  const app = express();
  app.locals.db = db;
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (req, res) => res.json({ ok: true, mode: 'server' }));
  app.get('/api/config', (req, res) =>
    res.json({ freeShippingFrom: config.freeShippingFrom, shippingFee: config.shippingFee, vatRate: config.vatRate, currency: 'SAR' }));

  app.use('/api/auth', require('./routes/auth'));
  app.use('/api', require('./routes/catalog'));
  app.use('/api/cart', require('./routes/cart'));
  app.use('/api/wishlist', require('./routes/wishlist'));
  app.use('/api/orders', require('./routes/orders'));
  app.use('/api/admin', require('./routes/admin'));

  // Unknown API routes get a JSON 404 instead of the storefront page.
  app.use('/api', (req, res, next) => next(new HttpError(404, `No route for ${req.method} ${req.originalUrl}`)));

  // The storefront is a single page app in /public.
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // One place that turns any error into a JSON answer.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') err = new HttpError(400, 'Request body is not valid JSON');
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Something went wrong on our side' : err.message, details: err.details });
  });

  return app;
}

module.exports = { createApp };
