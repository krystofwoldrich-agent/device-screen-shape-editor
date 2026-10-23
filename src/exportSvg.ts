import { fmt, rectPath } from './geometry'
import type { El, RectEl } from './types'

function rectAttrs(el: RectEl): string {
  const attrs = [`d="${rectPath(el)}"`, `fill="${el.fill}"`]
  if (el.strokeWidth > 0) {
    attrs.push(`stroke="${el.stroke}"`, `stroke-width="${fmt(el.strokeWidth)}"`)
  }
  if (el.opacity < 1) attrs.push(`opacity="${fmt(el.opacity)}"`)
  return attrs.join(' ')
}

/** Single rectangle, path at origin, viewBox fitted to the shape. */
export function rectToSvg(el: RectEl): string {
  const pad = el.strokeWidth > 0 ? el.strokeWidth / 2 : 0
  const vb = [-pad, -pad, el.w + pad * 2, el.h + pad * 2].map(fmt)
  return [
    `<svg width="${vb[2]}" height="${vb[3]}" viewBox="${vb.join(' ')}" fill="none" xmlns="http://www.w3.org/2000/svg">`,
    `  <path ${rectAttrs(el)}/>`,
    `</svg>`,
  ].join('\n')
}

/** Many elements in one SVG, viewBox fitted to their bounding box. */
export function sceneToSvg(els: El[], includeImages: boolean): string {
  const items = els.filter((e) => includeImages || e.type === 'rect')
  if (items.length === 0) return ''
  const pads = items.map((e) => (e.type === 'rect' && e.strokeWidth > 0 ? e.strokeWidth / 2 : 0))
  const minX = Math.min(...items.map((e, i) => e.x - pads[i]))
  const minY = Math.min(...items.map((e, i) => e.y - pads[i]))
  const maxX = Math.max(...items.map((e, i) => e.x + e.w + pads[i]))
  const maxY = Math.max(...items.map((e, i) => e.y + e.h + pads[i]))
  const w = fmt(maxX - minX)
  const h = fmt(maxY - minY)
  const lines = items.map((e) => {
    const tx = fmt(e.x - minX)
    const ty = fmt(e.y - minY)
    if (e.type === 'rect') {
      return `  <path transform="translate(${tx} ${ty})" ${rectAttrs(e)}/>`
    }
    const op = e.opacity < 1 ? ` opacity="${fmt(e.opacity)}"` : ''
    return `  <image x="${tx}" y="${ty}" width="${fmt(e.w)}" height="${fmt(e.h)}" preserveAspectRatio="none"${op} href="${e.src}"/>`
  })
  return [
    `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" xmlns="http://www.w3.org/2000/svg">`,
    ...lines,
    `</svg>`,
  ].join('\n')
}
