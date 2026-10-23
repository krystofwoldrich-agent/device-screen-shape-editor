// Corner order everywhere: top-left, top-right, bottom-right, bottom-left.
export type Corner = {
  /** Distance from the corner (along each edge) where the curve starts. */
  r: number
  /**
   * Position of the bezier control points between the curve start (0) and the
   * sharp corner (1). 0.5523 approximates a circular arc, higher values give a
   * tighter, more "squircle"-like corner, 0 gives a straight chamfer.
   */
  t: number
}

export type Corners = [Corner, Corner, Corner, Corner]

export const CIRCLE_TENSION = 0.5523

export type Point = { x: number; y: number }

/** One superellipse corner: a quarter of |u|^n + |v|^n = 1. */
export type SuperellipseCorner = {
  /** Exponent n. 2 = circle, higher = flatter near the edges, tighter in the middle. */
  n: number
  /** Distance from the corner where the curve starts, in `Superellipse.unit`. */
  size: number
}

export type Superellipse = {
  /** Unit of every corner size: px, or % of the shorter side. */
  unit: 'px' | '%'
  linked: boolean
  corners: [SuperellipseCorner, SuperellipseCorner, SuperellipseCorner, SuperellipseCorner]
}

export const DEFAULT_SUPERELLIPSE_CORNER: SuperellipseCorner = { n: 3.74, size: 25.2 }

export const defaultSuperellipse = (): Superellipse => ({
  unit: '%',
  linked: true,
  corners: [0, 1, 2, 3].map(() => ({ ...DEFAULT_SUPERELLIPSE_CORNER })) as Superellipse['corners'],
})

/** Accepts the current format and the older single-corner format `{ n, size, unit }`. */
export function normalizeSuperellipse(raw: unknown): Superellipse {
  const v = raw as Partial<Superellipse> & Partial<SuperellipseCorner> | undefined
  if (v?.corners?.length === 4) return v as Superellipse
  if (v && typeof v.n === 'number' && typeof v.size === 'number') {
    const corner = { n: v.n, size: v.size }
    return {
      unit: v.unit ?? '%',
      linked: true,
      corners: [0, 1, 2, 3].map(() => ({ ...corner })) as Superellipse['corners'],
    }
  }
  return defaultSuperellipse()
}

export type RectShape = {
  w: number
  h: number
  cornerType: 'bezier' | 'superellipse'
  corners: Corners
  superellipse: Superellipse
}

export type Segment = { from: Point; c1: Point; c2: Point; to: Point }

/** One corner, drawn clockwise from `start` (on the previous edge) to `end` (on the next edge). */
export type CornerCurve = { start: Point; end: Point; segments: Segment[] }

const fmt = (n: number) => {
  const v = Math.round(n * 100) / 100
  return Object.is(v, -0) ? '0' : String(v)
}

/**
 * For each corner: the sharp corner point `k`, the unit direction `a` along the
 * edge where the curve starts and `b` along the edge where it ends.
 */
function cornerFrames(w: number, h: number) {
  return [
    { k: { x: 0, y: 0 }, a: { x: 0, y: 1 }, b: { x: 1, y: 0 } },
    { k: { x: w, y: 0 }, a: { x: -1, y: 0 }, b: { x: 0, y: 1 } },
    { k: { x: w, y: h }, a: { x: 0, y: -1 }, b: { x: -1, y: 0 } },
    { k: { x: 0, y: h }, a: { x: 1, y: 0 }, b: { x: 0, y: -1 } },
  ]
}

/** Scale radii down (like CSS border-radius) so adjacent corners never overlap. */
function clampRadii(w: number, h: number, radii: number[]): number[] {
  const [tl, tr, br, bl] = radii.map((r) => Math.max(0, r))
  const f = Math.min(
    1,
    tl + tr > 0 ? w / (tl + tr) : 1,
    bl + br > 0 ? w / (bl + br) : 1,
    tl + bl > 0 ? h / (tl + bl) : 1,
    tr + br > 0 ? h / (tr + br) : 1,
  )
  return [tl * f, tr * f, br * f, bl * f]
}

/** Superellipse corner sizes in px, scaled down like the bezier radii so adjacent corners never overlap. */
export function superellipseRadii(w: number, h: number, se: Superellipse): number[] {
  const min = Math.min(w, h)
  return clampRadii(
    w,
    h,
    se.corners.map((c) => (se.unit === '%' ? (c.size / 100) * min : c.size)),
  )
}

function bezierCorners(w: number, h: number, corners: Corners): CornerCurve[] {
  const radii = clampRadii(w, h, corners.map((c) => c.r))
  return cornerFrames(w, h).map(({ k, a, b }, i) => {
    const r = radii[i]
    const t = corners[i].t
    const at = (da: number, db: number) => ({ x: k.x + a.x * da + b.x * db, y: k.y + a.y * da + b.y * db })
    const start = at(r, 0)
    const end = at(0, r)
    if (r === 0) return { start, end, segments: [] }
    return { start, end, segments: [{ from: start, c1: at(r * (1 - t), 0), c2: at(0, r * (1 - t)), to: end }] }
  })
}

