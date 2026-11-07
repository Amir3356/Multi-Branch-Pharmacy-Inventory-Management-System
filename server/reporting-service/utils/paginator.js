/**
 * Laravel's paginated resource collection: { data, links, meta } as LengthAwarePaginator + PaginatedResourceResponse
 * built it (the URL window with 3 pages on each side, "&laquo; Previous" / "Next &raquo;" labels). Laravel only
 * puts `page` in the links, not the other query parameters.
 */
export function paginate({ items, total, page, perPage, path }) {
  const lastPage = Math.max(Math.ceil(total / perPage), 1)
  const url = (n) => `${path}?page=${n}`
  const range = (from, to) => {
    const pages = {}
    for (let n = from; n <= to; n++) pages[n] = url(n)
    return pages
  }
  const prev = page > 1 ? url(page - 1) : null
  const next = page < lastPage ? url(page + 1) : null
  const from = items.length ? (page - 1) * perPage + 1 : null
  const to = items.length ? from + items.length - 1 : null

  // UrlWindow::get with onEachSide = 3
  const onEachSide = 3
  let window
  if (lastPage < onEachSide * 2 + 8) {
    window = { first: range(1, lastPage), slider: null, last: null }
  } else {
    const size = onEachSide + 4
    const start = range(1, 2)
    const finish = range(lastPage - 1, lastPage)
    if (page <= size) window = { first: range(1, size + onEachSide), slider: null, last: finish }
    else if (page > lastPage - size) window = { first: start, slider: null, last: range(lastPage - (size + (onEachSide - 1)), lastPage) }
    else window = { first: start, slider: range(page - onEachSide, page + onEachSide), last: finish }
  }
  const elements = [window.first, window.slider ? '...' : null, window.slider, window.last ? '...' : null, window.last].filter(Boolean)

  const links = [{ url: prev, label: '&laquo; Previous', page: page > 1 ? page - 1 : null, active: false }]
  for (const element of elements) {
    if (element === '...') {
      links.push({ url: null, label: '...', active: false })
      continue
    }
    for (const [n, link] of Object.entries(element)) links.push({ url: link, label: String(n), page: Number(n), active: Number(n) === page })
  }
  links.push({ url: next, label: 'Next &raquo;', page: page < lastPage ? page + 1 : null, active: false })

  return {
    data: items,
    links: { first: url(1), last: url(lastPage), prev, next },
    meta: { current_page: page, from, last_page: lastPage, links, path, per_page: perPage, to, total },
  }
}
