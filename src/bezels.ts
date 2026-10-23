import type { ImageEl } from './types'

// Silver / white portrait bezels from https://developer.apple.com/design/resources/
// PNG files live in public/bezels. Sizes are the PNG pixel sizes (@3x).
const ROWS: [name: string, file: string, w: number, h: number][][] = [
  [
    ['iPhone 18 Pro – Silver', 'iphone-18-pro-silver.png', 1350, 2760],
    ['iPhone 18 Pro Max – Silver', 'iphone-18-pro-max-silver.png', 1470, 3000],
  ],
  [
    ['iPhone 17 – White', 'iphone-17-white.png', 1350, 2760],
    ['iPhone Air – Cloud White', 'iphone-air-cloud-white.png', 1380, 2880],
    ['iPhone 17 Pro – Silver', 'iphone-17-pro-silver.png', 1350, 2760],
    ['iPhone 17 Pro Max – Silver', 'iphone-17-pro-max-silver.png', 1470, 3000],
  ],
  [
    ['iPhone 16 – White', 'iphone-16-white.png', 1359, 2736],
    ['iPhone 16 Plus – White', 'iphone-16-plus-white.png', 1470, 2970],
    ['iPhone 16 Pro – White Titanium', 'iphone-16-pro-white-titanium.png', 1350, 2760],
    ['iPhone 16 Pro Max – White Titanium', 'iphone-16-pro-max-white-titanium.png', 1470, 3000],
  ],
  [
    ['iPhone Duo – Star White – Outer Closed', 'iphone-duo-star-white-outer-closed.png', 1574, 2194],
    ['iPhone Duo – Star White – Inner Open', 'iphone-duo-star-white-inner-open.png', 2247, 3093],
  ],
]

const GAP = 60
/** Place the @3x PNGs at point size, so corner radii read like iOS points. */
const SCALE = 1 / 3

/** One row per generation, bottoms aligned, starting at (originX, originY). */
export function defaultBezels(originX = 0, originY = 0): ImageEl[] {
  const els: ImageEl[] = []
  let y = originY
  for (const row of ROWS) {
    const rowH = Math.max(...row.map(([, , , h]) => Math.round(h * SCALE)))
    let x = originX
    for (const [name, file, naturalW, naturalH] of row) {
      const w = Math.round(naturalW * SCALE)
      const h = Math.round(naturalH * SCALE)
      els.push({
        id: Math.random().toString(36).slice(2, 10),
        type: 'image',
        name,
        x,
        y: y + rowH - h,
        w,
        h,
        naturalW,
        naturalH,
        opacity: 1,
        src: `/bezels/${file}`,
      })
      x += w + GAP
    }
    y += rowH + GAP
  }
  return els
}
