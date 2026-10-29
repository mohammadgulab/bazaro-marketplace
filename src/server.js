const config = require('./config');
const { openDb } = require('./db');
const { createApp } = require('./app');
const { seed } = require('./seed');

const db = openDb(config.dbFile);

// First run on an empty database: load the starter catalogue so the shop is not empty.
if (db.prepare('SELECT COUNT(*) AS n FROM products').get().n === 0) {
  seed(db);
  console.log('Empty database, loaded the starter catalogue.');
}

createApp(db).listen(config.port, () => {
  console.log(`Bazaro is running on http://localhost:${config.port}`);
});
