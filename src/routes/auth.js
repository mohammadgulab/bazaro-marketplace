const express = require('express');
const bcrypt = require('bcryptjs');
const { parse, registerSchema, loginSchema } = require('../validate');
const { signToken, requireAuth } = require('../auth');
const { HttpError } = require('../errors');

const router = express.Router();
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });

router.post('/register', (req, res) => {
  const { name, email, password } = parse(registerSchema, req.body);
  const db = req.app.locals.db;
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
    throw new HttpError(409, 'An account with this email already exists');
  }
  const hash = bcrypt.hashSync(password, 10);
  const id = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(name, email, hash).lastInsertRowid;
  const user = { id, name, email, role: 'customer' };
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

router.post('/login', (req, res) => {
  const { email, password } = parse(loginSchema, req.body);
  const user = req.app.locals.db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  // Same message for a wrong email or a wrong password, so accounts cannot be guessed.
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    throw new HttpError(401, 'Email or password is incorrect');
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

module.exports = router;
