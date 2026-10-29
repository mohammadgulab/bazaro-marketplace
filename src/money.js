// Money helpers. Prices in SAR already include 15% VAT, like most Saudi shops.

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Works out the order totals from cart lines [{ price, qty }].
function orderTotals(lines, { freeShippingFrom = 200, shippingFee = 15, vatRate = 0.15 } = {}) {
  const subtotal = round2(lines.reduce((sum, l) => sum + l.price * l.qty, 0));
  const shipping = subtotal === 0 || subtotal >= freeShippingFrom ? 0 : shippingFee;
  const total = round2(subtotal + shipping);
  // VAT is already inside the price, so we only show how much of the total it is.
  const vatIncluded = round2(total - total / (1 + vatRate));
  return { subtotal, shipping, vatIncluded, total };
}

const discountPercent = (price, mrp) => (mrp > price ? Math.round((1 - price / mrp) * 100) : 0);

module.exports = { round2, orderTotals, discountPercent };
