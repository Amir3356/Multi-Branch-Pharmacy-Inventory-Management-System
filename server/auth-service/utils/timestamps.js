/** Now, to the second: Laravel stored timestamp(0) columns as 'Y-m-d H:i:s' (cut, not rounded as Postgres would) */
export const nowSeconds = () => new Date(Math.floor(Date.now() / 1000) * 1000)

export const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60_000)
