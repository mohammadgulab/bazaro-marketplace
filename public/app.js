/* Bazaro storefront: hash router, views, cart drawer, account and admin screens. */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const app = $('#app');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sar = (n) => `<span class="price"><small>SAR</small>${Number(n).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}</span>`;
  const plain = (n) => 'SAR ' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const ICON = {
    star: '<svg viewBox="0 0 24 24"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>',
    heart: '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.5-9.3C1.1 8.3 3.3 4.5 7 4.5c2 0 3.6 1.1 5 2.8 1.4-1.7 3-2.8 5-2.8 3.7 0 5.9 3.8 4.5 7.2C19.5 16.4 12 21 12 21z"/></svg>',
    truck: '<svg viewBox="0 0 24 24"><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></svg>',
    cash: '<svg viewBox="0 0 24 24"><rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/></svg>',
    shield: '<svg viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z"/><path d="m9 12 2 2 4-4"/></svg>',
    tick: '<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
    cart: '<svg viewBox="0 0 24 24"><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.5L21 8H6.2"/><circle cx="10" cy="20.5" r="1.3"/><circle cx="17" cy="20.5" r="1.3"/></svg>',
    filter: '<svg viewBox="0 0 24 24"><path d="M4 6h16M7 12h10M10 18h4"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    left: '<svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg>',
    right: '<svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg>'
  };
  const stars = (r) => `<span class="stars" aria-label="${r} out of 5">${[1, 2, 3, 4, 5].map((i) => `<span class="${r >= i - 0.25 ? '' : 'off'}">${ICON.star}</span>`).join('')}</span>`;

  // ---------- State ----------
  const state = {
    user: null,
    categories: [],
    cart: JSON.parse(localStorage.getItem('bz_cart') || '[]'), // [{ productId, qty, name, price, mrp, image, slug, stock }]
    wish: new Set()
  };
  let timers = [];
  const clearTimers = () => { timers.forEach(clearInterval); timers = []; };

  function toast(msg, opts = {}) {
    const el = document.createElement('div');
    el.className = 'toast' + (opts.error ? ' err' : '');
    el.innerHTML = `<span>${esc(msg)}</span>${opts.link ? `<a href="${opts.link[1]}">${esc(opts.link[0])}</a>` : ''}`;
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  // ---------- Cart ----------
  const cartCount = () => state.cart.reduce((s, l) => s + l.qty, 0);
  function cartTotals() {
    const R = Api.RULES;
    const subtotal = Math.round(state.cart.reduce((s, l) => s + l.price * l.qty, 0) * 100) / 100;
    const shipping = subtotal === 0 || subtotal >= R.freeShippingFrom ? 0 : R.shippingFee;
    const total = subtotal + shipping;
    return { subtotal, shipping, total, vatIncluded: Math.round((total - total / (1 + R.vatRate)) * 100) / 100 };
  }
  let syncTimer;
  function saveCart() {
    localStorage.setItem('bz_cart', JSON.stringify(state.cart));
    $('#cartCount').textContent = cartCount();
    // Signed in shoppers keep their cart on the server too.
    if (state.user) {
      clearTimeout(syncTimer);
      syncTimer = setTimeout(() => Api.put('/cart', { items: state.cart.map((l) => ({ productId: l.productId, qty: l.qty })) }).catch(() => {}), 300);
    }
    renderDrawer();
  }
  function addToCart(p, qty = 1, quiet) {
    if (p.stock <= 0) return toast('Sorry, this item is out of stock', { error: true });
    const line = state.cart.find((l) => l.productId === p.id);
    if (line) line.qty = Math.min(line.qty + qty, p.stock, 20);
    else state.cart.push({ productId: p.id, qty: Math.min(qty, p.stock), name: p.name, price: p.price, mrp: p.mrp, image: p.images[0], slug: p.slug, stock: p.stock });
    saveCart();
    if (!quiet) toast('Added to cart', { link: ['View cart', '#/cart'] });
  }
  function setQty(id, qty) {
    const line = state.cart.find((l) => l.productId === id);
    if (!line) return;
    line.qty = Math.max(1, Math.min(qty, line.stock || 20, 20));
    saveCart();
  }
  function removeLine(id) { state.cart = state.cart.filter((l) => l.productId !== id); saveCart(); }

  function summaryHtml(t, cta) {
    return `<div class="sum">
      <div><span>Subtotal (${cartCount()} items)</span><span>${plain(t.subtotal)}</span></div>
      <div><span>Delivery</span><span>${t.shipping ? plain(t.shipping) : '<b style="color:var(--green)">FREE</b>'}</span></div>
      <div class="muted"><span>VAT included (15%)</span><span>${plain(t.vatIncluded)}</span></div>
      <div class="total"><span>Total</span><span>${plain(t.total)}</span></div>${cta || ''}</div>`;
  }
  function linesHtml() {
    return state.cart.map((l) => `<div class="line">
      <a href="#/p/${l.slug}"><img src="${l.image}" alt="" loading="lazy"></a>
      <div><h4><a href="#/p/${l.slug}">${esc(l.name)}</a></h4>${sar(l.price)} ${l.mrp > l.price ? `<span class="mrp">SAR ${l.mrp}</span>` : ''}
        <div class="bottom"><span class="qty"><button data-q="-1" data-id="${l.productId}" aria-label="Less">-</button><span>${l.qty}</span><button data-q="1" data-id="${l.productId}" aria-label="More">+</button></span>
        <button class="rm" data-rm="${l.productId}">Remove</button></div></div></div>`).join('');
  }
  function shipBar(t) {
    const need = Api.RULES.freeShippingFrom - t.subtotal;
    const pct = Math.min(100, (t.subtotal / Api.RULES.freeShippingFrom) * 100);
    return `<div class="ship-bar">${need > 0 ? `Add <b>${plain(need)}</b> more for free delivery` : '<b>You get free delivery</b> on this order'}<i><b style="width:${pct}%"></b></i></div>`;
  }
  function bindLines(root) {
    $$('[data-q]', root).forEach((b) => b.onclick = () => { const l = state.cart.find((x) => x.productId === +b.dataset.id); setQty(l.productId, l.qty + +b.dataset.q); if (location.hash.startsWith('#/cart')) viewCart(); });
    $$('[data-rm]', root).forEach((b) => b.onclick = () => { removeLine(+b.dataset.rm); if (location.hash.startsWith('#/cart')) viewCart(); });
  }
  function renderDrawer() {
    const body = $('#drawerBody');
    if (!state.cart.length) {
      body.innerHTML = `<div class="empty">${ICON.cart}<h3>Your cart is empty</h3><p class="muted">Find something you like and it will show up here.</p><a class="btn" href="#/search" data-close>Start shopping</a></div>`;
    } else {
      const t = cartTotals();
      body.innerHTML = shipBar(t) + linesHtml() + summaryHtml(t, `<a class="btn block" href="#/checkout" data-close>Checkout</a><a class="btn ghost block" href="#/cart" data-close>View cart</a>`);
      bindLines(body);
    }
    $$('[data-close]', body).forEach((a) => a.addEventListener('click', closeDrawer));
  }
  function openDrawer() { renderDrawer(); $('#drawer').classList.add('open'); $('#drawer').setAttribute('aria-hidden', 'false'); $('#shade').hidden = false; }
  function closeDrawer() { $('#drawer').classList.remove('open'); $('#drawer').setAttribute('aria-hidden', 'true'); $('#shade').hidden = true; }

  // ---------- Wishlist ----------
  async function toggleWish(p, btn) {
    if (!state.user) { toast('Sign in to save items', { link: ['Sign in', '#/login?next=' + encodeURIComponent(location.hash)] }); return; }
    const { saved } = await Api.post(`/wishlist/${p.id}/toggle`);
    if (saved) state.wish.add(p.id); else state.wish.delete(p.id);
    if (btn) btn.classList.toggle('on', saved);
    updateBadges();
    toast(saved ? 'Saved to your wishlist' : 'Removed from wishlist');
  }
  function updateBadges() {
    $('#cartCount').textContent = cartCount();
    const w = $('#wishCount');
    w.textContent = state.wish.size;
    w.hidden = !state.wish.size;
    $('#hello').textContent = state.user ? 'Hello, ' + state.user.name.split(' ')[0] : 'Hello, sign in';
    $('#accountLink').setAttribute('href', state.user ? '#/account' : '#/login');
  }

  // ---------- Product card ----------
  const productCache = new Map();
  function card(p) {
    productCache.set(p.id, p);
    return `<article class="card">
      <a class="pic" href="#/p/${p.slug}"><img src="${p.images[0]}" alt="${esc(p.name)}" loading="lazy">${p.discount ? `<span class="disc">-${p.discount}%</span>` : ''}</a>
      <button class="heart ${state.wish.has(p.id) ? 'on' : ''}" data-wish="${p.id}" aria-label="Save to wishlist">${ICON.heart}</button>
      <div class="body">
        <span class="brand">${esc(p.brand)}</span>
        <h3><a href="#/p/${p.slug}">${esc(p.name)}</a></h3>
        <span class="rate">${stars(p.rating)} ${p.reviews.toLocaleString()}</span>
        <div class="row">${sar(p.price)}${p.mrp > p.price ? `<span class="mrp">SAR ${p.mrp}</span>` : ''}</div>
        ${p.deal ? '<span class="chip-deal">Limited time deal</span>' : `<span class="ship">${p.price >= Api.RULES.freeShippingFrom ? 'Free delivery' : 'Express delivery'}</span>`}
        <button class="add" data-add="${p.id}" ${p.stock <= 0 ? 'disabled' : ''}>${p.stock <= 0 ? 'Out of stock' : 'Add to cart'}</button>
      </div></article>`;
  }
  function bindCards(root) {
    $$('[data-add]', root).forEach((b) => b.onclick = () => {
      addToCart(productCache.get(+b.dataset.add));
      b.classList.add('done'); b.textContent = 'Added';
      setTimeout(() => { b.classList.remove('done'); b.textContent = 'Add to cart'; }, 1400);
    });
    $$('[data-wish]', root).forEach((b) => b.onclick = () => toggleWish(productCache.get(+b.dataset.wish), b).catch((e) => toast(e.message, { error: true })));
  }

  // ---------- Views ----------
  const catImage = { electronics: 'img/headphones-1.webp', fashion: 'img/sneakers-1.webp', 'home-kitchen': 'img/coffee-maker-1.webp', sports: 'img/dumbbells-1.webp', beauty: 'img/perfume-1.webp', stationery: 'img/notebook-1.webp' };

  async function viewHome() {
    const [deals, popular, top, cheap] = await Promise.all([
      Api.get('/products?deal=true&sort=discount&limit=12'),
      Api.get('/products?category=electronics&sort=popular&limit=12'),
      Api.get('/products?sort=rating&limit=8'),
      Api.get('/products?maxPrice=100&sort=price_asc&limit=8')
    ]);
    const slides = [
      { cls: 's1', kicker: 'Electronics week', title: 'Up to 40% off audio and wearables', text: 'Earbuds, headphones and smartwatches from top rated sellers. Delivered fast in Jeddah.', link: '#/search?category=electronics&deal=true', cta: 'Shop the deals', img: ['img/headphones-1.webp', 'img/smartwatch-1.webp'] },
      { cls: 's2', kicker: 'New season', title: 'Fresh looks for every day', text: 'Sneakers, hoodies and watches picked for comfort and style.', link: '#/search?category=fashion', cta: 'Explore fashion', img: ['img/sneakers-1.webp', 'img/watch-leather-1.webp'] },
      { cls: 's3', kicker: 'Home and kitchen', title: 'Make your home feel new', text: 'Coffee sets, cookware and cosy lighting starting from SAR 35.', link: '#/search?category=home-kitchen', cta: 'Shop home', img: ['img/coffee-maker-1.webp', 'img/plant-pot-1.webp'] }
    ];
    app.innerHTML = `<div class="wrap">
      <section class="hero" aria-roledescription="carousel" aria-label="Offers">
        <div class="slides" id="slides">${slides.map((s, i) => `<div class="slide ${s.cls}" aria-roledescription="slide" aria-label="${i + 1} of 3">
          <div class="copy"><span class="kicker">${s.kicker}</span>${i === 0 ? `<h1>${s.title}</h1>` : `<h2>${s.title}</h2>`}<p>${s.text}</p><a class="btn" href="${s.link}">${s.cta}</a></div>
          <div class="art" aria-hidden="true"><img src="${s.img[0]}" alt=""><img src="${s.img[1]}" alt=""></div></div>`).join('')}</div>
        <button class="hero-nav prev" aria-label="Previous offer">${ICON.left}</button><button class="hero-nav next" aria-label="Next offer">${ICON.right}</button>
        <div class="dots">${slides.map((_, i) => `<button aria-label="Show offer ${i + 1}" data-dot="${i}"></button>`).join('')}</div>
      </section>
      <nav class="cats" aria-label="Shop by category">${state.categories.map((c) => `<a class="cat" href="#/search?category=${c.slug}"><span class="ring"><img src="${catImage[c.slug]}" alt="" loading="lazy"></span>${esc(c.name)}</a>`).join('')}</nav>
      <section class="promos">
        <div class="promo"><i>${ICON.truck}</i><div><b>Free delivery over SAR ${Api.RULES.freeShippingFrom}</b><span>Next day in Jeddah and Riyadh</span></div></div>
        <div class="promo"><i>${ICON.cash}</i><div><b>Cash on delivery</b><span>Pay when your order arrives</span></div></div>
        <div class="promo"><i>${ICON.shield}</i><div><b>Easy 15 day returns</b><span>On most items, no questions asked</span></div></div>
      </section>
      <section class="sec"><div class="sec-head"><div class="deal-head"><h2>Deals of the day</h2><span class="timer" id="timer"></span></div><a href="#/search?deal=true">See all deals</a></div><div class="rail">${deals.data.map(card).join('')}</div></section>
      <section class="sec"><div class="sec-head"><h2>Best sellers in Electronics</h2><a href="#/search?category=electronics">See more</a></div><div class="rail">${popular.data.map(card).join('')}</div></section>
      <section class="sec"><div class="sec-head"><h2>Top rated by shoppers</h2><a href="#/search?sort=rating">See more</a></div><div class="grid">${top.data.map(card).join('')}</div></section>
      <section class="sec"><div class="sec-head"><h2>Under SAR 100</h2><a href="#/search?maxPrice=100">See more</a></div><div class="grid">${cheap.data.map(card).join('')}</div></section>
    </div>`;
    bindCards(app);
    // Carousel: auto plays, pauses on hover, arrows and dots.
    let i = 0;
    const go = (n) => { i = (n + slides.length) % slides.length; $('#slides').style.transform = `translateX(-${i * 100}%)`; $$('[data-dot]').forEach((d, k) => d.classList.toggle('on', k === i)); };
    go(0);
    $$('[data-dot]').forEach((d) => d.onclick = () => go(+d.dataset.dot));
    $('.hero-nav.prev').onclick = () => go(i - 1);
    $('.hero-nav.next').onclick = () => go(i + 1);
    let paused = false;
    $('.hero').onmouseenter = () => { paused = true; };
    $('.hero').onmouseleave = () => { paused = false; };
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) timers.push(setInterval(() => { if (!paused) go(i + 1); }, 5000));
    // Countdown to midnight for the daily deals.
    const tick = () => {
      const now = new Date(), end = new Date(now); end.setHours(24, 0, 0, 0);
      const s = Math.floor((end - now) / 1000);
      const el = $('#timer');
      if (el) el.innerHTML = 'Ends in ' + [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((v) => `<span>${String(v).padStart(2, '0')}</span>`).join('');
    };
    tick(); timers.push(setInterval(tick, 1000));
  }

  async function viewSearch(q) {
    const params = new URLSearchParams(q);
    if (!params.get('limit')) params.set('limit', '20');
    const res = await Api.get('/products?' + params.toString());
    const cat = state.categories.find((c) => c.slug === params.get('category'));
    const chosenBrands = (params.get('brand') || '').split(',').filter(Boolean);
    const title = params.get('q') ? `${res.total} results for "${esc(params.get('q'))}"` : `${cat ? esc(cat.name) : params.get('deal') ? "Today's deals" : 'All products'} <span class="muted">(${res.total})</span>`;
    const link = (changes) => { const p = new URLSearchParams(params); p.delete('page'); Object.entries(changes).forEach(([k, v]) => (v === null || v === '' ? p.delete(k) : p.set(k, v))); return '#/search?' + p.toString(); };
    const chips = [];
    if (params.get('q')) chips.push(['Search: ' + params.get('q'), { q: null }]);
    if (cat) chips.push([cat.name, { category: null }]);
    chosenBrands.forEach((b) => chips.push([b, { brand: chosenBrands.filter((x) => x !== b).join(',') }]));
    if (params.get('rating')) chips.push([params.get('rating') + ' stars and up', { rating: null }]);
    if (params.get('minPrice') || params.get('maxPrice')) chips.push([`SAR ${params.get('minPrice') || 0} to ${params.get('maxPrice') || 'any'}`, { minPrice: null, maxPrice: null }]);
    if (params.get('deal')) chips.push(['Deals', { deal: null }]);
    if (params.get('inStock')) chips.push(['In stock', { inStock: null }]);

    app.innerHTML = `<div class="wrap">
      <nav class="crumbs"><a href="#/">Home</a> / <span>${cat ? esc(cat.name) : 'Search'}</span></nav>
      <div class="listing">
        <aside class="filters panel" id="filters" aria-label="Filters">
          <div class="filters-head"><h3>Filters</h3><button class="ico-btn" id="filtersClose" aria-label="Close filters">${ICON.close}</button></div>
          <h4>Category</h4>
          <label><input type="radio" name="cat" value="" ${!cat ? 'checked' : ''}> All categories</label>
          ${state.categories.map((c) => `<label><input type="radio" name="cat" value="${c.slug}" ${cat && cat.slug === c.slug ? 'checked' : ''}> ${esc(c.name)} <span class="muted">(${c.count})</span></label>`).join('')}
          <h4>Brand</h4>
          ${res.facets.brands.map((b) => `<label><input type="checkbox" name="brand" value="${esc(b.name)}" ${chosenBrands.includes(b.name) ? 'checked' : ''}> ${esc(b.name)} <span class="muted">(${b.count})</span></label>`).join('')}
          <h4>Price (SAR)</h4>
          <div class="price-row"><input type="number" id="minP" min="0" placeholder="${Math.floor(res.facets.price.min || 0)}" value="${esc(params.get('minPrice') || '')}" aria-label="Minimum price"><span>to</span><input type="number" id="maxP" min="0" placeholder="${Math.ceil(res.facets.price.max || 0)}" value="${esc(params.get('maxPrice') || '')}" aria-label="Maximum price"></div>
          <h4>Customer rating</h4>
          ${[4, 3].map((r) => `<label><input type="radio" name="rating" value="${r}" ${params.get('rating') === String(r) ? 'checked' : ''}> ${stars(r)} &amp; up</label>`).join('')}
          <label><input type="radio" name="rating" value="" ${!params.get('rating') ? 'checked' : ''}> Any rating</label>
          <h4>More</h4>
          <label><input type="checkbox" id="fDeal" ${params.get('deal') ? 'checked' : ''}> Deals only</label>
          <label><input type="checkbox" id="fStock" ${params.get('inStock') ? 'checked' : ''}> In stock only</label>
          <button class="btn block" id="applyFilters" style="margin-top:14px">Apply filters</button>
        </aside>
        <section>
          <div class="toolbar"><h1>${title}</h1>
            <div style="display:flex;gap:8px"><button class="btn ghost sm filter-open" id="filtersOpen">${ICON.filter} Filters</button>
            <select id="sort" aria-label="Sort by">${[['popular', 'Most popular'], ['price_asc', 'Price: low to high'], ['price_desc', 'Price: high to low'], ['rating', 'Top rated'], ['discount', 'Biggest discount'], ['newest', 'Newest']].map(([v, l]) => `<option value="${v}" ${params.get('sort') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
          </div>
          ${chips.length ? `<div class="chips">${chips.map(([l, c]) => `<button data-go="${esc(link(c))}">${esc(l)} &times;</button>`).join('')}<button data-go="#/search">Clear all</button></div>` : ''}
          ${res.data.length ? `<div class="grid">${res.data.map(card).join('')}</div>` : `<div class="empty panel">${ICON.filter}<h3>No products match</h3><p class="muted">Try removing a filter or searching for something else.</p><a class="btn" href="#/search">Clear filters</a></div>`}
          ${res.pages > 1 ? `<nav class="pager">${Array.from({ length: res.pages }, (_, k) => `<a href="${link({ page: k + 1 })}" class="${res.page === k + 1 ? 'on' : ''}">${k + 1}</a>`).join('')}</nav>` : ''}
        </section>
      </div></div>`;
    bindCards(app);
    $$('[data-go]').forEach((b) => b.onclick = () => { location.hash = b.dataset.go; });
    $('#sort').onchange = (e) => { location.hash = link({ sort: e.target.value }); };
    const apply = () => {
      location.hash = link({
        category: ($('input[name=cat]:checked') || {}).value || null,
        brand: $$('input[name=brand]:checked').map((x) => x.value).join(',') || null,
        minPrice: $('#minP').value || null, maxPrice: $('#maxP').value || null,
        rating: ($('input[name=rating]:checked') || {}).value || null,
        deal: $('#fDeal').checked ? 'true' : null, inStock: $('#fStock').checked ? 'true' : null
      });
    };
    $('#applyFilters').onclick = apply;
    // On desktop every click filters straight away; on phones the sheet has an Apply button.
    $$('#filters input[type=radio], #filters input[type=checkbox]').forEach((i) => i.addEventListener('change', () => { if (matchMedia('(min-width:1000px)').matches) apply(); }));
    $('#filtersOpen').onclick = () => $('#filters').classList.add('open');
    $('#filtersClose').onclick = () => $('#filters').classList.remove('open');
  }

  async function viewProduct(slug) {
    const p = (await Api.get('/products/' + encodeURIComponent(slug))).data;
    productCache.set(p.id, p);
    p.related.forEach((r) => productCache.set(r.id, r));
    let qty = 1;
    const deliver = new Date(Date.now() + 2 * 864e5).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    const counts = [5, 4, 3, 2, 1].map((s) => p.reviewList.filter((r) => r.rating === s).length);
    const stockTxt = p.stock <= 0 ? ['out', 'Out of stock'] : p.stock < 10 ? ['low', `Only ${p.stock} left in stock`] : ['ok', 'In stock'];
    app.innerHTML = `<div class="wrap">
      <nav class="crumbs"><a href="#/">Home</a> / <a href="#/search?category=${p.category}">${esc(p.categoryName)}</a> / <span>${esc(p.brand)}</span></nav>
      <div class="pdp">
        <div class="gallery">
          <div class="thumbs">${p.images.map((src, k) => `<button class="${k ? '' : 'on'}" data-img="${src}" aria-label="Image ${k + 1}"><img src="${src}" alt=""></button>`).join('')}</div>
          <div class="main-pic" id="mainPic"><img src="${p.images[0]}" alt="${esc(p.name)}" id="mainImg"></div>
        </div>
        <div class="info">
          <a class="brandline" href="#/search?brand=${encodeURIComponent(p.brand)}">Visit the ${esc(p.brand)} store</a>
          <h1>${esc(p.name)}</h1>
          <div class="rate">${p.rating} ${stars(p.rating)} <a href="#reviews">${p.reviews.toLocaleString()} ratings</a></div>
          <div class="pricebox">${p.discount ? `<span class="off-tag">-${p.discount}%</span> ` : ''}${sar(p.price)}
            <div class="vat">Inclusive of VAT ${p.mrp > p.price ? `&middot; List price <span class="mrp">SAR ${p.mrp}</span>` : ''}</div>
            ${p.deal ? '<span class="chip-deal" style="margin-top:6px">Limited time deal</span>' : ''}</div>
          <div class="offers"><div><b>Cash on delivery</b>Pay at your door</div><div><b>Free returns</b>Within 15 days</div><div><b>Bank offer</b>10% back with WELCOME10</div><div><b>Secure checkout</b>Your data is protected</div></div>
          <h3>About this item</h3><ul>${p.highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>
          <p>${esc(p.description)}</p>
        </div>
        <aside class="buybox panel">
          ${sar(p.price)}
          <p style="margin:8px 0 0">${p.price >= Api.RULES.freeShippingFrom ? '<b>FREE delivery</b>' : 'Delivery SAR ' + Api.RULES.shippingFee} <b>${deliver}</b></p>
          <p class="muted" style="margin:2px 0 0;font-size:13px">Deliver to Jeddah</p>
          <div class="stock ${stockTxt[0]}">${stockTxt[1]}</div>
          <div class="qty" aria-label="Quantity"><button id="qMinus" aria-label="Less">-</button><span id="qVal">1</span><button id="qPlus" aria-label="More">+</button></div>
          <button class="btn block" id="addBtn" ${p.stock <= 0 ? 'disabled' : ''}>Add to cart</button>
          <button class="btn dark block" id="buyBtn" ${p.stock <= 0 ? 'disabled' : ''}>Buy now</button>
          <button class="btn ghost block" id="wishBtn">${state.wish.has(p.id) ? 'Saved in wishlist' : 'Add to wishlist'}</button>
          <dl><dt>Ships from</dt><dd>Bazaro</dd><dt>Sold by</dt><dd>${esc(p.seller)}</dd><dt>Returns</dt><dd>15 days</dd><dt>Payment</dt><dd>Secure transaction</dd></dl>
        </aside>
      </div>
      <section class="sec panel reviews" id="reviews">
        <div><h2 style="margin:0 0 6px">Customer reviews</h2><div>${stars(p.rating)} <b>${p.rating} out of 5</b></div><p class="muted" style="margin:4px 0 10px">${p.reviews.toLocaleString()} global ratings</p>
          <div class="bars">${counts.map((c, k) => `<div><span>${5 - k} star</span><i><b style="width:${p.reviewList.length ? (c / p.reviewList.length) * 100 : 0}%"></b></i><span class="muted">${Math.round(p.reviewList.length ? (c / p.reviewList.length) * 100 : 0)}%</span></div>`).join('')}</div></div>
        <div>${p.reviewList.map((r) => `<div class="review"><b>${esc(r.author)}</b><div>${stars(r.rating)} <span class="muted" style="font-size:13px">Verified purchase</span></div><p style="margin:6px 0 0">${esc(r.body)}</p></div>`).join('')}</div>
      </section>
      ${p.related.length ? `<section class="sec"><div class="sec-head"><h2>More from ${esc(p.categoryName)}</h2></div><div class="rail">${p.related.map(card).join('')}</div></section>` : ''}
    </div>`;
    bindCards(app);
    $$('[data-img]').forEach((b) => b.onclick = () => { $('#mainImg').src = b.dataset.img; $$('[data-img]').forEach((x) => x.classList.toggle('on', x === b)); });
    const pic = $('#mainPic');
    pic.onmousemove = (e) => { const r = pic.getBoundingClientRect(); $('#mainImg').style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`; };
    pic.onmouseenter = () => pic.classList.add('zoom');
    pic.onmouseleave = () => pic.classList.remove('zoom');
    $('#qMinus').onclick = () => { qty = Math.max(1, qty - 1); $('#qVal').textContent = qty; };
    $('#qPlus').onclick = () => { qty = Math.min(p.stock, 20, qty + 1); $('#qVal').textContent = qty; };
    $('#addBtn').onclick = () => { addToCart(p, qty, true); openDrawer(); };
    $('#buyBtn').onclick = () => { addToCart(p, qty, true); location.hash = '#/checkout'; };
    $('#wishBtn').onclick = () => toggleWish(p).then(() => { $('#wishBtn').textContent = state.wish.has(p.id) ? 'Saved in wishlist' : 'Add to wishlist'; });
  }

  function viewCart() {
    if (!state.cart.length) {
      app.innerHTML = `<div class="wrap"><div class="empty panel sec">${ICON.cart}<h2>Your cart is empty</h2><p class="muted">Deals on top brands are waiting for you.</p><a class="btn" href="#/search?deal=true">See today's deals</a></div></div>`;
      return;
    }
    const t = cartTotals();
    app.innerHTML = `<div class="wrap"><nav class="crumbs"><a href="#/">Home</a> / <span>Cart</span></nav>
      <div class="checkout"><section class="panel" style="padding:0"><h1 style="padding:18px 18px 0;margin:0;font-size:22px">Shopping cart</h1>${shipBar(t)}${linesHtml()}</section>
      <aside class="panel" style="padding:0">${summaryHtml(t, '<a class="btn block" href="#/checkout">Proceed to checkout</a>')}</aside></div></div>`;
    bindLines(app);
  }

  function needLogin() {
    if (state.user) return false;
    location.hash = '#/login?next=' + encodeURIComponent(location.hash);
    return true;
  }

  function viewCheckout() {
    if (!state.cart.length) { location.hash = '#/cart'; return; }
    if (needLogin()) return;
    const t = cartTotals();
    const f = (id, label, attrs = '') => `<div class="field" id="f-${id}"><label for="${id}">${label}</label><input id="${id}" name="${id}" ${attrs}><div class="err"></div></div>`;
    app.innerHTML = `<div class="wrap"><nav class="crumbs"><a href="#/">Home</a> / <a href="#/cart">Cart</a> / <span>Checkout</span></nav>
      <form class="checkout" id="coForm" novalidate>
        <section class="panel"><h2 style="margin-top:0">1. Delivery address</h2>
          <div class="form-grid two">${f('fullName', 'Full name', `value="${esc(state.user.name)}" autocomplete="name"`)}${f('phone', 'Mobile number', 'placeholder="05XXXXXXXX" inputmode="tel" autocomplete="tel"')}
          ${f('city', 'City', 'value="Jeddah" autocomplete="address-level2"')}${f('district', 'District', 'placeholder="Al Rawdah"')}
          ${f('street', 'Street and building', 'placeholder="Prince Sultan Road, Building 12"')}${f('postalCode', 'Postal code', 'placeholder="23435" inputmode="numeric" maxlength="5"')}</div>
          <h2>2. Payment</h2>
          <div class="pay"><label><input type="radio" name="payment" value="cod" checked> Cash on delivery</label><label><input type="radio" name="payment" value="card"> Card (demo, nothing is charged)</label></div>
          <h2>3. Review items</h2>${state.cart.map((l) => `<div class="line" style="padding:10px 0"><img src="${l.image}" alt=""><div><h4>${esc(l.name)}</h4><span class="muted">Qty ${l.qty}</span> &middot; ${sar(l.price * l.qty)}</div></div>`).join('')}
        </section>
        <aside class="panel" style="padding:0">${summaryHtml(t, '<button class="btn block" type="submit" id="placeBtn">Place order</button><p class="muted" style="font-size:12px;margin:10px 0 0">This is a demo store. No real order is shipped and no payment is taken.</p>')}</aside>
      </form></div>`;
    $('#coForm').onsubmit = async (e) => {
      e.preventDefault();
      $$('.field').forEach((x) => { x.classList.remove('bad'); $('.err', x).textContent = ''; });
      const v = (id) => $('#' + id).value.trim();
      const body = {
        items: state.cart.map((l) => ({ productId: l.productId, qty: l.qty })),
        address: { fullName: v('fullName'), phone: v('phone'), city: v('city'), district: v('district'), street: v('street'), postalCode: v('postalCode') },
        payment: $('input[name=payment]:checked').value
      };
      $('#placeBtn').disabled = true;
      try {
        const { data } = await Api.post('/orders', body);
        state.cart = []; saveCart();
        location.hash = '#/order/' + data.orderNo;
      } catch (err) {
        $('#placeBtn').disabled = false;
        if (err.details) Object.entries(err.details).forEach(([k, msg]) => { const box = $('#f-' + k.replace('address.', '')); if (box) { box.classList.add('bad'); $('.err', box).textContent = msg; } });
        toast(err.message, { error: true });
      }
    };
  }

  async function viewOrder(no) {
    if (needLogin()) return;
    const o = (await Api.get('/orders/' + encodeURIComponent(no))).data;
    app.innerHTML = `<div class="wrap"><div class="panel order-done">
      <div class="tick">${ICON.tick}</div><h1 style="margin:12px 0 4px">Thank you, your order is placed</h1>
      <p class="muted">Order <b>${esc(o.orderNo)}</b> &middot; ${o.payment === 'cod' ? 'Cash on delivery' : 'Card'} &middot; ${plain(o.totals.total)}</p>
      <div class="track"><span class="on">Placed</span><span>Packed</span><span>Shipped</span><span>Delivered</span></div>
      <div class="order-items" style="justify-content:center">${o.items.map((i) => `<img src="${i.image}" alt="${esc(i.name)}" title="${esc(i.name)} x ${i.qty}">`).join('')}</div>
      <p>Delivering to ${esc(o.address.fullName)}, ${esc(o.address.street)}, ${esc(o.address.district)}, ${esc(o.address.city)} ${esc(o.address.postalCode)}</p>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><a class="btn" href="#/orders">View your orders</a><a class="btn ghost" href="#/">Continue shopping</a></div></div></div>`;
  }

  async function viewOrders() {
    if (needLogin()) return;
    const { data } = await Api.get('/orders');
    app.innerHTML = `<div class="wrap"><nav class="crumbs"><a href="#/">Home</a> / <span>Your orders</span></nav><h1 style="font-size:24px">Your orders</h1>
      <div class="orders-list">${data.length ? data.map((o) => `<div class="panel"><div class="order-top"><span><b>${esc(o.orderNo)}</b> &middot; ${new Date(o.createdAt.replace(' ', 'T')).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span><span class="pill">${esc(o.status)}</span><b>${plain(o.totals.total)}</b></div>
        <div class="order-items">${o.items.map((i) => `<img src="${i.image}" alt="${esc(i.name)}" title="${esc(i.name)} x ${i.qty}">`).join('')}</div><a href="#/order/${o.orderNo}" style="display:inline-block;margin-top:8px;color:#1d5fd6;font-weight:600">Order details</a></div>`).join('') : `<div class="empty panel">${ICON.cart}<h3>No orders yet</h3><a class="btn" href="#/">Start shopping</a></div>`}</div></div>`;
  }

  async function viewWishlist() {
    if (needLogin()) return;
    const { data } = await Api.get('/wishlist');
    app.innerHTML = `<div class="wrap"><nav class="crumbs"><a href="#/">Home</a> / <span>Wishlist</span></nav><h1 style="font-size:24px">Your wishlist</h1>
      ${data.length ? `<div class="grid">${data.map(card).join('')}</div>` : `<div class="empty panel">${ICON.heart}<h3>Nothing saved yet</h3><p class="muted">Tap the heart on any product to save it here.</p><a class="btn" href="#/search">Browse products</a></div>`}</div>`;
    bindCards(app);
  }

  function viewAuth(q, mode) {
    const next = new URLSearchParams(q).get('next') || '#/';
    app.innerHTML = `<div class="wrap"><div class="panel auth">
      <div class="tabs"><button data-mode="login" class="${mode === 'login' ? 'on' : ''}">Sign in</button><button data-mode="register" class="${mode === 'register' ? 'on' : ''}">Create account</button></div>
      <form id="authForm" class="form-grid" novalidate>
        ${mode === 'register' ? '<div class="field" id="f-name"><label for="name">Your name</label><input id="name" autocomplete="name"><div class="err"></div></div>' : ''}
        <div class="field" id="f-email"><label for="email">Email</label><input id="email" type="email" autocomplete="email"><div class="err"></div></div>
        <div class="field" id="f-password"><label for="password">Password</label><input id="password" type="password" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}"><div class="err"></div></div>
        <button class="btn block" type="submit">${mode === 'login' ? 'Sign in' : 'Create your account'}</button>
      </form>
      <div class="demo-logins"><b>Demo accounts</b><br>Customer: demo@bazaro.test / demo1234<br>Admin: admin@bazaro.test / admin123
        <div class="row"><button class="btn sm ghost" data-demo="demo@bazaro.test|demo1234">Use customer</button><button class="btn sm ghost" data-demo="admin@bazaro.test|admin123">Use admin</button></div></div>
    </div></div>`;
    $$('[data-mode]').forEach((b) => b.onclick = () => viewAuth(q, b.dataset.mode));
    $$('[data-demo]').forEach((b) => b.onclick = () => { const [e, p] = b.dataset.demo.split('|'); if (mode !== 'login') viewAuth(q, 'login'); $('#email').value = e; $('#password').value = p; $('#authForm').requestSubmit(); });
    $('#authForm').onsubmit = async (e) => {
      e.preventDefault();
      $$('.field').forEach((x) => { x.classList.remove('bad'); $('.err', x).textContent = ''; });
      const body = { email: $('#email').value, password: $('#password').value };
      if (mode === 'register') body.name = $('#name').value;
      try {
        const res = await Api.post('/auth/' + mode, body);
        Api.token.set(res.token);
        await afterLogin(res.user, true);
        toast('Welcome, ' + res.user.name.split(' ')[0]);
        location.hash = res.user.role === 'admin' && next === '#/' ? '#/admin' : next;
      } catch (err) {
        if (err.details) Object.entries(err.details).forEach(([k, msg]) => { const box = $('#f-' + k); if (box) { box.classList.add('bad'); $('.err', box).textContent = msg; } });
        toast(err.message, { error: true });
      }
    };
  }

  function viewAccount() {
    if (needLogin()) return;
    const u = state.user;
    app.innerHTML = `<div class="wrap"><div class="panel auth"><h1 style="margin-top:0">Hello, ${esc(u.name)}</h1><p class="muted">${esc(u.email)} &middot; ${u.role === 'admin' ? 'Store admin' : 'Customer'}</p>
      <div class="form-grid"><a class="btn ghost block" href="#/orders">Your orders</a><a class="btn ghost block" href="#/wishlist">Your wishlist</a>${u.role === 'admin' ? '<a class="btn ghost block" href="#/admin">Admin panel</a>' : ''}<button class="btn dark block" id="logout">Sign out</button></div></div></div>`;
    $('#logout').onclick = () => { Api.token.clear(); state.user = null; state.wish = new Set(); updateBadges(); toast('Signed out'); location.hash = '#/'; };
  }

  // ---------- Admin ----------
  async function viewAdmin() {
    if (needLogin()) return;
    if (state.user.role !== 'admin') {
      app.innerHTML = `<div class="wrap"><div class="empty panel sec">${ICON.shield}<h2>Admins only</h2><p class="muted">Sign in with the demo admin account to manage products.</p><a class="btn" href="#/login?next=%23%2Fadmin">Sign in as admin</a></div></div>`;
      return;
    }
    const [stats, list, orders] = await Promise.all([Api.get('/admin/stats'), Api.get('/products?limit=60&sort=newest'), Api.get('/admin/orders')]);
    list.data.forEach((p) => productCache.set(p.id, p));
    app.innerHTML = `<div class="wrap"><nav class="crumbs"><a href="#/">Home</a> / <span>Admin</span></nav>
      <div class="sec-head"><h1 style="margin:0;font-size:24px">Store admin</h1><button class="btn" id="newProduct">+ Add product</button></div>
      <div class="stats"><div class="panel stat"><small>Products</small><b>${stats.products}</b></div><div class="panel stat"><small>Low stock</small><b>${stats.lowStock}</b></div><div class="panel stat"><small>Orders</small><b>${stats.orders}</b></div><div class="panel stat"><small>Revenue</small><b>${plain(stats.revenue)}</b></div></div>
      <div class="panel table-wrap"><table><thead><tr><th></th><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Deal</th><th></th></tr></thead><tbody>
      ${list.data.map((p) => `<tr><td><img src="${p.images[0]}" alt=""></td><td><a href="#/p/${p.slug}"><b>${esc(p.name)}</b></a><br><span class="muted">${esc(p.brand)}</span></td><td>${esc(p.categoryName)}</td><td>${plain(p.price)}</td><td><span class="pill ${p.stock < 5 ? 'warn' : ''}">${p.stock}</span></td><td>${p.deal ? 'Yes' : ''}</td>
        <td><button class="btn sm ghost" data-edit="${p.id}">Edit</button> <button class="btn sm ghost" data-delete="${p.id}">Delete</button></td></tr>`).join('')}
      </tbody></table></div>
      <h2 style="margin:24px 0 10px">Recent orders</h2>
      <div class="panel table-wrap">${orders.data.length ? `<table><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead><tbody>${orders.data.map((o) => `<tr><td><b>${esc(o.orderNo)}</b></td><td>${esc(o.customer)}</td><td>${o.items}</td><td>${plain(o.total)}</td><td>${o.payment === 'cod' ? 'Cash' : 'Card'}</td><td><span class="pill">${esc(o.status)}</span></td></tr>`).join('')}</tbody></table>` : '<p class="muted" style="padding:16px;margin:0">No orders yet. Place one from the storefront and it shows up here.</p>'}</div></div>`;
    $('#newProduct').onclick = () => productForm();
    $$('[data-edit]').forEach((b) => b.onclick = () => productForm(productCache.get(+b.dataset.edit)));
    $$('[data-delete]').forEach((b) => b.onclick = async () => {
      if (!confirm('Delete this product?')) return;
      await Api.del('/admin/products/' + b.dataset.delete);
      toast('Product deleted'); viewAdmin();
    });
  }

  function productForm(p) {
    const images = [...new Set([...productCache.values()].flatMap((x) => x.images.slice(0, 1)))];
    const m = document.createElement('div');
    m.className = 'modal';
    const fld = (id, label, val, attrs = '') => `<div class="field" id="pf-${id}"><label for="p-${id}">${label}</label><input id="p-${id}" value="${esc(val == null ? '' : val)}" ${attrs}><div class="err"></div></div>`;
    m.innerHTML = `<form class="panel" id="pForm" novalidate><div class="sec-head"><h2 style="margin:0">${p ? 'Edit product' : 'Add product'}</h2><button type="button" class="ico-btn" id="pClose" aria-label="Close">${ICON.close}</button></div>
      <div class="form-grid two">${fld('name', 'Name', p && p.name)}${fld('brand', 'Brand', p && p.brand)}
        <div class="field" id="pf-category"><label for="p-category">Category</label><select id="p-category">${state.categories.map((c) => `<option value="${c.slug}" ${p && p.category === c.slug ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select><div class="err"></div></div>
        <div class="field"><label for="p-image">Image</label><select id="p-image">${images.map((src) => `<option ${p && p.images[0] === src ? 'selected' : ''}>${src}</option>`).join('')}</select></div>
        ${fld('price', 'Price (SAR)', p && p.price, 'type="number" min="0" step="0.01"')}${fld('mrp', 'List price / MRP (SAR)', p && p.mrp, 'type="number" min="0" step="0.01"')}
        ${fld('stock', 'Stock', p ? p.stock : 10, 'type="number" min="0"')}<div class="field"><label><input type="checkbox" id="p-deal" ${p && p.deal ? 'checked' : ''}> Show in deals</label></div></div>
      <div class="field" style="margin-top:12px"><label for="p-description">Description</label><textarea id="p-description" rows="3">${esc(p ? p.description : '')}</textarea></div>
      <button class="btn block" style="margin-top:14px" type="submit">${p ? 'Save changes' : 'Create product'}</button></form>`;
    document.body.appendChild(m);
    const close = () => m.remove();
    $('#pClose', m).onclick = close;
    m.onclick = (e) => { if (e.target === m) close(); };
    $('#pForm', m).onsubmit = async (e) => {
      e.preventDefault();
      $$('.field', m).forEach((x) => { x.classList.remove('bad'); const er = $('.err', x); if (er) er.textContent = ''; });
      const val = (id) => $('#p-' + id, m).value.trim();
      const img = val('image');
      const body = { name: val('name'), brand: val('brand'), category: val('category'), price: +val('price'), mrp: +val('mrp'), stock: parseInt(val('stock'), 10), description: val('description'), deal: $('#p-deal', m).checked };
      if (!p) { body.images = [img]; body.highlights = []; } else if (img !== p.images[0]) body.images = [img, ...p.images.filter((x) => x !== img)];
      try {
        if (p) await Api.patch('/admin/products/' + p.id, body); else await Api.post('/admin/products', body);
        close(); toast(p ? 'Product updated' : 'Product created'); viewAdmin();
      } catch (err) {
        if (err.details) Object.entries(err.details).forEach(([k, msg]) => { const box = $('#pf-' + k, m); if (box) { box.classList.add('bad'); $('.err', box).textContent = msg; } });
        toast(err.message, { error: true });
      }
    };
  }

  // ---------- Router ----------
  async function route() {
    clearTimers();
    closeDrawer(); closeMenu(); $('#mega').hidden = true;
    const [path, q = ''] = location.hash.slice(1).split('?');
    const parts = path.split('/').filter(Boolean);
    window.scrollTo({ top: 0, behavior: 'instant' });
    try {
      if (!parts.length) await viewHome();
      else if (parts[0] === 'search') await viewSearch(q);
      else if (parts[0] === 'p') await viewProduct(parts[1]);
      else if (parts[0] === 'cart') viewCart();
      else if (parts[0] === 'checkout') viewCheckout();
      else if (parts[0] === 'order') await viewOrder(parts[1]);
      else if (parts[0] === 'orders') await viewOrders();
      else if (parts[0] === 'wishlist') await viewWishlist();
      else if (parts[0] === 'login') viewAuth(q, 'login');
      else if (parts[0] === 'register') viewAuth(q, 'register');
      else if (parts[0] === 'account') viewAccount();
      else if (parts[0] === 'admin') await viewAdmin();
      else app.innerHTML = `<div class="wrap"><div class="empty panel sec"><h2>Page not found</h2><a class="btn" href="#/">Go home</a></div></div>`;
    } catch (err) {
      if (err.status === 401) { Api.token.clear(); state.user = null; updateBadges(); location.hash = '#/login?next=' + encodeURIComponent(location.hash); return; }
      app.innerHTML = `<div class="wrap"><div class="empty panel sec"><h2>${err.status === 404 ? 'Not found' : 'Something went wrong'}</h2><p class="muted">${esc(err.message)}</p><a class="btn" href="#/">Go home</a></div></div>`;
    }
    const s = new URLSearchParams(q);
    $('#searchInput').value = parts[0] === 'search' ? s.get('q') || '' : '';
    $('#searchCat').value = parts[0] === 'search' ? s.get('category') || '' : '';
  }

  // ---------- Header, menu and search ----------
  function openMenu() { $('#menu').hidden = false; $('#burger').setAttribute('aria-expanded', 'true'); document.body.style.overflow = 'hidden'; }
  function closeMenu() { $('#menu').hidden = true; $('#burger').setAttribute('aria-expanded', 'false'); document.body.style.overflow = ''; }

  function buildChrome() {
    const cats = state.categories;
    $('#searchCat').innerHTML = '<option value="">All</option>' + cats.map((c) => `<option value="${c.slug}">${esc(c.name)}</option>`).join('');
    $('#subnavLinks').innerHTML = `<a href="#/search?deal=true" class="hot">Today's deals</a>` + cats.map((c) => `<a href="#/search?category=${c.slug}">${esc(c.name)}</a>`).join('') + '<a href="#/admin">Sell on Bazaro</a>';
    $('#ftrCats').innerHTML = cats.map((c) => `<a href="#/search?category=${c.slug}">${esc(c.name)}</a>`).join('');
    $('#menuBody').innerHTML = `<h6>Shop by category</h6>${cats.map((c) => `<a href="#/search?category=${c.slug}"><img src="${catImage[c.slug]}" alt="">${esc(c.name)}</a>`).join('')}
      <h6>Highlights</h6><a href="#/search?deal=true">Today's deals</a><a href="#/search?sort=rating">Top rated</a><a href="#/search?maxPrice=100">Under SAR 100</a>
      <h6>Your account</h6><a href="#/account">Account</a><a href="#/orders">Orders</a><a href="#/wishlist">Wishlist</a><a href="#/cart">Cart</a><a href="#/admin">Admin panel</a>`;
    Api.get('/products?limit=60').then((res) => {
      $('#megaGrid').innerHTML = cats.map((c) => `<div><h5><img src="${catImage[c.slug]}" alt="">${esc(c.name)}</h5>${res.data.filter((p) => p.category === c.slug).slice(0, 5).map((p) => `<a href="#/p/${p.slug}">${esc(p.name)}</a>`).join('')}<a href="#/search?category=${c.slug}" style="color:#1d5fd6;font-weight:600">See all</a></div>`).join('');
    });
    $('#allBtn').onclick = (e) => { e.stopPropagation(); const m = $('#mega'); m.hidden = !m.hidden; $('#allBtn').setAttribute('aria-expanded', String(!m.hidden)); };
    document.addEventListener('click', (e) => { if (!e.target.closest('#mega') && !e.target.closest('#allBtn')) $('#mega').hidden = true; if (!e.target.closest('.search')) $('#suggest').innerHTML = ''; });
    $('#burger').onclick = openMenu;
    $('#menuClose').onclick = closeMenu;
    $('#cartBtn').onclick = openDrawer;
    $('#drawerClose').onclick = closeDrawer;
    $('#shade').onclick = closeDrawer;
    $('#backTop').onclick = (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeDrawer(); closeMenu(); $('#mega').hidden = true; } });

    // Search with live suggestions and arrow key support.
    const input = $('#searchInput'), box = $('#suggest');
    let t, idx = -1;
    input.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(async () => {
        const { data } = await Api.get('/products/suggest?q=' + encodeURIComponent(input.value));
        idx = -1;
        box.innerHTML = data.map((s) => `<li><a href="#/p/${s.slug}"><span>${esc(s.name)}</span><small>${esc(s.category)}</small></a></li>`).join('');
      }, 150);
    });
    input.addEventListener('keydown', (e) => {
      const items = $$('a', box);
      if (!items.length || !['ArrowDown', 'ArrowUp'].includes(e.key)) return;
      e.preventDefault();
      idx = (idx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((a, k) => a.classList.toggle('on', k === idx));
      input.value = items[idx].querySelector('span').textContent;
    });
    box.addEventListener('click', () => { box.innerHTML = ''; });
    $('#searchForm').onsubmit = (e) => {
      e.preventDefault();
      const active = $('a.on', box);
      box.innerHTML = '';
      if (active) { location.hash = active.getAttribute('href'); return; }
      const p = new URLSearchParams();
      if (input.value.trim()) p.set('q', input.value.trim());
      if ($('#searchCat').value) p.set('category', $('#searchCat').value);
      location.hash = '#/search?' + p.toString();
      input.blur();
    };
  }

  async function afterLogin(user, mergeCart) {
    state.user = user;
    try {
      const [wish, cart] = await Promise.all([Api.get('/wishlist'), Api.get('/cart')]);
      state.wish = new Set(wish.data.map((p) => p.id));
      // Merge what was in the guest cart with the cart saved on the account.
      if (mergeCart || !state.cart.length) {
        cart.items.forEach((i) => {
          const line = state.cart.find((l) => l.productId === i.productId);
          if (line) line.qty = Math.max(line.qty, i.qty);
          else state.cart.push({ productId: i.productId, qty: i.qty, name: i.product.name, price: i.product.price, mrp: i.product.mrp, image: i.product.images[0], slug: i.product.slug, stock: i.product.stock });
        });
      }
      saveCart();
    } catch (e) { /* the shop still works if this fails */ }
    updateBadges();
  }

  async function start() {
    await Api.init();
    $('#modeNote').textContent = Api.mode === 'server' ? 'Running on the Node.js API' : 'Static demo: your data stays in this browser';
    state.categories = (await Api.get('/categories')).data;
    buildChrome();
    if (Api.token.get()) {
      try { await afterLogin((await Api.get('/auth/me')).user, false); } catch (e) { Api.token.clear(); }
    }
    updateBadges();
    renderDrawer();
    window.addEventListener('hashchange', route);
    route();
  }
  start();
})();
