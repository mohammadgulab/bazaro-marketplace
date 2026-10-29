const bcrypt = require('bcryptjs');
const config = require('./config');
const { categories, products } = require('./catalog');

const REVIEW_TEXT = [
  ['Sara A.', 5, 'Exactly as shown. Delivered to Jeddah in two days and well packed.'],
  ['Omar K.', 4, 'Good quality for the price. Would buy again.'],
  ['Fatima R.', 5, 'Really happy with it, my second order from this seller.'],
  ['Yusuf M.', 3, 'Does the job. Packaging could be better.'],
  ['Noura S.', 4, 'Nice finish and fast delivery.']
];

// Clears the shop and loads the starter catalogue, an admin and a demo customer.
function seed(db) {
  const run = db.transaction(() => {
    db.exec('DELETE FROM order_items; DELETE FROM orders; DELETE FROM cart_items; DELETE FROM wishlist; DELETE FROM reviews; DELETE FROM products; DELETE FROM categories; DELETE FROM users;');
    const addCat = db.prepare('INSERT INTO categories (slug, name) VALUES (?, ?)');
    const catId = {};
    for (const c of categories) catId[c.slug] = addCat.run(c.slug, c.name).lastInsertRowid;

    const addProduct = db.prepare(`INSERT INTO products
      (slug, name, brand, category_id, price, mrp, rating, reviews_count, stock, description, highlights, images, seller, is_deal)
      VALUES (@slug, @name, @brand, @category_id, @price, @mrp, @rating, @reviews, @stock, @description, @highlights, @images, @seller, @deal)`);
    const addReview = db.prepare('INSERT INTO reviews (product_id, author, rating, body) VALUES (?, ?, ?, ?)');
    products.forEach((p, i) => {
      const id = addProduct.run({
        ...p,
        category_id: catId[p.category],
        highlights: JSON.stringify(p.highlights),
        images: JSON.stringify(p.images),
        deal: p.deal ? 1 : 0
      }).lastInsertRowid;
      // Three short reviews per product, rotated so pages do not all look the same.
      for (let r = 0; r < 3; r++) {
        const [author, rating, body] = REVIEW_TEXT[(i + r) % REVIEW_TEXT.length];
        addReview.run(id, author, rating, body);
      }
    });

    const addUser = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)');
    addUser.run('Store Admin', config.adminEmail, bcrypt.hashSync(config.adminPassword, 10), 'admin');
    addUser.run('Demo Customer', 'demo@bazaro.test', bcrypt.hashSync('demo1234', 10), 'customer');
  });
  run();
  return { categories: categories.length, products: products.length };
}

// "npm run seed" runs this file directly.
if (require.main === module) {
  const { openDb } = require('./db');
  const db = openDb(config.dbFile);
  const result = seed(db);
  console.log(`Seeded ${result.products} products in ${result.categories} categories.`);
  console.log(`Admin: ${config.adminEmail} / ${config.adminPassword}   Customer: demo@bazaro.test / demo1234`);
}

module.exports = { seed, REVIEW_TEXT };
