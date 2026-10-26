// Superellipse ("squircle") screen-corner mask with device presets.
//
// Each corner is a quarter of |x|^n + |y|^n = 1. The straight edges meet it
// tangentially and with zero curvature (for n > 2), so there is no curvature
// jump as with a circular arc.
//
// SCREEN_SHAPES has one entry per unique screen shape, keyed by the oldest device with
// that screen (the same entries as the Device corners page). DEVICE_SCREEN_SHAPES maps
// every device to its screen shape.
//
// The shapes were fitted to the screen openings in Apple's bezel PNGs
// (https://developer.apple.com/design/resources/; the iPhone 11–14 bezels are no longer
// linked there but are still on Apple's download server). One superellipse was fitted to
// all four screen corners; the iPhone Duo outer screen has one shape for its left (hinge
// side) corners and one for its right corners.
// Values are in pt (= CSS px):
//   size: distance from the corner where the curve starts
//   n:    exponent (2 = circle, higher = flatter near the edges)
// The fitted curves are within 0.7 PNG px of the bezel PNG edges.

export type Corner = { size: number; n: number }

export type ScreenShape = {
  /** Screen size in pt, for reference. The mask itself stretches to any element size. */
  width: number
  height: number
  topLeft: Corner
  topRight: Corner
  bottomRight: Corner
  bottomLeft: Corner
}

const uniform = (width: number, height: number, n: number, size: number): ScreenShape => {
  const corner = { n, size }
  return { width, height, topLeft: corner, topRight: corner, bottomRight: corner, bottomLeft: corner }
}

const DUO_OUTER_LEFT = { n: 2.45, size: 9.57 }
const DUO_OUTER_RIGHT = { n: 2.51, size: 70.55 }

// The comment after each shape names the bezel PNG it was fitted to.
export const SCREEN_SHAPES = {
  iPhone16Pro: uniform(402, 874, 2.59, 77.43), // iPhone 16 Pro
  iPhone16ProMax: uniform(440, 956, 2.56, 76.62), // iPhone 16 Pro Max
  iPhoneAir: uniform(420, 912, 2.61, 78.2), // iPhone Air
  iPhone14Pro: uniform(393, 852, 2.61, 68.97), // iPhone 16
  iPhone14ProMax: uniform(430, 932, 2.66, 69.98), // iPhone 16 Plus
  // The iPhone 12 and 13 families have the same corners within the measurement accuracy,
  // so these three are fitted to an iPhone 12 bezel and a newer bezel together.
  iPhone12: uniform(390, 844, 2.71, 61.21), // iPhone 12 Pro + iPhone 14
  iPhone12ProMax: uniform(428, 926, 2.66, 67.54), // iPhone 12 Pro Max + iPhone 14 Plus
  // Apple's iPhone 12 mini bezel draws the screen at 375 × 812 pt; its points were scaled to
  // the real 360 pt width.
  iPhone12Mini: uniform(360, 780, 2.73, 54.71), // iPhone 12 mini + iPhone 13 mini
  iPhoneX: uniform(375, 812, 2.43, 45.67), // iPhone 11 Pro
  iPhoneXsMax: uniform(414, 896, 2.46, 46.2), // iPhone 11 Pro Max
  iPhoneXR: uniform(414, 896, 2.5, 49.98), // iPhone 11
  iPhoneDuoOuter: {
    width: 466,
    height: 678,
    topLeft: DUO_OUTER_LEFT,
    topRight: DUO_OUTER_RIGHT,
    bottomRight: DUO_OUTER_RIGHT,
    bottomLeft: DUO_OUTER_LEFT,
  },
  iPhoneDuoInner: uniform(669, 951, 2.52, 65.28),
  iPadMini6thGen: uniform(744, 1133, 2.52, 26.28), // iPad mini (A17 Pro)
  iPad10thGen: uniform(820, 1180, 2.22, 26.75), // iPad (A16)
  iPadAir4thGen: uniform(820, 1180, 2.28, 20.25), // iPad Air 11" (M4)
  iPadPro11M4: uniform(834, 1210, 2.22, 32.33), // iPad Pro 11" (M5)
  iPadPro13M4: uniform(1032, 1376, 2.18, 31.68), // iPad Pro 13" (M5)
  iPadPro129Gen3: uniform(1024, 1366, 2.14, 19), // iPad Air 13" (M4)
  iPadPro11Gen1: uniform(834, 1194, 2.4, 21.4), // iPad Pro 11" (2018), Internet Archive copy
} satisfies Record<string, ScreenShape>

export type ScreenShapeName = keyof typeof SCREEN_SHAPES

