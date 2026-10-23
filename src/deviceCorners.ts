import { CIRCLE_TENSION, type Corners, type Superellipse } from './geometry'
import type { El, ImageEl, RectEl } from './types'

// Screen openings measured in the bezel PNGs from https://developer.apple.com/design/resources/.
// All values are PNG pixels. Corners are [n = exponent, r = where the curve starts], in
// the order top-left, top-right, bottom-right, bottom-left. One superellipse is fitted to
// the points of all four screen corners together, so each device has one corner shape.
// The iPhone Duo outer screen is the exception: its left (hinge side) and right corners
// differ, so the left pair and the right pair are fitted separately.
// The fit error is below 0.4 px for every corner.
// `scale` converts PNG pixels to points (@3x iPhone / Duo, @2x iPad).
// A device without `file` has no bezel PNG: only its screen is drawn, and `png`
// is the space it takes in the row. `estimate` says where its corner comes from.
type Device = {
  name: string
  file?: string
  estimate?: string
  scale: number
  png: [number, number]
  screen: { x: number; y: number; w: number; h: number }
  corners: [number, number][]
}

const ROWS: Device[][] = [
  [
    { name: 'iPhone 18 Pro', file: 'iphone-18-pro-silver', scale: 3, png: [1350, 2760], screen: { x: 72, y: 69, w: 1206, h: 2622 }, corners: [[2.54, 228.85], [2.54, 228.85], [2.54, 228.85], [2.54, 228.85]] },
    { name: 'iPhone 18 Pro Max', file: 'iphone-18-pro-max-silver', scale: 3, png: [1470, 3000], screen: { x: 75, y: 66, w: 1320, h: 2868 }, corners: [[2.6, 235.8], [2.6, 235.8], [2.6, 235.8], [2.6, 235.8]] },
  ],
  [
    { name: 'iPhone 17', file: 'iphone-17-white', scale: 3, png: [1350, 2760], screen: { x: 72, y: 69, w: 1206, h: 2622 }, corners: [[2.6, 233.75], [2.6, 233.75], [2.6, 233.75], [2.6, 233.75]] },
    { name: 'iPhone Air', file: 'iphone-air-cloud-white', scale: 3, png: [1380, 2880], screen: { x: 60, y: 72, w: 1260, h: 2736 }, corners: [[2.61, 234.6], [2.61, 234.6], [2.61, 234.6], [2.61, 234.6]] },
    { name: 'iPhone 17 Pro', file: 'iphone-17-pro-silver', scale: 3, png: [1350, 2760], screen: { x: 72, y: 69, w: 1206, h: 2622 }, corners: [[2.59, 232.8], [2.59, 232.8], [2.59, 232.8], [2.59, 232.8]] },
    { name: 'iPhone 17 Pro Max', file: 'iphone-17-pro-max-silver', scale: 3, png: [1470, 3000], screen: { x: 75, y: 66, w: 1320, h: 2868 }, corners: [[2.64, 239.25], [2.64, 239.25], [2.64, 239.25], [2.64, 239.25]] },
    // No bezel PNG exists. Screen 2532 × 1170 px from https://www.apple.com/iphone-17e/specs/ (@3x assumed),
    // corner copied from the iPhone 16 (keep both in sync), space with the iPhone 16 bezel margins.
    { name: 'iPhone 17e', estimate: 'iPhone 16 corner', scale: 3, png: [1350, 2712], screen: { x: 90, y: 90, w: 1170, h: 2532 }, corners: [[2.64, 208.75], [2.64, 208.75], [2.64, 208.75], [2.64, 208.75]] },
  ],
  [
    { name: 'iPhone 16', file: 'iphone-16-white', scale: 3, png: [1359, 2736], screen: { x: 90, y: 90, w: 1179, h: 2556 }, corners: [[2.64, 208.75], [2.64, 208.75], [2.64, 208.75], [2.64, 208.75]] },
    { name: 'iPhone 16 Plus', file: 'iphone-16-plus-white', scale: 3, png: [1470, 2970], screen: { x: 90, y: 87, w: 1290, h: 2796 }, corners: [[2.69, 211.9], [2.69, 211.9], [2.69, 211.9], [2.69, 211.9]] },
    { name: 'iPhone 16 Pro', file: 'iphone-16-pro-white-titanium', scale: 3, png: [1350, 2760], screen: { x: 72, y: 69, w: 1206, h: 2622 }, corners: [[2.56, 230.2], [2.56, 230.2], [2.56, 230.2], [2.56, 230.2]] },
    { name: 'iPhone 16 Pro Max', file: 'iphone-16-pro-max-white-titanium', scale: 3, png: [1470, 3000], screen: { x: 75, y: 66, w: 1320, h: 2868 }, corners: [[2.55, 229.2], [2.55, 229.2], [2.55, 229.2], [2.55, 229.2]] },
  ],
  [
    { name: 'iPhone Duo outer (closed)', file: 'iphone-duo-star-white-outer-closed', scale: 3, png: [1574, 2194], screen: { x: 88, y: 80, w: 1398, h: 2034 }, corners: [[2.5, 29.2], [2.51, 211.6], [2.51, 211.6], [2.5, 29.2]] },
    { name: 'iPhone Duo inner (open)', file: 'iphone-duo-star-white-inner-open', scale: 3, png: [2247, 3093], screen: { x: 120, y: 120, w: 2007, h: 2853 }, corners: [[2.51, 195.2], [2.51, 195.2], [2.51, 195.2], [2.51, 195.2]] },
  ],
  [
    { name: 'iPad mini', file: 'ipad-mini-starlight', scale: 2, png: [1780, 2550], screen: { x: 146, y: 142, w: 1488, h: 2266 }, corners: [[2.52, 52.55], [2.52, 52.55], [2.52, 52.55], [2.52, 52.55]] },
    { name: 'iPad (A16)', file: 'ipad-a16-silver', scale: 2, png: [2040, 2760], screen: { x: 200, y: 200, w: 1640, h: 2360 }, corners: [[2.22, 53.5], [2.22, 53.5], [2.22, 53.5], [2.22, 53.5]] },
    { name: 'iPad Air 11"', file: 'ipad-air-11-starlight', scale: 2, png: [1900, 2620], screen: { x: 130, y: 130, w: 1640, h: 2360 }, corners: [[2.28, 40.5], [2.28, 40.5], [2.28, 40.5], [2.28, 40.5]] },
    { name: 'iPad Pro 11"', file: 'ipad-pro-11-silver', scale: 2, png: [1880, 2640], screen: { x: 106, y: 110, w: 1668, h: 2420 }, corners: [[2.22, 64.65], [2.22, 64.65], [2.22, 64.65], [2.22, 64.65]] },
    { name: 'iPad Air 13"', file: 'ipad-air-13-starlight', scale: 2, png: [2300, 2980], screen: { x: 126, y: 124, w: 2048, h: 2732 }, corners: [[2.14, 38], [2.14, 38], [2.14, 38], [2.14, 38]] },
    { name: 'iPad Pro 13"', file: 'ipad-pro-13-silver', scale: 2, png: [2300, 3000], screen: { x: 118, y: 124, w: 2064, h: 2752 }, corners: [[2.17, 63.15], [2.17, 63.15], [2.17, 63.15], [2.17, 63.15]] },
  ],
]

