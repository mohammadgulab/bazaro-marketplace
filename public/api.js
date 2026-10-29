/* API client for the storefront.
 * When the Node.js server is running, every call goes to the real REST API under /api.
 * On static hosting (GitHub Pages) there is no server, so the same calls are answered
 * by a small in-browser copy of the API that keeps its data in localStorage. */
(function () {
  const TOKEN_KEY = 'bz_token';
  const RULES = { freeShippingFrom: 200, shippingFee: 15, vatRate: 0.15 };
  let mode = null;

  class ApiError extends Error {
    constructor(status, message, details) { super(message); this.status = status; this.details = details; }
  }

  // ---------- Real server ----------
  async function http(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) headers.Authorization = 'Bearer ' + token;
    const res = await fetch('api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, data.error || 'Request failed', data.details);
    return data;
  }

  // ---------- In-browser copy of the API (static demo) ----------
  const Mock = {
    db: null,
    async load() {
      const saved = localStorage.getItem('bz_mock_db');
      if (saved) { this.db = JSON.parse(saved); return; }
      const seed = await (await fetch('catalog.json')).json();
      let id = 1;
      this.db = {
        categories: seed.categories,
        products: seed.products.map((p) => ({ ...p, id: id++, createdAt: '2026-10-01' })),
        reviews: seed.reviews,
        users: [
          { id: 1, name: 'Store Admin', email: 'admin@bazaro.test', pass: 'admin123', role: 'admin' },
          { id: 2, name: 'Demo Customer', email: 'demo@bazaro.test', pass: 'demo1234', role: 'customer' }
        ],
        carts: {}, wishlist: {}, orders: []
      };
      this.save();
    },
    save() { localStorage.setItem('bz_mock_db', JSON.stringify(this.db)); },
    round2: (n) => Math.round((n + Number.EPSILON) * 100) / 100,
    totals(lines) {
      const subtotal = this.round2(lines.reduce((s, l) => s + l.price * l.qty, 0));
      const shipping = subtotal === 0 || subtotal >= RULES.freeShippingFrom ? 0 : RULES.shippingFee;
      const total = this.round2(subtotal + shipping);
      return { subtotal, shipping, total, vatIncluded: this.round2(total - total / (1 + RULES.vatRate)) };
    },
    view(p) {
      const cat = this.db.categories.find((c) => c.slug === p.category);
      return { ...p, categoryName: cat ? cat.name : p.category, discount: p.mrp > p.price ? Math.round((1 - p.price / p.mrp) * 100) : 0 };
    },
    user() {
      const t = localStorage.getItem(TOKEN_KEY) || '';
      const u = t.startsWith('mock.') && this.db.users.find((x) => String(x.id) === t.slice(5));
      if (!u) throw new ApiError(401, 'Please sign in first');
      return u;
    },
    pub: (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role }),
    filter(q) {
      const term = (q.q || '').toLowerCase();
      const brands = q.brand ? q.brand.split(',') : null;
      return this.db.products.filter((p) => {
        const cat = this.db.categories.find((c) => c.slug === p.category);
        if (term && !(p.name + ' ' + p.brand + ' ' + (cat ? cat.name : '')).toLowerCase().includes(term)) return false;
        if (q.category && p.category !== q.category) return false;
        if (brands && !brands.includes(p.brand)) return false;
        if (q.minPrice && p.price < +q.minPrice) return false;
        if (q.maxPrice && p.price > +q.maxPrice) return false;
        if (q.rating && p.rating < +q.rating) return false;
        if (q.deal === 'true' && !p.deal) return false;
        if (q.inStock === 'true' && p.stock <= 0) return false;
        return true;
      });
    },
    async handle(method, fullPath, body) {
      await new Promise((r) => setTimeout(r, 60)); // feels a little like a network call
      const [path, qs] = fullPath.split('?');
      const q = Object.fromEntries(new URLSearchParams(qs || ''));
      const db = this.db;
      const seg = path.split('/').filter(Boolean);
      const bad = (fields) => { throw new ApiError(400, 'Validation failed', fields); };

      if (path === '/categories') return { data: db.categories.map((c) => ({ ...c, count: db.products.filter((p) => p.category === c.slug).length })) };
      if (path === '/products/suggest') {
        const t = (q.q || '').toLowerCase();
        if (t.length < 2) return { data: [] };
        return { data: db.products.filter((p) => (p.name + ' ' + p.brand).toLowerCase().includes(t)).sort((a, b) => b.reviews - a.reviews).slice(0, 6).map((p) => ({ slug: p.slug, name: p.name, category: this.view(p).categoryName })) };
      }
      if (path === '/products') {
        const sorts = {
          popular: (a, b) => b.reviews - a.reviews, price_asc: (a, b) => a.price - b.price, price_desc: (a, b) => b.price - a.price,
          rating: (a, b) => b.rating - a.rating || b.reviews - a.reviews, newest: (a, b) => b.id - a.id,
          discount: (a, b) => (1 - b.price / b.mrp) - (1 - a.price / a.mrp)
        };
        const all = this.filter(q).sort(sorts[q.sort || 'popular'] || sorts.popular);
        const limit = Math.min(+q.limit || 24, 60), page = Math.max(+q.page || 1, 1);
        const base = this.filter({ q: q.q, category: q.category });
        const brandCount = {};
        base.forEach((p) => { brandCount[p.brand] = (brandCount[p.brand] || 0) + 1; });
        const prices = base.map((p) => p.price);
        return {
          data: all.slice((page - 1) * limit, page * limit).map((p) => this.view(p)), total: all.length, page, limit, pages: Math.ceil(all.length / limit),
          facets: { brands: Object.keys(brandCount).sort().map((name) => ({ name, count: brandCount[name] })), price: { min: Math.min(...prices), max: Math.max(...prices) } }
        };
      }
      if (seg[0] === 'products' && seg[1]) {
        const p = db.products.find((x) => x.slug === seg[1]);
        if (!p) throw new ApiError(404, 'Product not found');
        const idx = db.products.indexOf(p);
        const reviewList = [0, 1, 2].map((r) => db.reviews[(idx + r) % db.reviews.length]);
        const related = db.products.filter((x) => x.category === p.category && x.id !== p.id).sort((a, b) => b.rating - a.rating).slice(0, 6).map((x) => this.view(x));
        return { data: { ...this.view(p), reviewList, related } };
      }
      if (path === '/auth/login') {
        const u = db.users.find((x) => x.email === String(body.email || '').trim().toLowerCase());
        if (!u || u.pass !== body.password) throw new ApiError(401, 'Email or password is incorrect');
        return { token: 'mock.' + u.id, user: this.pub(u) };
      }
      if (path === '/auth/register') {
        const email = String(body.email || '').trim().toLowerCase(), errs = {};
        if (!body.name || body.name.trim().length < 2) errs.name = 'Name must be at least 2 characters';
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errs.email = 'Enter a valid email';
        if (!body.password || body.password.length < 6) errs.password = 'Password must be at least 6 characters';
        if (Object.keys(errs).length) bad(errs);
        if (db.users.find((x) => x.email === email)) throw new ApiError(409, 'An account with this email already exists');
        const u = { id: Date.now(), name: body.name.trim(), email, pass: body.password, role: 'customer' };
        db.users.push(u); this.save();
        return { token: 'mock.' + u.id, user: this.pub(u) };
      }
      if (path === '/auth/me') return { user: this.pub(this.user()) };

      const u = this.user();
      if (path === '/cart') {
        if (method === 'PUT') { db.carts[u.id] = body.items.filter((i) => db.products.some((p) => p.id === i.productId)); this.save(); }
        const items = (db.carts[u.id] || []).map((i) => ({ ...i, product: this.view(db.products.find((p) => p.id === i.productId)) }));
        return { items, totals: this.totals(items.map((i) => ({ price: i.product.price, qty: i.qty }))) };
      }
      if (path === '/wishlist') return { data: (db.wishlist[u.id] || []).map((id) => db.products.find((p) => p.id === id)).filter(Boolean).map((p) => this.view(p)) };
      if (seg[0] === 'wishlist' && seg[2] === 'toggle') {
        const list = db.wishlist[u.id] = db.wishlist[u.id] || [];
        const id = +seg[1], at = list.indexOf(id);
        if (at >= 0) list.splice(at, 1); else list.unshift(id);
        this.save();
        return { saved: at < 0 };
      }
      if (path === '/orders' && method === 'POST') {
        if (!body.items || !body.items.length) bad({ items: 'Your cart is empty' });
        const a = body.address || {}, errs = {};
        if (!a.fullName || a.fullName.trim().length < 2) errs['address.fullName'] = 'Full name is required';
        if (!/^(\+966|0)?5\d{8}$/.test((a.phone || '').trim())) errs['address.phone'] = 'Enter a Saudi mobile number like 05XXXXXXXX';
        if (!a.city || a.city.trim().length < 2) errs['address.city'] = 'City is required';
        if (!a.district || a.district.trim().length < 2) errs['address.district'] = 'District is required';
        if (!a.street || a.street.trim().length < 3) errs['address.street'] = 'Street is required';
        if (!/^\d{5}$/.test((a.postalCode || '').trim())) errs['address.postalCode'] = 'Postal code has 5 digits';
        if (Object.keys(errs).length) bad(errs);
        const lines = body.items.map((i) => {
          const p = db.products.find((x) => x.id === i.productId);
          if (!p) throw new ApiError(400, 'A product in your cart no longer exists');
          if (p.stock < i.qty) throw new ApiError(409, `Only ${p.stock} left of ${p.name}`);
          return { productId: p.id, name: p.name, image: p.images[0], price: p.price, qty: i.qty };
        });
        lines.forEach((l) => { db.products.find((p) => p.id === l.productId).stock -= l.qty; });
        const order = { orderNo: 'BZ-' + new Date().getFullYear() + '-' + String(db.orders.length + 1).padStart(5, '0'), userId: u.id, status: 'Placed', createdAt: new Date().toISOString(), payment: body.payment, address: a, items: lines, totals: this.totals(lines) };
        db.orders.push(order); db.carts[u.id] = []; this.save();
        return { data: order };
      }
      if (path === '/orders') return { data: db.orders.filter((o) => o.userId === u.id).reverse() };
      if (seg[0] === 'orders' && seg[1]) {
        const o = db.orders.find((x) => x.orderNo === seg[1] && x.userId === u.id);
        if (!o) throw new ApiError(404, 'Order not found');
        return { data: o };
      }
      if (seg[0] === 'admin') {
        if (u.role !== 'admin') throw new ApiError(403, 'Admins only');
        if (seg[1] === 'stats') return { products: db.products.length, lowStock: db.products.filter((p) => p.stock < 5).length, customers: db.users.filter((x) => x.role === 'customer').length, orders: db.orders.length, revenue: this.round2(db.orders.reduce((s, o) => s + o.totals.total, 0)) };
        if (seg[1] === 'orders') return { data: db.orders.slice().reverse().map((o) => ({ orderNo: o.orderNo, status: o.status, total: o.totals.total, payment: o.payment, createdAt: o.createdAt, customer: (db.users.find((x) => x.id === o.userId) || {}).name, items: o.items.reduce((s, i) => s + i.qty, 0) })) };
        if (seg[1] === 'products') {
          const check = (p) => {
            const e = {};
            if (!p.name || p.name.length < 3) e.name = 'Name is too short';
            if (!p.brand) e.brand = 'Brand is required';
            if (!(p.price > 0)) e.price = 'Price must be above 0';
            if (!(p.mrp >= p.price)) e.mrp = 'MRP must be equal to or higher than the price';
            if (!(p.stock >= 0)) e.stock = 'Stock cannot be negative';
            if (Object.keys(e).length) bad(e);
          };
          if (method === 'POST') {
            check(body);
            const slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36);
            const p = { highlights: [], description: '', seller: 'Bazaro Retail', deal: false, rating: 0, reviews: 0, ...body, id: Date.now(), slug };
            db.products.unshift(p); this.save();
            return { data: this.view(p) };
          }
          const p = db.products.find((x) => x.id === +seg[2]);
          if (!p) throw new ApiError(404, 'Product not found');
          if (method === 'PATCH') { const next = { ...p, ...body }; check(next); Object.assign(p, body); this.save(); return { data: this.view(p) }; }
          if (method === 'DELETE') { db.products.splice(db.products.indexOf(p), 1); this.save(); return null; }
        }
      }
      throw new ApiError(404, 'No route for ' + method + ' ' + path);
    }
  };

  window.Api = {
    ApiError, RULES,
    get mode() { return mode; },
    async init() {
      // GitHub Pages only serves files, so skip the server check there.
      const staticHost = /github\.io$/.test(location.hostname);
      try {
        if (staticHost) throw new Error('static host');
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 2500);
        const res = await fetch('api/health', { cache: 'no-store', signal: ctrl.signal });
        clearTimeout(t);
        if (res.ok && (await res.json()).mode === 'server') {
          mode = 'server';
          Object.assign(RULES, await (await fetch('api/config')).json());
          return mode;
        }
      } catch (e) { /* no server here, fall back to the static demo */ }
      mode = 'static';
      await Mock.load();
      return mode;
    },
    call(method, path, body) { return mode === 'server' ? http(method, path, body) : Mock.handle(method, path, body); },
    get: (p) => window.Api.call('GET', p),
    post: (p, b) => window.Api.call('POST', p, b || {}),
    put: (p, b) => window.Api.call('PUT', p, b),
    patch: (p, b) => window.Api.call('PATCH', p, b),
    del: (p) => window.Api.call('DELETE', p),
    token: { get: () => localStorage.getItem(TOKEN_KEY), set: (t) => localStorage.setItem(TOKEN_KEY, t), clear: () => localStorage.removeItem(TOKEN_KEY) },
    resetDemo() { localStorage.removeItem('bz_mock_db'); }
  };
})();