/** Cubic segments per half corner. 4 keeps the error below 0.15% of the radius for 1 <= n <= 20 (0.03% at n = 3.74). */
const SE_SEGMENTS_PER_HALF = 4

/**
 * Samples of one superellipse quarter in unit coordinates (u, v), where the
 * curve runs from (0, 1) to (1, 0) and u^n + v^n = 1. Each sample has a
 * parameter `p` that increases along the curve and the derivative dP/dp.
 * The first half uses u as the parameter, the second half mirrors it, so the
 * derivative stays finite everywhere.
 */
function superellipseSamples(n: number) {
  const g = (s: number) => (1 - s ** n) ** (1 / n)
  // Finite on [0, mid] for n >= 1 (0 ** 0 is 1 in JS, which gives the n = 1 slope of -1).
  const dg = (s: number) => -(s ** (n - 1)) * (1 - s ** n) ** (1 / n - 1)
  const mid = 0.5 ** (1 / n)
  // Knots get denser where the curve bends the most: toward the 45° point for
  // n >= 2, toward the edges for n < 2 (there the curvature at the edges is infinite).
  const knot = (i: number) => {
    const a = (Math.PI / 2) * (i / SE_SEGMENTS_PER_HALF)
    return mid * (n >= 2 ? Math.sin(a) : 1 - Math.cos(a))
  }
  const out: { p: number; u: number; v: number; du: number; dv: number }[] = []
  for (let i = 0; i <= SE_SEGMENTS_PER_HALF; i++) {
    const s = knot(i)
    out.push({ p: s, u: s, v: g(s), du: 1, dv: dg(s) })
  }
  for (let i = SE_SEGMENTS_PER_HALF - 1; i >= 0; i--) {
    const s = knot(i)
    out.push({ p: 2 * mid - s, u: g(s), v: s, du: -dg(s), dv: -1 })
  }
  return out
}

function superellipseCorners(w: number, h: number, se: Superellipse): CornerCurve[] {
  const radii = superellipseRadii(w, h, se)
  return cornerFrames(w, h).map(({ k, a, b }, i) => {
    const r = radii[i]
    const samples = r > 0 ? superellipseSamples(Math.max(1, se.corners[i].n)) : []
    // Unit (u, v) -> rectangle space. (0, 1) is the start on edge `a`, (1, 0) the end on edge `b`.
    const at = (u: number, v: number) => ({
      x: k.x + r * (1 - u) * a.x + r * (1 - v) * b.x,
      y: k.y + r * (1 - u) * a.y + r * (1 - v) * b.y,
    })
    const dir = (du: number, dv: number) => ({ x: -r * (du * a.x + dv * b.x), y: -r * (du * a.y + dv * b.y) })
    const start = at(0, 1)
    const end = at(1, 0)
    const segments: Segment[] = []
    for (let i = 0; i < samples.length - 1; i++) {
      // Cubic Hermite segment: control points from the curve derivative.
      const s0 = samples[i]
      const s1 = samples[i + 1]
      const step = (s1.p - s0.p) / 3
      const from = at(s0.u, s0.v)
      const to = at(s1.u, s1.v)
      const d0 = dir(s0.du, s0.dv)
      const d1 = dir(s1.du, s1.dv)
      segments.push({
        from,
        c1: { x: from.x + d0.x * step, y: from.y + d0.y * step },
        c2: { x: to.x - d1.x * step, y: to.y - d1.y * step },
        to,
      })
    }
    return { start, end, segments }
  })
}

export function rectCorners(shape: RectShape): CornerCurve[] {
  return shape.cornerType === 'superellipse'
    ? superellipseCorners(shape.w, shape.h, shape.superellipse)
    : bezierCorners(shape.w, shape.h, shape.corners)
}

export function rectPath(shape: RectShape): string {
  const g = rectCorners(shape)
  const p = (pt: Point) => `${fmt(pt.x)} ${fmt(pt.y)}`
  const curve = (c: CornerCurve) => c.segments.map((s) => `C${p(s.c1)} ${p(s.c2)} ${p(s.to)}`).join('')
  // Start at the end of the top-left corner and go clockwise.
  return [
    `M${p(g[0].end)}`,
    `H${fmt(g[1].start.x)}`,
    curve(g[1]),
    `V${fmt(g[2].start.y)}`,
    curve(g[2]),
    `H${fmt(g[3].start.x)}`,
    curve(g[3]),
    `V${fmt(g[0].start.y)}`,
    curve(g[0]),
    'Z',
  ]
    .filter(Boolean)
    .join('')
}

export { fmt }
