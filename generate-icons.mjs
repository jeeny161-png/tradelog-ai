import { deflateSync } from 'zlib'
import { writeFileSync } from 'fs'

function createPNG(width, height, pixels) {
  // pixels: Uint8Array of RGBA values, row by row

  function crc32(buf) {
    const table = []
    for (let i = 0; i < 256; i++) {
      let c = i
      for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      table[i] = c
    }
    let crc = 0xffffffff
    for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8)
    return (crc ^ 0xffffffff) >>> 0
  }

  function chunk(type, data) {
    const typeBytes = Buffer.from(type, 'ascii')
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const crcData = Buffer.concat([typeBytes, data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(crcData))
    return Buffer.concat([len, typeBytes, data, crc])
  }

  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  // IHDR
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 2   // color type: RGB (no alpha for simplicity, we'll use RGBA = type 6)
  ihdr[9] = 6   // RGBA
  ihdr[10] = 0  // compression
  ihdr[11] = 0  // filter
  ihdr[12] = 0  // interlace

  // IDAT: filter byte (0) + pixel data per row
  const rawRows = []
  for (let y = 0; y < height; y++) {
    rawRows.push(0) // filter type none
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      rawRows.push(pixels[idx], pixels[idx+1], pixels[idx+2], pixels[idx+3])
    }
  }
  const rawBuf = Buffer.from(rawRows)
  const compressed = deflateSync(rawBuf, { level: 9 })

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ])
}

function generateIcon(size) {
  const pixels = new Uint8Array(size * size * 4)

  const bg = { r: 15, g: 17, b: 23 }        // #0f1117
  const gold = { r: 245, g: 158, b: 11 }     // amber-500 #f59e0b
  const darkGold = { r: 180, g: 100, b: 0 }  // slightly darker for depth

  // Draw background
  for (let i = 0; i < size * size * 4; i += 4) {
    pixels[i]   = bg.r
    pixels[i+1] = bg.g
    pixels[i+2] = bg.b
    pixels[i+3] = 255
  }

  // Rounded rectangle background (slightly lighter)
  const radius = Math.round(size * 0.18)
  const card = { r: 26, g: 31, b: 46 }  // #1a1f2e
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inCornerTL = x < radius && y < radius && (x - radius) ** 2 + (y - radius) ** 2 > radius ** 2
      const inCornerTR = x >= size - radius && y < radius && (x - (size - radius - 1)) ** 2 + (y - radius) ** 2 > radius ** 2
      const inCornerBL = x < radius && y >= size - radius && (x - radius) ** 2 + (y - (size - radius - 1)) ** 2 > radius ** 2
      const inCornerBR = x >= size - radius && y >= size - radius && (x - (size - radius - 1)) ** 2 + (y - (size - radius - 1)) ** 2 > radius ** 2
      if (!inCornerTL && !inCornerTR && !inCornerBL && !inCornerBR) {
        const idx = (y * size + x) * 4
        pixels[idx]   = card.r
        pixels[idx+1] = card.g
        pixels[idx+2] = card.b
        pixels[idx+3] = 255
      }
    }
  }

  // Draw "T" letter in gold
  // T top bar: from 20% to 80% horizontally, 22% to 36% vertically
  const tBarTop    = Math.round(size * 0.22)
  const tBarBottom = Math.round(size * 0.36)
  const tBarLeft   = Math.round(size * 0.18)
  const tBarRight  = Math.round(size * 0.82)

  // T stem: from 44% to 56% horizontally, 36% to 78% vertically
  const tStemLeft   = Math.round(size * 0.40)
  const tStemRight  = Math.round(size * 0.60)
  const tStemTop    = Math.round(size * 0.34)
  const tStemBottom = Math.round(size * 0.78)

  function setPixel(x, y, r, g, b) {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const idx = (y * size + x) * 4
    pixels[idx]   = r
    pixels[idx+1] = g
    pixels[idx+2] = b
    pixels[idx+3] = 255
  }

  // Fill T bar
  for (let y = tBarTop; y < tBarBottom; y++) {
    for (let x = tBarLeft; x < tBarRight; x++) {
      setPixel(x, y, gold.r, gold.g, gold.b)
    }
  }

  // Fill T stem
  for (let y = tStemTop; y < tStemBottom; y++) {
    for (let x = tStemLeft; x < tStemRight; x++) {
      setPixel(x, y, gold.r, gold.g, gold.b)
    }
  }

  // Add subtle gold border on the card
  const borderW = Math.max(1, Math.round(size * 0.012))
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const onBorder = x < borderW || x >= size - borderW || y < borderW || y >= size - borderW
      if (onBorder) {
        const idx = (y * size + x) * 4
        if (pixels[idx+3] === 255 && (pixels[idx] !== bg.r || pixels[idx+1] !== bg.g || pixels[idx+2] !== bg.b)) {
          pixels[idx]   = darkGold.r
          pixels[idx+1] = darkGold.g
          pixels[idx+2] = darkGold.b
        }
      }
    }
  }

  return createPNG(size, size, pixels)
}

writeFileSync('./public/icon-192x192.png', generateIcon(192))
writeFileSync('./public/icon-512x512.png', generateIcon(512))
console.log('Icons generated: public/icon-192x192.png, public/icon-512x512.png')
