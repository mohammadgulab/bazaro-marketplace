const { makeShop } = require('./helpers');

let shop;
beforeAll(() => { shop = makeShop(); });

describe('catalog', () => {
  test('health check', async () => {
    const res = await shop.api.get('/api/health');
    expect(res.body).toEqual({ ok: true, mode: 'server' });
  });

  test('lists categories with product counts', async () => {
    const res = await shop.api.get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.body.data.find((c) => c.slug === 'electronics').count).toBe(7);
  });

  test('lists products with paging and facets', async () => {
    const res = await shop.api.get('/api/products?limit=5');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(5);
    expect(res.body.total).toBe(24);
    expect(res.body.pages).toBe(5);
    expect(res.body.facets.brands.length).toBeGreaterThan(5);
  });

  test('searches by name or brand', async () => {
    const res = await shop.api.get('/api/products?q=headphones');
    expect(res.body.data.map((p) => p.slug)).toContain('headphones');
  });

  test('filters by category, price and rating', async () => {
    const res = await shop.api.get('/api/products?category=electronics&maxPrice=200&rating=4.4');
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const p of res.body.data) {
      expect(p.category).toBe('electronics');
      expect(p.price).toBeLessThanOrEqual(200);
      expect(p.rating).toBeGreaterThanOrEqual(4.4);
    }
  });

  test('sorts by price low to high', async () => {
    const prices = (await shop.api.get('/api/products?sort=price_asc&limit=60')).body.data.map((p) => p.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  test('deals only', async () => {
    const res = await shop.api.get('/api/products?deal=true');
    expect(res.body.data.every((p) => p.deal)).toBe(true);
  });

  test('rejects a bad sort value', async () => {
    const res = await shop.api.get('/api/products?sort=cheapest');
    expect(res.status).toBe(400);
    expect(res.body.details.sort).toBeDefined();
  });

  test('search suggestions', async () => {
    const res = await shop.api.get('/api/products/suggest?q=wat');
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  test('product page has reviews and related products', async () => {
    const res = await shop.api.get('/api/products/smartwatch');
    expect(res.status).toBe(200);
    expect(res.body.data.discount).toBe(33);
    expect(res.body.data.reviewList).toHaveLength(3);
    expect(res.body.data.related.every((p) => p.category === 'electronics')).toBe(true);
  });

  test('unknown product is a 404', async () => {
    const res = await shop.api.get('/api/products/does-not-exist');
    expect(res.status).toBe(404);
  });

  test('unknown API route is a JSON 404', async () => {
    const res = await shop.api.get('/api/nothing-here');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/No route/);
  });
});
