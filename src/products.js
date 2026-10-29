const { discountPercent } = require('./money');

// Shared SQL and row mapping for products, used by several routers.
const SELECT_PRODUCT = `
  SELECT p.*, c.slug AS category_slug, c.name AS category_name
  FROM products p JOIN categories c ON c.id = p.category_id`;

function toProduct(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    brand: row.brand,
    category: row.category_slug,
    categoryName: row.category_name,
    price: row.price,
    mrp: row.mrp,
    discount: discountPercent(row.price, row.mrp),
    rating: row.rating,
    reviews: row.reviews_count,
    stock: row.stock,
    description: row.description,
    highlights: JSON.parse(row.highlights),
    images: JSON.parse(row.images),
    seller: row.seller,
    deal: Boolean(row.is_deal),
    createdAt: row.created_at
  };
}

const SORTS = {
  popular: 'p.reviews_count DESC',
  price_asc: 'p.price ASC',
  price_desc: 'p.price DESC',
  rating: 'p.rating DESC, p.reviews_count DESC',
  newest: 'p.id DESC',
  discount: '(1 - p.price / p.mrp) DESC'
};

// Builds a WHERE clause from the listing filters. Values always go in as parameters.
function buildFilters(q) {
  const where = [];
  const params = {};
  if (q.q) {
    where.push('(p.name LIKE @q OR p.brand LIKE @q OR c.name LIKE @q)');
    params.q = `%${q.q}%`;
  }
  if (q.category) { where.push('c.slug = @category'); params.category = q.category; }
  if (q.brand) {
    const brands = q.brand.split(',').map((b) => b.trim()).filter(Boolean);
    where.push(`p.brand IN (${brands.map((_, i) => '@b' + i).join(',')})`);
    brands.forEach((b, i) => { params['b' + i] = b; });
  }
  if (q.minPrice !== undefined) { where.push('p.price >= @minPrice'); params.minPrice = q.minPrice; }
  if (q.maxPrice !== undefined) { where.push('p.price <= @maxPrice'); params.maxPrice = q.maxPrice; }
  if (q.rating !== undefined) { where.push('p.rating >= @rating'); params.rating = q.rating; }
  if (q.deal === 'true') where.push('p.is_deal = 1');
  if (q.inStock === 'true') where.push('p.stock > 0');
  return { sql: where.length ? ' WHERE ' + where.join(' AND ') : '', params };
}

module.exports = { SELECT_PRODUCT, toProduct, SORTS, buildFilters };
