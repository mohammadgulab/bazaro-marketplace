const { makeShop } = require('./helpers');

let shop;
let admin;
let customer;
const newProduct = { name: 'Desert Trail Hiking Boots', brand: 'Trail Co', category: 'fashion', price: 279, mrp: 349, stock: 10, images: ['img/sneakers-1.webp'], highlights: ['Waterproof'] };

beforeAll(async () => {
  shop = makeShop();
  admin = await shop.login('admin@bazaro.test', 'admin123');
  customer = await shop.login('demo@bazaro.test', 'demo1234');
});

describe('admin', () => {
  test('customers cannot use admin routes', async () => {
    const res = await shop.api.get('/api/admin/stats').set('Authorization', `Bearer ${customer}`);
    expect(res.status).toBe(403);
  });

  test('stats', async () => {
    const res = await shop.api.get('/api/admin/stats').set('Authorization', `Bearer ${admin}`);
    expect(res.body).toMatchObject({ products: 24, customers: 1, orders: 0 });
  });

  let created;
  test('creates a product', async () => {
    const res = await shop.api.post('/api/admin/products').set('Authorization', `Bearer ${admin}`).send(newProduct);
    expect(res.status).toBe(201);
    created = res.body.data;
    expect(created.slug).toBe('desert-trail-hiking-boots');
    expect(created.discount).toBe(20);
    const listed = await shop.api.get('/api/products?q=hiking');
    expect(listed.body.total).toBe(1);
  });

  test('refuses a price above the MRP', async () => {
    const res = await shop.api.post('/api/admin/products').set('Authorization', `Bearer ${admin}`).send({ ...newProduct, price: 400 });
    expect(res.status).toBe(400);
    expect(res.body.details.mrp).toBeDefined();
  });

  test('refuses an unknown category', async () => {
    const res = await shop.api.post('/api/admin/products').set('Authorization', `Bearer ${admin}`).send({ ...newProduct, category: 'cars' });
    expect(res.status).toBe(400);
  });

  test('updates a product', async () => {
    const res = await shop.api.patch(`/api/admin/products/${created.id}`).set('Authorization', `Bearer ${admin}`).send({ price: 249, deal: true });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ price: 249, deal: true, name: newProduct.name });
  });

  test('deletes a product', async () => {
    expect((await shop.api.delete(`/api/admin/products/${created.id}`).set('Authorization', `Bearer ${admin}`)).status).toBe(204);
    expect((await shop.api.delete(`/api/admin/products/${created.id}`).set('Authorization', `Bearer ${admin}`)).status).toBe(404);
  });
});
