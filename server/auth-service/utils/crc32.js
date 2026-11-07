// PHP's hash('crc32b'): the standard (zlib) CRC-32, as 8 lower-case hex digits. zlib.crc32 needs Node 22.2+.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

export function crc32b(text) {
  let crc = 0xffffffff
  for (const byte of Buffer.from(text, 'utf8')) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0')
}
