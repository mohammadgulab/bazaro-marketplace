const { orderTotals, discountPercent } = require('../src/money');

describe('orderTotals', () => {
  test('adds shipping under the free delivery limit', () => {
    const t = orderTotals([{ price: 39, qty: 2 }]);
    expect(t).toEqual({ subtotal: 78, shipping: 15, total: 93, vatIncluded: 12.13 });
  });

  test('free shipping from SAR 200', () => {
    expect(orderTotals([{ price: 100, qty: 2 }]).shipping).toBe(0);
  });

  test('empty cart costs nothing', () => {
    expect(orderTotals([])).toEqual({ subtotal: 0, shipping: 0, total: 0, vatIncluded: 0 });
  });

  test('rounds to halalas', () => {
    expect(orderTotals([{ price: 0.1, qty: 3 }]).subtotal).toBe(0.3);
  });
});

test('discountPercent', () => {
  expect(discountPercent(149, 229)).toBe(35);
  expect(discountPercent(50, 50)).toBe(0);
});
