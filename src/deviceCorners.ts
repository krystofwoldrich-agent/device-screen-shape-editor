import { CIRCLE_TENSION, type Corners, type Superellipse } from './geometry'
import type { El, ImageEl, RectEl } from './types'

// One entry per unique screen shape, named after the oldest device with that screen. Screens
// with the same size and the same measured corner (within the measurement accuracy) share an
// entry: e.g. the iPhone 12 and 13 families, although their simulator masks differ slightly. `also` lists the other
// devices with the same screen, and `bezelOf` names the device whose bezel PNG was measured
// when it is not the named one.
//
// Screen openings measured in the bezel PNGs from https://developer.apple.com/design/resources/.
// Bezels for the iPhone 11–14 are no longer linked from that page but are still on Apple's
// download server (Bezel-iPhone-11.dmg … Bezel-iPhone-14.dmg); the iPad Pro 11" (1st–4th gen)
// bezel is only in the Internet Archive.
// All values are PNG pixels. Corners are [n = exponent, r = where the curve starts], in
// the order top-left, top-right, bottom-right, bottom-left. One superellipse is fitted to
// the points of all four screen corners together, so each device has one corner shape.
// The iPhone Duo outer screen is the exception: its left (hinge side) and right corners
// differ, so the left pair and the right pair are fitted separately.
// The fit error is below 0.4 px for every corner.
// `scale` converts PNG pixels to points (@3x iPhone / Duo, @2x iPad and iPhone Xʀ / 11).
type Device = {
  name: string
  also?: string[]
  bezelOf?: string
  file: string
  scale: number
  png: [number, number]
  screen: { x: number; y: number; w: number; h: number }
  corners: [number, number][]
}

