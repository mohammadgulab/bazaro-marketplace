const { makeShop } = require('./helpers');

let shop;
let token;
const address = { fullName: 'Demo Customer', phone: '0551234567', city: 'Jeddah', district: 'Al Rawdah', street: 'Prince Sultan Road 12', postalCode: '23435' };
const idOf = (slug) => shop.db.prepare('SELECT id FROM products WHERE slug = ?').get(slug).id;
const auth = () => ({ Authorization: `Bearer ${token}` });

beforeAll(async () => {
  shop = makeShop();
  token = await shop.login('demo@bazaro.test', 'demo1234');
});

describe('cart', () => {
  test('saves the cart and returns totals', async () => {
    const res = await shop.api.put('/api/cart').set(auth()).send({ items: [{ productId: idOf('tshirt'), qty: 2 }, { productId: 99999, qty: 1 }] });
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.totals).toMatchObject({ subtotal: 78, shipping: 15, total: 93 });
  });

  test('rejects a zero quantity', async () => {
    const res = await shop.api.put('/api/cart').set(auth()).send({ items: [{ productId: idOf('tshirt'), qty: 0 }] });
    expect(res.status).toBe(400);
  });
});

describe('wishlist', () => {
  test('toggle adds then removes', async () => {
    const id = idOf('perfume');
    expect((await shop.api.post(`/api/wishlist/${id}/toggle`).set(auth())).body.saved).toBe(true);
    expect((await shop.api.get('/api/wishlist').set(auth())).body.data[0].slug).toBe('perfume');
    expect((await shop.api.post(`/api/wishlist/${id}/toggle`).set(auth())).body.saved).toBe(false);
  });
});

describe('checkout', () => {
  test('places an order with server prices and takes stock', async () => {
    const id = idOf('headphones');
    const stockBefore = shop.db.prepare('SELECT stock FROM products WHERE id = ?').get(id).stock;
    const res = await shop.api.post('/api/orders').set(auth())
      .send({ items: [{ productId: id, qty: 1, price: 1 }], address, payment: 'cod' });
    expect(res.status).toBe(201);
    expect(res.body.data.orderNo).toMatch(/^BZ-\d{4}-00001$/);
    expect(res.body.data.totals.total).toBe(259); // real price, the fake price from the body is ignored
    expect(shop.db.prepare('SELECT stock FROM products WHERE id = ?').get(id).stock).toBe(stockBefore - 1);
  });

  test('order history and order details', async () => {
    const list = await shop.api.get('/api/orders').set(auth());
    expect(list.body.data).toHaveLength(1);
    const one = await shop.api.get(`/api/orders/${list.body.data[0].orderNo}`).set(auth());
    expect(one.body.data.items[0].name).toMatch(/Headphones/);
  });

  test('cannot buy more than the stock', async () => {
    const res = await shop.api.post('/api/orders').set(auth()).send({ items: [{ productId: idOf('smartwatch'), qty: 20 }], address, payment: 'card' });
    expect(res.status).toBe(409);
  });

  test('validates the Saudi phone and postal code', async () => {
    const res = await shop.api.post('/api/orders').set(auth())
      .send({ items: [{ productId: idOf('tshirt'), qty: 1 }], address: { ...address, phone: '12345', postalCode: '1' }, payment: 'cod' });
    expect(res.status).toBe(400);
    expect(res.body.details).toHaveProperty(['address.phone']);
    expect(res.body.details).toHaveProperty(['address.postalCode']);
  });

  test('empty cart cannot be checked out', async () => {
    const res = await shop.api.post('/api/orders').set(auth()).send({ items: [], address, payment: 'cod' });
    expect(res.status).toBe(400);
  });
});
