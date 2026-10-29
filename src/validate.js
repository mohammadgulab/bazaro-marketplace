const { z } = require('zod');
const { HttpError } = require('./errors');

// Runs a zod schema against req.body / req.query and turns problems into a clean 400.
function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const fields = {};
    for (const issue of result.error.issues) {
      fields[issue.path.join('.') || 'body'] = issue.message;
    }
    throw new HttpError(400, 'Validation failed', fields);
  }
  return result.data;
}

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100)
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required')
});

const productQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(50).optional(),
  brand: z.string().trim().max(200).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
  deal: z.enum(['true', 'false']).optional(),
  inStock: z.enum(['true', 'false']).optional(),
  sort: z.enum(['popular', 'price_asc', 'price_desc', 'rating', 'newest', 'discount']).default('popular'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(60).default(24)
});

const cartSchema = z.object({
  items: z.array(z.object({
    productId: z.number().int().positive(),
    qty: z.number().int().min(1).max(20)
  })).max(50)
});

const addressSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required').max(80),
  phone: z.string().trim().regex(/^(\+966|0)?5\d{8}$/, 'Enter a Saudi mobile number like 05XXXXXXXX'),
  city: z.string().trim().min(2, 'City is required').max(50),
  district: z.string().trim().min(2, 'District is required').max(80),
  street: z.string().trim().min(3, 'Street is required').max(120),
  postalCode: z.string().trim().regex(/^\d{5}$/, 'Postal code has 5 digits')
});

const checkoutSchema = z.object({
  items: cartSchema.shape.items.min(1, 'Your cart is empty'),
  address: addressSchema,
  payment: z.enum(['cod', 'card'])
});

const productSchema = z.object({
  name: z.string().trim().min(3).max(120),
  brand: z.string().trim().min(1).max(60),
  category: z.string().trim().min(1),
  price: z.number().positive(),
  mrp: z.number().positive(),
  stock: z.number().int().min(0),
  description: z.string().trim().max(2000).default(''),
  highlights: z.array(z.string().trim().max(120)).max(8).default([]),
  images: z.array(z.string().trim().max(300)).min(1, 'At least one image').max(6),
  seller: z.string().trim().max(60).default('Bazaro Retail'),
  deal: z.boolean().default(false)
}).refine((p) => p.mrp >= p.price, { message: 'MRP must be equal to or higher than the price', path: ['mrp'] });

module.exports = {
  z, parse, registerSchema, loginSchema, productQuerySchema, cartSchema, checkoutSchema, productSchema,
  productUpdateSchema: productSchema.innerType().partial()
};
