/** Blade's {{ }}: PHP's htmlspecialchars (ENT_QUOTES) */
export const e = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

/**
 * Blade's @json(): json_encode with JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT, escaped slashes and
 * \u-escaped non-ASCII, so a string is safe inside a <script> block.
 */
export function json(value) {
  const inner = JSON.stringify(String(value ?? ''))
    .slice(1, -1)
    .replace(/\\"/g, '\\u0022')
    .replace(/</g, '\\u003C')
    .replace(/>/g, '\\u003E')
    .replace(/&/g, '\\u0026')
    .replace(/'/g, '\\u0027')
    .replace(/\//g, '\\/')
    .replace(/[\u0080-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)
  return `"${inner}"`
}
