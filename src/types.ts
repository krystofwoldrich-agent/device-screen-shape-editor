import type { Corners, Superellipse } from './geometry'

type Base = {
  id: string
  name: string
  x: number
  y: number
  w: number
  h: number
  opacity: number
}

export type RectEl = Base & {
  type: 'rect'
  fill: string
  stroke: string
  strokeWidth: number
  cornerType: 'bezier' | 'superellipse'
  linked: boolean
  corners: Corners
  superellipse: Superellipse
}

export type ImageEl = Base & {
  type: 'image'
  src: string
  naturalW: number
  naturalH: number
}

export type El = RectEl | ImageEl

export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
