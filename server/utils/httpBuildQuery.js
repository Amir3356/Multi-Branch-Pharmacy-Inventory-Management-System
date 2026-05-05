/** PHP's http_build_query: urlencode() each value (spaces as "+", "~" encoded) */
export function httpBuildQuery(params) {
  const encode = (value) =>
    encodeURIComponent(String(value))
      .replace(/[!'()*~]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
      .replace(/%20/g, '+')
  return Object.entries(params)
    .map(([key, value]) => `${encode(key)}=${encode(value)}`)
    .join('&')
}
