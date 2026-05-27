import { notFound, z } from '../../utils/index.js'

/** A category's name: trimmed, inner spaces collapsed, 1 to 120 characters */
export const categorySchema = z.object({
  name: z
    .string({ error: 'Enter a category name.' })
    .transform((value) => value.trim().replace(/\s+/g, ' '))
    .pipe(z.string().min(1, { error: 'Enter a category name.' }).max(120, { error: 'Keep the name to 120 characters or fewer.' })),
})

/** :category must be a positive whole number; leaves it on req.categoryId */
export function bindCategoryId(req, res, next) {
  const id = Number(req.params.category)
  if (!Number.isSafeInteger(id) || id < 1) return next(notFound('That category no longer exists.'))
  req.categoryId = id
  next()
}
