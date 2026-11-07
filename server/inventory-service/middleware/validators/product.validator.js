import { gt, max, numeric, required, validateRules } from '../../utils/rules.js'
import { z } from '../../utils/index.js'

/** UpdateSellingPriceRequest (also used when a transfer is received) */
export const SELLING_PRICE_RULES = (() => {
  const message = 'Enter a selling price greater than 0'
  return { sellingPrice: [required(message), numeric(message), gt(0, message), max(10000000, message)] }
})()

/** PUT /products/:product/selling-price → req.validated { sellingPrice } */
export async function validateSellingPrice(req, res, next) {
  req.validated = await validateRules(SELLING_PRICE_RULES, req.body)
  next()
}

// Trimmed, inner spaces collapsed
const cleanText = (field, limit) =>
  z
    .string({ error: `Enter a ${field}.` })
    .transform((value) => value.trim().replace(/\s+/g, ' '))
    .pipe(z.string().min(1, { error: `Enter a ${field}.` }).max(limit, { error: `Keep the ${field} to ${limit} characters or fewer.` }))

/** POST /products and PATCH /products/:product (Purchase Officer's Add Category & Product, on the Procurement page) */
export const productSchema = z.object({
  name: cleanText('product name', 255),
  category: z.string({ error: 'Select a category.' }).trim().min(1, { error: 'Select a category.' }),
})

/** GET /internal/products/category-count?category= */
export const categoryCountQuery = z.object({ category: z.string({ error: 'The category field is required.' }).min(1) })
