const { makeShop } = require('./helpers');

let shop;
beforeAll(() => { shop = makeShop(); });

describe('auth', () => {
  test('register returns a token and the user', async () => {
    const res = await shop.api.post('/api/auth/register').send({ name: 'Ali Hassan', email: 'Ali@Example.com', password: 'secret12' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user).toMatchObject({ email: 'ali@example.com', role: 'customer' });
  });

  test('duplicate email is refused', async () => {
    const res = await shop.api.post('/api/auth/register').send({ name: 'Ali Again', email: 'ali@example.com', password: 'secret12' });
    expect(res.status).toBe(409);
  });

  test('register validates fields', async () => {
    const res = await shop.api.post('/api/auth/register').send({ name: 'A', email: 'nope', password: '1' });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.details)).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });

  test('login with the right password', async () => {
    const res = await shop.api.post('/api/auth/login').send({ email: 'demo@bazaro.test', password: 'demo1234' });
    expect(res.status).toBe(200);
    const me = await shop.api.get('/api/auth/me').set('Authorization', `Bearer ${res.body.token}`);
    expect(me.body.user.name).toBe('Demo Customer');
  });

  test('wrong password is a 401', async () => {
    const res = await shop.api.post('/api/auth/login').send({ email: 'demo@bazaro.test', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  test('protected routes need a token', async () => {
    expect((await shop.api.get('/api/auth/me')).status).toBe(401);
    expect((await shop.api.get('/api/orders').set('Authorization', 'Bearer not-a-token')).status).toBe(401);
  });

  test('broken JSON body is a 400', async () => {
    const res = await shop.api.post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(res.status).toBe(400);
  });
});