const ROWS: Device[][] = [
  [
    { name: 'iPhone 16 Pro', also: ['iPhone 17', 'iPhone 17 Pro', 'iPhone 18 Pro'], file: 'iphone-16-pro-white-titanium', scale: 3, png: [1350, 2760], screen: { x: 72, y: 69, w: 1206, h: 2622 }, corners: [[2.59, 232.3], [2.59, 232.3], [2.59, 232.3], [2.59, 232.3]] },
    { name: 'iPhone 16 Pro Max', also: ['iPhone 17 Pro Max', 'iPhone 18 Pro Max'], file: 'iphone-16-pro-max-white-titanium', scale: 3, png: [1470, 3000], screen: { x: 75, y: 66, w: 1320, h: 2868 }, corners: [[2.56, 229.85], [2.56, 229.85], [2.56, 229.85], [2.56, 229.85]] },
    { name: 'iPhone Air', file: 'iphone-air-cloud-white', scale: 3, png: [1380, 2880], screen: { x: 60, y: 72, w: 1260, h: 2736 }, corners: [[2.61, 234.6], [2.61, 234.6], [2.61, 234.6], [2.61, 234.6]] },
  ],
  [
    { name: 'iPhone 14 Pro', also: ['iPhone 15', 'iPhone 15 Pro', 'iPhone 16'], bezelOf: 'iPhone 16', file: 'iphone-16-white', scale: 3, png: [1359, 2736], screen: { x: 90, y: 90, w: 1179, h: 2556 }, corners: [[2.61, 206.9], [2.61, 206.9], [2.61, 206.9], [2.61, 206.9]] },
    { name: 'iPhone 14 Pro Max', also: ['iPhone 15 Plus', 'iPhone 15 Pro Max', 'iPhone 16 Plus'], bezelOf: 'iPhone 16 Plus', file: 'iphone-16-plus-white', scale: 3, png: [1470, 2970], screen: { x: 90, y: 87, w: 1290, h: 2796 }, corners: [[2.66, 209.95], [2.66, 209.95], [2.66, 209.95], [2.66, 209.95]] },
    // Corner fitted to the iPhone 12 Pro and iPhone 14 bezels together (n 2.71 · 61.21 pt).
    { name: 'iPhone 12', also: ['iPhone 12 Pro', 'iPhone 13', 'iPhone 13 Pro', 'iPhone 14', 'iPhone 16e', 'iPhone 17e'], bezelOf: 'iPhone 12 Pro', file: 'iphone-12-pro-silver', scale: 3, png: [1370, 2712], screen: { x: 100, y: 90, w: 1170, h: 2532 }, corners: [[2.71, 183.63], [2.71, 183.63], [2.71, 183.63], [2.71, 183.63]] },
    // Corner fitted to the iPhone 12 Pro Max and iPhone 14 Plus bezels together (n 2.66 · 67.54 pt).
    { name: 'iPhone 12 Pro Max', also: ['iPhone 13 Pro Max', 'iPhone 14 Plus'], file: 'iphone-12-pro-max-silver', scale: 3, png: [1484, 2978], screen: { x: 101, y: 100, w: 1284, h: 2778 }, corners: [[2.66, 202.62], [2.66, 202.62], [2.66, 202.62], [2.66, 202.62]] },
  ],
  [
    // Apple drew this screen at 1125 × 2436 px (375 × 812 pt); the device is 1080 × 2340 px, so 1125 / 360 = 3.125 px per pt.
    // Corner fitted to the iPhone 12 mini and iPhone 13 mini bezels together (n 2.73 · 54.71 pt).
    { name: 'iPhone 12 mini', also: ['iPhone 13 mini'], file: 'iphone-12-mini-white', scale: 3.125, png: [1325, 2616], screen: { x: 100, y: 90, w: 1125, h: 2436 }, corners: [[2.73, 170.97], [2.73, 170.97], [2.73, 170.97], [2.73, 170.97]] },
    { name: 'iPhone X', also: ['iPhone Xs', 'iPhone 11 Pro'], bezelOf: 'iPhone 11 Pro', file: 'iphone-11-pro', scale: 3, png: [1365, 2656], screen: { x: 121, y: 110, w: 1125, h: 2436 }, corners: [[2.43, 137], [2.43, 137], [2.43, 137], [2.43, 137]] },
    { name: 'iPhone Xs Max', also: ['iPhone 11 Pro Max'], bezelOf: 'iPhone 11 Pro Max', file: 'iphone-11-pro-max', scale: 3, png: [1463, 2888], screen: { x: 111, y: 100, w: 1242, h: 2688 }, corners: [[2.46, 138.6], [2.46, 138.6], [2.46, 138.6], [2.46, 138.6]] },
    { name: 'iPhone Xʀ', also: ['iPhone 11'], bezelOf: 'iPhone 11', file: 'iphone-11', scale: 2, png: [1008, 1952], screen: { x: 90, y: 80, w: 828, h: 1792 }, corners: [[2.5, 99.95], [2.5, 99.95], [2.5, 99.95], [2.5, 99.95]] },
  ],
  [
    { name: 'iPhone Duo outer (closed)', file: 'iphone-duo-star-white-outer-closed', scale: 3, png: [1574, 2194], screen: { x: 88, y: 80, w: 1398, h: 2034 }, corners: [[2.45, 28.7], [2.51, 211.65], [2.51, 211.65], [2.45, 28.7]] },
    { name: 'iPhone Duo inner (open)', file: 'iphone-duo-star-white-inner-open', scale: 3, png: [2247, 3093], screen: { x: 120, y: 120, w: 2007, h: 2853 }, corners: [[2.52, 195.85], [2.52, 195.85], [2.52, 195.85], [2.52, 195.85]] },
  ],
  [
    { name: 'iPad mini (6th gen)', also: ['iPad mini (A17 Pro)'], bezelOf: 'iPad mini (A17 Pro)', file: 'ipad-mini-starlight', scale: 2, png: [1780, 2550], screen: { x: 146, y: 142, w: 1488, h: 2266 }, corners: [[2.52, 52.55], [2.52, 52.55], [2.52, 52.55], [2.52, 52.55]] },
    { name: 'iPad (10th gen)', also: ['iPad (A16)'], bezelOf: 'iPad (A16)', file: 'ipad-a16-silver', scale: 2, png: [2040, 2760], screen: { x: 200, y: 200, w: 1640, h: 2360 }, corners: [[2.22, 53.5], [2.22, 53.5], [2.22, 53.5], [2.22, 53.5]] },
    { name: 'iPad Air (4th gen)', also: ['iPad Air (5th gen)', 'iPad Air 11" (M2)', 'iPad Air 11" (M3)', 'iPad Air 11" (M4)'], bezelOf: 'iPad Air 11" (M4)', file: 'ipad-air-11-starlight', scale: 2, png: [1900, 2620], screen: { x: 130, y: 130, w: 1640, h: 2360 }, corners: [[2.28, 40.5], [2.28, 40.5], [2.28, 40.5], [2.28, 40.5]] },
    { name: 'iPad Pro 11" (M4)', also: ['iPad Pro 11" (M5)'], bezelOf: 'iPad Pro 11" (M5)', file: 'ipad-pro-11-silver', scale: 2, png: [1880, 2640], screen: { x: 106, y: 110, w: 1668, h: 2420 }, corners: [[2.22, 64.65], [2.22, 64.65], [2.22, 64.65], [2.22, 64.65]] },
    { name: 'iPad Pro 13" (M4)', also: ['iPad Pro 13" (M5)'], bezelOf: 'iPad Pro 13" (M5)', file: 'ipad-pro-13-silver', scale: 2, png: [2300, 3000], screen: { x: 118, y: 124, w: 2064, h: 2752 }, corners: [[2.18, 63.35], [2.18, 63.35], [2.18, 63.35], [2.18, 63.35]] },
    { name: 'iPad Pro 12.9" (3rd gen)', also: ['iPad Pro 12.9" (4th–6th gen)', 'iPad Air 13" (M2)', 'iPad Air 13" (M3)', 'iPad Air 13" (M4)'], bezelOf: 'iPad Air 13" (M4)', file: 'ipad-air-13-starlight', scale: 2, png: [2300, 2980], screen: { x: 126, y: 124, w: 2048, h: 2732 }, corners: [[2.14, 38], [2.14, 38], [2.14, 38], [2.14, 38]] },
    // Bezel removed from Apple's site; copy from the Internet Archive (Bezel-iPad-Pro.dmg, 2024-03-03).
    { name: 'iPad Pro 11" (1st gen)', also: ['iPad Pro 11" (2nd–4th gen)'], file: 'ipad-pro-11-2018-space-gray', scale: 2, png: [1890, 2610], screen: { x: 111, y: 111, w: 1668, h: 2388 }, corners: [[2.4, 42.8], [2.4, 42.8], [2.4, 42.8], [2.4, 42.8]] },
  ],
]