// Devices that share a screen shape: the same size and corner mask in the Xcode simulator
// device types, or the same measured corners (iPhone 12 and 13 families).
export const DEVICE_SCREEN_SHAPES = {
  iPhone16Pro: 'iPhone16Pro',
  iPhone17: 'iPhone16Pro',
  iPhone17Pro: 'iPhone16Pro',
  iPhone18Pro: 'iPhone16Pro',
  iPhone16ProMax: 'iPhone16ProMax',
  iPhone17ProMax: 'iPhone16ProMax',
  iPhone18ProMax: 'iPhone16ProMax',
  iPhoneAir: 'iPhoneAir',
  iPhone14Pro: 'iPhone14Pro',
  iPhone15: 'iPhone14Pro',
  iPhone15Pro: 'iPhone14Pro',
  iPhone16: 'iPhone14Pro',
  iPhone14ProMax: 'iPhone14ProMax',
  iPhone15Plus: 'iPhone14ProMax',
  iPhone15ProMax: 'iPhone14ProMax',
  iPhone16Plus: 'iPhone14ProMax',
  iPhone12: 'iPhone12',
  iPhone12Pro: 'iPhone12',
  iPhone13: 'iPhone12',
  iPhone13Pro: 'iPhone12',
  iPhone14: 'iPhone12',
  iPhone16e: 'iPhone12',
  // No bezel PNG exists; same screen as the iPhone 14 (2532 × 1170 px).
  iPhone17e: 'iPhone12',
  iPhone12ProMax: 'iPhone12ProMax',
  iPhone13ProMax: 'iPhone12ProMax',
  iPhone14Plus: 'iPhone12ProMax',
  iPhone12Mini: 'iPhone12Mini',
  iPhone13Mini: 'iPhone12Mini',
  iPhoneX: 'iPhoneX',
  iPhoneXs: 'iPhoneX',
  iPhone11Pro: 'iPhoneX',
  iPhoneXsMax: 'iPhoneXsMax',
  iPhone11ProMax: 'iPhoneXsMax',
  iPhoneXR: 'iPhoneXR',
  iPhone11: 'iPhoneXR',
  iPhoneDuoOuter: 'iPhoneDuoOuter',
  iPhoneDuoInner: 'iPhoneDuoInner',
  iPadMini6thGen: 'iPadMini6thGen',
  iPadMiniA17Pro: 'iPadMini6thGen',
  iPad10thGen: 'iPad10thGen',
  iPadA16: 'iPad10thGen',
  iPadAir4thGen: 'iPadAir4thGen',
  iPadAir5thGen: 'iPadAir4thGen',
  iPadAir11M2: 'iPadAir4thGen',
  iPadAir11M3: 'iPadAir4thGen',
  iPadAir11M4: 'iPadAir4thGen',
  iPadPro11M4: 'iPadPro11M4',
  iPadPro11M5: 'iPadPro11M4',
  iPadPro13M4: 'iPadPro13M4',
  iPadPro13M5: 'iPadPro13M4',
  iPadPro129Gen3: 'iPadPro129Gen3',
  iPadPro129Gen4: 'iPadPro129Gen3',
  iPadPro129Gen5: 'iPadPro129Gen3',
  iPadPro129Gen6: 'iPadPro129Gen3',
  iPadAir13M2: 'iPadPro129Gen3',
  iPadAir13M3: 'iPadPro129Gen3',
  iPadAir13M4: 'iPadPro129Gen3',
  iPadPro11Gen1: 'iPadPro11Gen1',
  iPadPro11Gen2: 'iPadPro11Gen1',
  iPadPro11Gen3: 'iPadPro11Gen1',
  iPadPro11Gen4: 'iPadPro11Gen1',
} as const satisfies Record<string, ScreenShapeName>

export type DeviceName = keyof typeof DEVICE_SCREEN_SHAPES

export const screenShapeFor = (device: DeviceName): ScreenShape => SCREEN_SHAPES[DEVICE_SCREEN_SHAPES[device]]

const SAMPLES = 18

// One corner's cut-out, hugging the outer corner at (0,0), in pt.
function nubPath({ size, n }: Corner) {
  const draw = (x: number, y: number) => `${x.toFixed(2)},${y.toFixed(2)}`
  let d = ''
  for (let i = 0; i <= SAMPLES; i++) {
    const t = (i / SAMPLES) * (Math.PI / 2)
    const x = size - size * Math.cos(t) ** (2 / n)
    const y = size - size * Math.sin(t) ** (2 / n)
    d += `${i === 0 ? 'M' : 'L'} ${draw(x, y)} `
  }
  return `${d}L 0,0 Z`
}

// Each nub is drawn at its own corner: a nested <svg> puts the origin there, and the
// nub is mirrored so it points into the element. Sizes are absolute, so the corners
// keep their pt size at any element size.
function corners(shape: ScreenShape) {
  const nub = (c: Corner, x: string, y: string, scale: string) =>
    `<svg x='${x}' y='${y}' overflow='visible'><path d='${nubPath(c)}' transform='scale(${scale})'/></svg>`
  return (
    nub(shape.topLeft, '0', '0', '1 1') +
    nub(shape.topRight, '100%', '0', '-1 1') +
    nub(shape.bottomRight, '100%', '100%', '-1 -1') +
    nub(shape.bottomLeft, '0', '100%', '1 -1')
  )
}

/** The mask as an SVG string, sized to fill the masked element. */
export function squircleSvg(shape: ScreenShape) {
  // A full rectangle with the four corner nubs cut out via an inner luminance mask.
  return (
    `<svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%'>` +
    `<mask id='cut'><rect width='100%' height='100%' fill='white'/><g fill='black'>${corners(shape)}</g></mask>` +
    `<rect width='100%' height='100%' mask='url(#cut)'/>` +
    '</svg>'
  )
}

function squircleDataUri(shape: ScreenShape) {
  return `url("data:image/svg+xml,${encodeURIComponent(squircleSvg(shape))}")`
}

export const squircleMaskDef = (shape: ScreenShape | DeviceName) =>
  ({
    '--demos-scene-squircle-mask': squircleDataUri(typeof shape === 'string' ? screenShapeFor(shape) : shape),
  }) as Record<string, unknown>

export const squircleMaskVar = {
  maskImage: 'var(--demos-scene-squircle-mask)',
  maskSize: '100% 100%',
  maskRepeat: 'no-repeat',
  WebkitMaskImage: 'var(--demos-scene-squircle-mask)',
  WebkitMaskSize: '100% 100%',
  WebkitMaskRepeat: 'no-repeat',
}

// Usage:
//   <div style={{ ...squircleMaskDef('iPhone17Pro'), ...squircleMaskVar, width: 402, height: 874 }} />