const GAP = 60
const round2 = (v: number) => Math.round(v * 100) / 100
const uid = () => Math.random().toString(36).slice(2, 10)

/** Every device bezel at point size, with a screen rectangle on top that uses the fitted superellipse. */
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
      if (d.file) {
        images.push({
          id: uid(),
          type: 'image',
          name: `${d.name} – bezel`,
          x,
          y: top,
          w,
          h,
          naturalW: d.png[0],
          naturalH: d.png[1],
          opacity: 1,
          src: `/bezels/${d.file}.png`,
        })
      }
      const corners = d.corners.map(([n, r]) => ({ n, size: round2(r / d.scale) }))
      const linked = corners.every((c) => c.n === corners[0].n && c.size === corners[0].size)
      rects.push({
        id: uid(),
        type: 'rect',
        name:
          // Each distinct corner shape once, e.g. "n 2.5 · 9.73pt | n 2.51 · 70.53pt" for the Duo outer screen.
          `${d.name} – screen · ${[...new Set(corners.map((c) => `n ${c.n} · ${c.size}pt`))].join(' | ')}` +
          (d.estimate ? ` · estimated (${d.estimate})` : ''),
        x: round2(x + d.screen.x / d.scale),
        y: round2(top + d.screen.y / d.scale),
        w: round2(d.screen.w / d.scale),
        h: round2(d.screen.h / d.scale),
        opacity: 0.5,
        // Orange marks an estimate that was not measured from a PNG.
        fill: d.estimate ? '#ff9f0a' : '#0a84ff',
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