const GAP = 60
const round2 = (v: number) => Math.round(v * 100) / 100
const uid = () => Math.random().toString(36).slice(2, 10)

/** One bezel per unique screen shape at point size, with a screen rectangle on top that uses the fitted superellipse. */
export function deviceCornersExample(): El[] {
  const images: ImageEl[] = []
  const rects: RectEl[] = []
  let y = 0
  for (const row of ROWS) {
    const rowH = Math.max(...row.map((d) => d.png[1] / d.scale))
    let x = 0
    for (const d of row) {
      const w = round2(d.png[0] / d.scale)
      const h = round2(d.png[1] / d.scale)
      const top = y + rowH - h
      images.push({
        id: uid(),
        type: 'image',
        name: `${d.name} – bezel${d.bezelOf ? ` (${d.bezelOf} PNG)` : ''}`,
        x,
        y: top,
        w,
        h,
        naturalW: d.png[0],
        naturalH: d.png[1],
        opacity: 1,
        src: `/bezels/${d.file}.png`,
      })
      const corners = d.corners.map(([n, r]) => ({ n, size: round2(r / d.scale) }))
      const linked = corners.every((c) => c.n === corners[0].n && c.size === corners[0].size)
      rects.push({
        id: uid(),
        type: 'rect',
        name:
          // Each distinct corner shape once, e.g. "n 2.45 · 9.57pt | n 2.51 · 70.55pt" for the Duo outer screen.
          `${d.name} – screen · ${[...new Set(corners.map((c) => `n ${c.n} · ${c.size}pt`))].join(' | ')}` +
          (d.also ? ` · also ${d.also.join(', ')}` : ''),
        x: round2(x + d.screen.x / d.scale),
        y: round2(top + d.screen.y / d.scale),
        w: round2(d.screen.w / d.scale),
        h: round2(d.screen.h / d.scale),
        opacity: 0.5,
        fill: '#0a84ff',
        stroke: '#111111',
        strokeWidth: 0,
        cornerType: 'superellipse',
        linked: true,
        corners: corners.map((c) => ({ r: c.size, t: CIRCLE_TENSION })) as Corners,
        superellipse: { unit: 'px', linked, corners: corners as Superellipse['corners'] },
      })
      x += w + GAP
    }
    y += rowH + GAP
  }
  // Rectangles above all bezels.
  return [...images, ...rects]
}
