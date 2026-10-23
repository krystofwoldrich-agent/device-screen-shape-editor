import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  CIRCLE_TENSION,
  defaultSuperellipse,
  fmt,
  normalizeSuperellipse,
  rectCorners,
  rectPath,
  superellipseRadii,
  type Corner,
  type Corners,
  type Point,
  type Superellipse,
  type SuperellipseCorner,
} from './geometry'
import { defaultBezels } from './bezels'
import { deviceCornersExample } from './deviceCorners'
import { rectToSvg, sceneToSvg } from './exportSvg'
import { NumField, SliderField } from './fields'
import { HANDLES, type El, type Handle, type ImageEl, type RectEl } from './types'

type View = { x: number; y: number; scale: number }
type Tool = 'select' | 'rect'

type Drag =
  | { kind: 'move'; id: string; start: Point; orig: El }
  | { kind: 'resize'; id: string; handle: Handle; start: Point; orig: El }
  | { kind: 'create'; id: string; start: Point }
  | { kind: 'pan'; startClient: Point; orig: View }

// Kept from the app's first name, so work saved in the browser still loads.
const STORAGE_KEY = 'bezier-rect-editor:v1'

/** Each page has its own canvas, saved under its own key. The main page keeps the original key. */
export type Page = 'main' | 'device-corners'
export const PAGES: { id: Page; label: string; title: string }[] = [
  { id: 'main', label: 'Canvas', title: 'Your canvas' },
  { id: 'device-corners', label: 'Device corners', title: 'Example: bezels with screen rectangles fitted to the PNGs' },
]
const storageKey = (page: Page) => (page === 'main' ? STORAGE_KEY : `${STORAGE_KEY}:${page}`)
const defaultEls = (page: Page) => (page === 'main' ? defaultBezels() : deviceCornersExample())
const uid = () => Math.random().toString(36).slice(2, 10)
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

const EXPONENT_PRESETS: [string, number][] = [
  ['Chamfer', 1],
  ['Circle', 2],
  ['3.74', 3.74],
  ['Squircle', 4],
  ['5', 5],
]

const TENSION_PRESETS: [string, number][] = [
  ['Chamfer', 0],
  ['Circle', CIRCLE_TENSION],
  ['Smooth', 0.7],
  ['Tight', 0.85],
  ['Sharp', 1],
]

function loadState(key: string): { els: El[]; view: View } | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const state = JSON.parse(raw) as { els: El[]; view: View }
    // Rectangles saved by older versions get the new superellipse fields.
    state.els = state.els.map((e) =>
      e.type === 'rect'
        ? { ...e, cornerType: e.cornerType ?? 'bezier', superellipse: normalizeSuperellipse(e.superellipse) }
        : e,
    )
    return state
  } catch {
    return null
  }
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
}

function readImageFile(file: File): Promise<{ src: string; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => {
      const src = reader.result as string
      const img = new Image()
      img.onload = () => resolve({ src, w: img.naturalWidth || 300, h: img.naturalHeight || 300 })
      img.onerror = () => reject(new Error('Could not load image'))
      img.src = src
    }
    reader.readAsDataURL(file)
  })
}

export default function App({ page }: { page: Page }) {
  // Show the default bezels when nothing was saved yet or the saved canvas is empty.
  const initial = useRef((() => {
    const saved = loadState(storageKey(page))
    return saved?.els.length ? saved : null
  })())
  const [els, setEls] = useState<El[]>(() => initial.current?.els ?? defaultEls(page))
  const [view, setView] = useState<View>(initial.current?.view ?? { x: 0, y: 0, scale: 1 })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tool, setTool] = useState<Tool>('select')
  const [showBezier, setShowBezier] = useState(true)
  const [includeImages, setIncludeImages] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const svgRef = useRef<SVGSVGElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const spaceRef = useRef(false)
  const elsRef = useRef(els)
  const viewRef = useRef(view)
  const history = useRef<{ past: El[][]; future: El[][]; last: number }>({ past: [], future: [], last: 0 })
  useLayoutEffect(() => {
    elsRef.current = els
    viewRef.current = view
  })

  const selected = els.find((e) => e.id === selectedId) ?? null

  // ---------- history ----------
  /** Save an undo snapshot. Rapid successive calls (slider drags) are merged unless forced. */
  const snapshot = useCallback((force = false) => {
    const h = history.current
    const now = Date.now()
    if (force || now - h.last > 500) {
      h.past.push(elsRef.current)
      if (h.past.length > 200) h.past.shift()
      h.future = []
    }
    h.last = now
  }, [])

  const undo = useCallback(() => {
    const h = history.current
    const prev = h.past.pop()
    if (!prev) return
    h.future.push(elsRef.current)
    h.last = 0
    setEls(prev)
  }, [])

  const redo = useCallback(() => {
    const h = history.current
    const next = h.future.pop()
    if (!next) return
    h.past.push(elsRef.current)
    h.last = 0
    setEls(next)
  }, [])

  // ---------- mutations ----------
  const patch = useCallback((id: string, p: Partial<RectEl> | Partial<ImageEl>, { history: record = true } = {}) => {
    if (record) snapshot()
    setEls((prev) => prev.map((e) => (e.id === id ? ({ ...e, ...p } as El) : e)))
  }, [snapshot])

  const flash = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 1600)
  }

  const nextName = (type: El['type']) => {
    const n = elsRef.current.filter((e) => e.type === type).length + 1
    return type === 'rect' ? `Rectangle ${n}` : `Image ${n}`
  }

  const newRect = (x: number, y: number, w: number, h: number): RectEl => ({
    id: uid(),
    type: 'rect',
    name: nextName('rect'),
    x,
    y,
    w,
    h,
    opacity: 1,
    fill: '#4f7cff',
    stroke: '#111111',
    strokeWidth: 0,
    cornerType: 'superellipse',
    linked: true,
    corners: Array.from({ length: 4 }, () => ({ r: 24, t: CIRCLE_TENSION })) as Corners,
    superellipse: defaultSuperellipse(),
  })

  const viewCenter = (): Point => {
    const r = svgRef.current!.getBoundingClientRect()
    const v = viewRef.current
    return { x: (r.width / 2 - v.x) / v.scale, y: (r.height / 2 - v.y) / v.scale }
  }

  const addRectAtCenter = () => {
    const c = viewCenter()
    const el = newRect(Math.round(c.x - 100), Math.round(c.y - 60), 200, 120)
    snapshot(true)
    setEls((prev) => [...prev, el])
    setSelectedId(el.id)
  }

  const addImages = async (files: File[], at?: Point) => {
    const images = files.filter((f) => f.type.startsWith('image/'))
    if (images.length === 0) return
    snapshot(true)
    let offset = 0
    for (const file of images) {
      try {
        const { src, w, h } = await readImageFile(file)
        const p = at ?? viewCenter()
        const el: ImageEl = {
          id: uid(),
          type: 'image',
          name: file.name || nextName('image'),
          x: Math.round(p.x - w / 2 + offset),
          y: Math.round(p.y - h / 2 + offset),
          w,
          h,
          naturalW: w,
          naturalH: h,
          opacity: 1,
          src,
        }
        offset += 20
        // Insert images below all rectangles so they work as a tracing reference.
        setEls((prev) => {
          const firstRect = prev.findIndex((e) => e.type === 'rect')
          if (firstRect === -1) return [...prev, el]
          return [...prev.slice(0, firstRect), el, ...prev.slice(firstRect)]
        })
        setSelectedId(el.id)
      } catch (err) {
        flash(`Failed to load ${file.name}`)
        console.error(err)
      }
    }
  }

  const removeSelected = () => {
    if (!selectedId) return
    snapshot(true)
    setEls((prev) => prev.filter((e) => e.id !== selectedId))
    setSelectedId(null)
  }

  const duplicateSelected = () => {
    if (!selected) return
    snapshot(true)
    const copy = {
      ...structuredClone(selected),
      id: uid(),
      name: `${selected.name} copy`,
      x: selected.x + 20,
      y: selected.y + 20,
    }
    setEls((prev) => {
      const i = prev.findIndex((e) => e.id === selected.id)
      return [...prev.slice(0, i + 1), copy, ...prev.slice(i + 1)]
    })
    setSelectedId(copy.id)
  }

  const reorder = (dir: 'up' | 'down' | 'top' | 'bottom') => {
    if (!selectedId) return
    snapshot(true)
    setEls((prev) => {
      const i = prev.findIndex((e) => e.id === selectedId)
      const arr = [...prev]
      const [el] = arr.splice(i, 1)
      const to =
        dir === 'up' ? Math.min(arr.length, i + 1) : dir === 'down' ? Math.max(0, i - 1) : dir === 'top' ? arr.length : 0
      arr.splice(to, 0, el)
      return arr
    })
  }

  // ---------- view ----------
  const zoomAt = useCallback((factor: number, screen?: Point) => {
    setView((v) => {
      const r = svgRef.current!.getBoundingClientRect()
      const p = screen ?? { x: r.width / 2, y: r.height / 2 }
      const scale = clamp(v.scale * factor, 0.02, 64)
      const k = scale / v.scale
      return { scale, x: p.x - (p.x - v.x) * k, y: p.y - (p.y - v.y) * k }
    })
  }, [])

  const zoomToFit = () => {
    const list = elsRef.current
    const r = svgRef.current!.getBoundingClientRect()
    if (list.length === 0) return setView({ x: r.width / 2, y: r.height / 2, scale: 1 })
    const minX = Math.min(...list.map((e) => e.x))
    const minY = Math.min(...list.map((e) => e.y))
    const maxX = Math.max(...list.map((e) => e.x + e.w))
    const maxY = Math.max(...list.map((e) => e.y + e.h))
    const scale = clamp(Math.min((r.width - 120) / (maxX - minX), (r.height - 120) / (maxY - minY)), 0.02, 8)
    setView({
      scale,
      x: (r.width - (maxX - minX) * scale) / 2 - minX * scale,
      y: (r.height - (maxY - minY) * scale) / 2 - minY * scale,
    })
  }

  // Fit the default bezels into view on first load (when there is no saved view).
  useEffect(() => {
    if (!initial.current) zoomToFit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Replace this page with its default content (undo restores the previous content). */
  const resetPage = () => {
    snapshot(true)
    const next = defaultEls(page)
    elsRef.current = next
    setEls(next)
    setSelectedId(null)
    zoomToFit()
  }

  /** Add the default device bezels below the existing content, under all rectangles. */
  const addBezels = () => {
    const list = elsRef.current
    const bottom = list.length ? Math.max(...list.map((e) => e.y + e.h)) + 400 : 0
    const left = list.length ? Math.min(...list.map((e) => e.x)) : 0
    const bezels = defaultBezels(left, bottom)
    snapshot(true)
    const firstRect = list.findIndex((e) => e.type === 'rect')
    const next = firstRect === -1 ? [...list, ...bezels] : [...list.slice(0, firstRect), ...bezels, ...list.slice(firstRect)]
    elsRef.current = next
    setEls(next)
    zoomToFit()
  }

  const toWorld = (clientX: number, clientY: number): Point => {
    const r = svgRef.current!.getBoundingClientRect()
    const v = viewRef.current
    return { x: (clientX - r.left - v.x) / v.scale, y: (clientY - r.top - v.y) / v.scale }
  }

  // Wheel: pinch / ctrl / cmd zooms, plain scroll pans.
  useEffect(() => {
    const svg = svgRef.current!
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        const r = svg.getBoundingClientRect()
        zoomAt(Math.exp(-e.deltaY * 0.01), { x: e.clientX - r.left, y: e.clientY - r.top })
      } else {
        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }))
      }
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  // ---------- pointer interaction ----------
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    const target = e.target as Element
    const handle = target.getAttribute('data-handle') as Handle | null
    const id = target.closest('[data-id]')?.getAttribute('data-id') ?? null
    const p = toWorld(e.clientX, e.clientY)

    if (e.button === 1 || (e.button === 0 && spaceRef.current) || (e.button === 0 && tool === 'select' && !id && !handle)) {
      if (e.button === 0 && !spaceRef.current) setSelectedId(null)
      dragRef.current = { kind: 'pan', startClient: { x: e.clientX, y: e.clientY }, orig: viewRef.current }
      return
    }
    if (e.button !== 0) return

    if (tool === 'rect') {
      const el = newRect(Math.round(p.x), Math.round(p.y), 0, 0)
      snapshot(true)
      setEls((prev) => [...prev, el])
      setSelectedId(el.id)
      dragRef.current = { kind: 'create', id: el.id, start: { x: Math.round(p.x), y: Math.round(p.y) } }
      return
    }

    if (handle && selected) {
      snapshot(true)
      dragRef.current = { kind: 'resize', id: selected.id, handle, start: p, orig: selected }
      return
    }
    if (id) {
      const el = elsRef.current.find((x) => x.id === id)!
      setSelectedId(id)
      snapshot(true)
      dragRef.current = { kind: 'move', id, start: p, orig: el }
    }
  }

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      if (d.kind === 'pan') {
        setView({ ...d.orig, x: d.orig.x + e.clientX - d.startClient.x, y: d.orig.y + e.clientY - d.startClient.y })
        return
      }
      const p = toWorld(e.clientX, e.clientY)
      if (d.kind === 'move') {
        patch(d.id, { x: Math.round(d.orig.x + p.x - d.start.x), y: Math.round(d.orig.y + p.y - d.start.y) }, { history: false })
      } else if (d.kind === 'create') {
        let w = p.x - d.start.x
        let h = p.y - d.start.y
        if (e.shiftKey) {
          const s = Math.max(Math.abs(w), Math.abs(h))
          w = Math.sign(w || 1) * s
          h = Math.sign(h || 1) * s
        }
        patch(
          d.id,
          {
            x: Math.round(Math.min(d.start.x, d.start.x + w)),
            y: Math.round(Math.min(d.start.y, d.start.y + h)),
            w: Math.round(Math.abs(w)),
            h: Math.round(Math.abs(h)),
          },
          { history: false },
        )
      } else if (d.kind === 'resize') {
        patch(d.id, resize(d.orig, d.handle, p.x - d.start.x, p.y - d.start.y, e.shiftKey), { history: false })
      }
    }
    const onUp = () => {
      const d = dragRef.current
      dragRef.current = null
      if (d?.kind === 'create') {
        const el = elsRef.current.find((x) => x.id === d.id)
        if (el && el.w < 4 && el.h < 4) patch(d.id, { w: 200, h: 120 }, { history: false })
        else if (el) patch(d.id, { w: Math.max(1, el.w), h: Math.max(1, el.h) }, { history: false })
        setTool('select')
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  })

  // ---------- keyboard / paste ----------
  useEffect(() => {
    const isTyping = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isTyping(e.target)) return (e.target as HTMLElement).blur()
        setTool('select')
        setSelectedId(null)
        return
      }
      if (isTyping(e.target)) return
      const mod = e.metaKey || e.ctrlKey
      if (e.code === 'Space') {
        spaceRef.current = true
        document.body.classList.add('panning')
        e.preventDefault()
        return
      }
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        return e.shiftKey ? redo() : undo()
      }
      if (mod && e.key.toLowerCase() === 'y') return redo()
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        return duplicateSelected()
      }
      if (mod && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        return zoomAt(1.25)
      }
      if (mod && e.key === '-') {
        e.preventDefault()
        return zoomAt(0.8)
      }
      if (mod && e.key === '0') {
        e.preventDefault()
        return zoomAt(1 / viewRef.current.scale)
      }
      if (e.shiftKey && e.key === '!') return zoomToFit()
      if (mod) return
      if (e.key === 'v' || e.key === 'V') return setTool('select')
      if (e.key === 'r' || e.key === 'R') return setTool('rect')
      if (e.key === 'Delete' || e.key === 'Backspace') return removeSelected()
      const arrows: Record<string, Point> = {
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
      }
      if (arrows[e.key] && selected) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        patch(selected.id, { x: selected.x + arrows[e.key].x * step, y: selected.y + arrows[e.key].y * step })
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceRef.current = false
        document.body.classList.remove('panning')
      }
    }
    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e.target)) return
      const files = Array.from(e.clipboardData?.files ?? [])
      if (files.length) {
        e.preventDefault()
        addImages(files)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('paste', onPaste)
    }
  })

  // ---------- persistence ----------
  const warnedRef = useRef(false)
  const save = useCallback(() => {
    try {
      localStorage.setItem(storageKey(page), JSON.stringify({ els: elsRef.current, view: viewRef.current }))
    } catch {
      if (!warnedRef.current) {
        warnedRef.current = true
        flash('Autosave failed (images too large for localStorage)')
      }
    }
  }, [page])
  useEffect(() => {
    const t = window.setTimeout(save, 300)
    return () => window.clearTimeout(t)
  }, [els, view, save])
  // Save right away when you switch pages or close the tab, so the last edit is not lost.
  useEffect(() => {
    window.addEventListener('pagehide', save)
    return () => {
      window.removeEventListener('pagehide', save)
      save()
    }
  }, [save])

  // ---------- render ----------
  const s = view.scale
  const sceneSvg = sceneToSvg(els, includeImages)

  return (
    <div className="app">
      <header className="toolbar">
        <div className="app-title">Device Screen Shape Editor</div>
        <div className="group">
          <div className="segmented">
            {PAGES.map((p) => (
              <button
                key={p.id}
                className={p.id === page ? 'active' : ''}
                title={p.title}
                onClick={() => (window.location.hash = p.id === 'main' ? '' : p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          {page !== 'main' && (
            <button onClick={resetPage} title="Replace this page with the original example (⌘Z to undo)">
              ↺ Reset example
            </button>
          )}
        </div>
        <div className="group">
          <button className={tool === 'select' ? 'active' : ''} onClick={() => setTool('select')} title="Select / move (V)">
            ↖ Select
          </button>
          <button className={tool === 'rect' ? 'active' : ''} onClick={() => setTool('rect')} title="Draw rectangle (R)">
            ▢ Rectangle
          </button>
          <button onClick={addRectAtCenter} title="Add a 200×120 rectangle in the center">
            + Rect
          </button>
          <button onClick={() => fileRef.current?.click()} title="Add image (or drop / paste)">
            🖼 Image
          </button>
          <button onClick={addBezels} title="Add silver / white iPhone 18, 17, 16 and Duo bezels">
            📱 Bezels
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              addImages(Array.from(e.target.files ?? []))
              e.target.value = ''
            }}
          />
        </div>
        <div className="group">
          <button onClick={undo} title="Undo (⌘Z)">↶</button>
          <button onClick={redo} title="Redo (⌘⇧Z)">↷</button>
        </div>
        <div className="group">
          <button onClick={() => zoomAt(0.8)} title="Zoom out (⌘-)">−</button>
          <button onClick={() => zoomAt(1 / s)} title="Reset to 100% (⌘0)" className="zoom-label">
            {Math.round(s * 100)}%
          </button>
          <button onClick={() => zoomAt(1.25)} title="Zoom in (⌘+)">+</button>
          <button onClick={zoomToFit} title="Zoom to fit (⇧1)">Fit</button>
        </div>
        <div className="group">
          <label className="check">
            <input type="checkbox" checked={showBezier} onChange={(e) => setShowBezier(e.target.checked)} />
            Show curve handles
          </label>
        </div>
        <div className="spacer" />
        <div className="group">
          <label className="check">
            <input type="checkbox" checked={includeImages} onChange={(e) => setIncludeImages(e.target.checked)} />
            Include images
          </label>
          <button
            className="primary"
            disabled={!sceneSvg}
            onClick={() => copyText(sceneSvg).then(() => flash('Copied SVG of all shapes'))}
          >
            Copy all SVG
          </button>
        </div>
      </header>

      <aside className="layers">
        <h3>Layers</h3>
        {els.length === 0 && <p className="hint">Drop or paste an image, or press R and drag to draw a rectangle.</p>}
        <ul>
          {[...els].reverse().map((el) => (
            <li key={el.id} className={el.id === selectedId ? 'selected' : ''} onClick={() => setSelectedId(el.id)}>
              <span className="icon">{el.type === 'rect' ? '▢' : '🖼'}</span>
              <span className="name">{el.name}</span>
            </li>
          ))}
        </ul>
        <div className="help">
          <b>Shortcuts</b>
          <div>V select · R draw rect</div>
          <div>Drag empty canvas / Space+drag: pan</div>
          <div>Scroll: pan · Pinch / ⌘+scroll: zoom</div>
          <div>Shift while resizing: lock ratio (images: unlock)</div>
          <div>Arrows: nudge (Shift ×10)</div>
          <div>⌘D duplicate · ⌫ delete · ⌘Z undo</div>
          <div>Drag a field label to scrub its value</div>
        </div>
      </aside>

      <main
        className={`canvas ${dragOver ? 'drag-over' : ''} tool-${tool}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          addImages(Array.from(e.dataTransfer.files), toWorld(e.clientX, e.clientY))
        }}
      >
        <svg ref={svgRef} onPointerDown={onPointerDown}>
          <g transform={`translate(${view.x} ${view.y}) scale(${s})`}>
            {els.map((el) =>
              el.type === 'rect' ? (
                <path
                  key={el.id}
                  data-id={el.id}
                  className="shape"
                  transform={`translate(${el.x} ${el.y})`}
                  d={rectPath(el)}
                  fill={el.fill}
                  opacity={el.opacity}
                  stroke={el.strokeWidth > 0 ? el.stroke : undefined}
                  strokeWidth={el.strokeWidth > 0 ? el.strokeWidth : undefined}
                />
              ) : (
                <image
                  key={el.id}
                  data-id={el.id}
                  className="shape"
                  x={el.x}
                  y={el.y}
                  width={el.w}
                  height={el.h}
                  href={el.src}
                  opacity={el.opacity}
                  preserveAspectRatio="none"
                />
              ),
            )}
            {selected && <SelectionOverlay el={selected} scale={s} showBezier={showBezier} />}
          </g>
        </svg>
        {toast && <div className="toast">{toast}</div>}
      </main>

      <aside className="props">
        {selected ? (
          <Properties
            el={selected}
            patch={(p) => patch(selected.id, p)}
            onDelete={removeSelected}
            onDuplicate={duplicateSelected}
            onReorder={reorder}
            onCopy={(text, msg) => copyText(text).then(() => flash(msg))}
          />
        ) : (
          <div className="section">
            <h3>Scene SVG</h3>
            <p className="hint">Select a shape to edit it. This is the SVG of all rectangles{includeImages ? ' and images' : ''}.</p>
            <textarea readOnly value={sceneSvg} rows={16} spellCheck={false} />
          </div>
        )}
      </aside>
    </div>
  )
}

function resize(orig: El, handle: Handle, dx: number, dy: number, shift: boolean): Partial<El> {
  // Images keep their ratio by default, rectangles only while Shift is held.
  const lock = orig.type === 'image' ? !shift : shift
  let { x, y, w, h } = orig
  if (handle.includes('e')) w = orig.w + dx
  if (handle.includes('w')) w = orig.w - dx
  if (handle.includes('s')) h = orig.h + dy
  if (handle.includes('n')) h = orig.h - dy
  if (lock && orig.w > 0 && orig.h > 0) {
    const ratio = orig.w / orig.h
    if (handle === 'n' || handle === 's') w = h * ratio
    else if (handle === 'e' || handle === 'w') h = w / ratio
    else if (Math.abs(w / orig.w) > Math.abs(h / orig.h)) h = w / ratio
    else w = h * ratio
  }
  w = Math.max(1, Math.round(w))
  h = Math.max(1, Math.round(h))
  if (handle.includes('w')) x = orig.x + orig.w - w
  if (handle.includes('n')) y = orig.y + orig.h - h
  // Edge handles with locked ratio grow symmetrically around the center.
  if (lock && (handle === 'n' || handle === 's')) x = Math.round(orig.x + (orig.w - w) / 2)
  if (lock && (handle === 'e' || handle === 'w')) y = Math.round(orig.y + (orig.h - h) / 2)
  return { x, y, w, h }
}

function SelectionOverlay({ el, scale, showBezier }: { el: El; scale: number; showBezier: boolean }) {
  const hs = 8 / scale
  const pos: Record<Handle, Point> = {
    nw: { x: 0, y: 0 },
    n: { x: el.w / 2, y: 0 },
    ne: { x: el.w, y: 0 },
    e: { x: el.w, y: el.h / 2 },
    se: { x: el.w, y: el.h },
    s: { x: el.w / 2, y: el.h },
    sw: { x: 0, y: el.h },
    w: { x: 0, y: el.h / 2 },
  }
  const segments = el.type === 'rect' && showBezier ? rectCorners(el).flatMap((c) => c.segments) : []
  const anchor = (p: Point) => (
    <rect x={p.x - 2.5 / scale} y={p.y - 2.5 / scale} width={5 / scale} height={5 / scale} className="anchor" />
  )
  return (
    <g transform={`translate(${el.x} ${el.y})`} className="overlay">
      <rect width={el.w} height={el.h} className="outline" vectorEffect="non-scaling-stroke" />
      {segments.map((c, i) => (
        <g key={i} className="bezier">
          <line x1={c.from.x} y1={c.from.y} x2={c.c1.x} y2={c.c1.y} vectorEffect="non-scaling-stroke" />
          <line x1={c.to.x} y1={c.to.y} x2={c.c2.x} y2={c.c2.y} vectorEffect="non-scaling-stroke" />
          <circle cx={c.c1.x} cy={c.c1.y} r={3 / scale} />
          <circle cx={c.c2.x} cy={c.c2.y} r={3 / scale} />
          {anchor(c.from)}
          {anchor(c.to)}
        </g>
      ))}
      {HANDLES.map((h) => (
        <rect
          key={h}
          data-handle={h}
          className={`handle handle-${h}`}
          x={pos[h].x - hs / 2}
          y={pos[h].y - hs / 2}
          width={hs}
          height={hs}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <text x={el.w / 2} y={el.h + 20 / scale} fontSize={11 / scale} className="size-label">
        {el.w} × {el.h}
      </text>
    </g>
  )
}

type PropsPanelProps = {
  el: El
  patch: (p: Partial<RectEl> | Partial<ImageEl>) => void
  onDelete: () => void
  onDuplicate: () => void
  onReorder: (dir: 'up' | 'down' | 'top' | 'bottom') => void
  onCopy: (text: string, msg: string) => void
}

function Properties({ el, patch, onDelete, onDuplicate, onReorder, onCopy }: PropsPanelProps) {
  return (
    <>
      <div className="section">
        <input className="name-input" value={el.name} onChange={(e) => patch({ name: e.target.value })} />
        <div className="grid2">
          <NumField label="X" value={el.x} onChange={(x) => patch({ x })} />
          <NumField label="Y" value={el.y} onChange={(y) => patch({ y })} />
          <NumField label="W" value={el.w} min={1} onChange={(w) => patch({ w })} />
          <NumField label="H" value={el.h} min={1} onChange={(h) => patch({ h })} />
        </div>
        <div className="row-label">Opacity</div>
        <SliderField
          label="%"
          value={Math.round(el.opacity * 100)}
          min={0}
          max={100}
          sliderMax={100}
          onChange={(v) => patch({ opacity: v / 100 })}
        />
      </div>

      {el.type === 'rect' ? <RectProps el={el} patch={patch} onCopy={onCopy} /> : <ImageProps el={el} patch={patch} />}

      <div className="section">
        <div className="buttons">
          <button onClick={() => onReorder('top')} title="Bring to front">⤒</button>
          <button onClick={() => onReorder('up')} title="Bring forward">↑</button>
          <button onClick={() => onReorder('down')} title="Send backward">↓</button>
          <button onClick={() => onReorder('bottom')} title="Send to back">⤓</button>
          <button onClick={onDuplicate}>Duplicate</button>
          <button className="danger" onClick={onDelete}>Delete</button>
        </div>
      </div>
    </>
  )
}

function ImageProps({ el, patch }: { el: ImageEl; patch: PropsPanelProps['patch'] }) {
  const scaleTo = (f: number) => patch({ w: Math.round(el.naturalW * f), h: Math.round(el.naturalH * f) })
  return (
    <div className="section">
      <h3>Image</h3>
      <p className="hint">
        Natural size {el.naturalW} × {el.naturalH}
      </p>
      <div className="buttons">
        <button onClick={() => scaleTo(1)}>100%</button>
        <button onClick={() => scaleTo(0.5)}>50% (@2x)</button>
        <button onClick={() => scaleTo(1 / 3)}>33% (@3x)</button>
      </div>
    </div>
  )
}

function RectProps({ el, patch, onCopy }: { el: RectEl; patch: PropsPanelProps['patch']; onCopy: PropsPanelProps['onCopy'] }) {
  const setCorner = (i: number, c: Partial<Corner>) => {
    const corners = el.corners.map((old, j) => (el.linked || i === j ? { ...old, ...c } : old)) as Corners
    patch({ corners })
  }
  const maxR = Math.ceil(Math.min(el.w, el.h) / 2)
  const svg = rectToSvg(el)
  const d = rectPath(el)
  const se = el.superellipse
  const setSe = (p: Partial<Superellipse>) => patch({ superellipse: { ...se, ...p } })
  const setSeCorner = (i: number, c: Partial<SuperellipseCorner>) =>
    setSe({ corners: se.corners.map((old, j) => (se.linked || i === j ? { ...old, ...c } : old)) as Superellipse['corners'] })
  const minSide = Math.min(el.w, el.h)
  const seRadii = superellipseRadii(el.w, el.h, se)
  const labels = ['Top left', 'Top right', 'Bottom right', 'Bottom left']

  const cornerEditor = (i: number) => (
    <div key={i} className="corner">
      {!el.linked && <div className="row-label">{labels[i]}</div>}
      <SliderField
        label="Radius"
        title="Distance from the corner where the curve starts"
        value={el.corners[i].r}
        min={0}
        sliderMax={Math.max(maxR, el.corners[i].r)}
        onChange={(r) => setCorner(i, { r })}
      />
      <SliderField
        label="Tension"
        title="Bezier control point position: 0 = chamfer, 0.5523 = circle, 1 = handles at the sharp corner"
        value={el.corners[i].t}
        min={0}
        max={1.5}
        step={0.01}
        precision={4}
        sliderMax={1}
        onChange={(t) => setCorner(i, { t })}
      />
    </div>
  )

  return (
    <>
      <div className="section">
        <h3>Fill & stroke</h3>
        <div className="color-row">
          <input type="color" value={el.fill} onChange={(e) => patch({ fill: e.target.value })} />
          <input className="hex" value={el.fill} onChange={(e) => patch({ fill: e.target.value })} spellCheck={false} />
        </div>
        <div className="color-row">
          <input type="color" value={el.stroke} onChange={(e) => patch({ stroke: e.target.value })} />
          <input className="hex" value={el.stroke} onChange={(e) => patch({ stroke: e.target.value })} spellCheck={false} />
          <NumField label="Stroke" value={el.strokeWidth} min={0} step={0.5} precision={2} onChange={(strokeWidth) => patch({ strokeWidth })} />
        </div>
      </div>

      <div className="section">
        <h3>Corners</h3>
        <div className="segmented">
          <button
            className={el.cornerType === 'superellipse' ? 'active' : ''}
            onClick={() => patch({ cornerType: 'superellipse' })}
          >
            Superellipse
          </button>
          <button className={el.cornerType === 'bezier' ? 'active' : ''} onClick={() => patch({ cornerType: 'bezier' })}>
            Bezier
          </button>
        </div>
      </div>

      {el.cornerType === 'superellipse' ? (
        <div className="section">
          <div className="section-head">
            <h3>Superellipse corners</h3>
            <button
              onClick={() => setSe(defaultSuperellipse())}
              title="Shape from the sample code: all corners n = 3.74, size = 25.2% of the shorter side"
            >
              ↺ Reset to default
            </button>
          </div>
          <p className="hint">
            Each corner is a quarter of |x|<sup>n</sup> + |y|<sup>n</sup> = 1. The curvature is 0 where it meets the
            straight edge.
          </p>
          <label className="check">
            <input
              type="checkbox"
              checked={se.linked}
              onChange={(e) => {
                const linked = e.target.checked
                // Re-linking copies the top-left corner to all corners.
                setSe(
                  linked
                    ? { linked, corners: se.corners.map(() => ({ ...se.corners[0] })) as Superellipse['corners'] }
                    : { linked },
                )
              }}
            />
            Same for all corners
          </label>
          <div className="row-label">Size unit (where the curve starts)</div>
          <div className="segmented">
            {(['%', 'px'] as const).map((unit) => (
              <button
                key={unit}
                className={se.unit === unit ? 'active' : ''}
                onClick={() =>
                  // Convert every corner so the shape does not change when you switch the unit.
                  se.unit !== unit &&
                  setSe({
                    unit,
                    corners: se.corners.map((c, k) => ({
                      ...c,
                      size: Number(fmt(unit === '%' ? (seRadii[k] / minSide) * 100 : seRadii[k])),
                    })) as Superellipse['corners'],
                  })
                }
              >
                {unit === '%' ? '% of shorter side' : 'px'}
              </button>
            ))}
          </div>
          {(se.linked ? [0] : [0, 1, 2, 3]).map((i) => (
            <div key={i} className="corner">
              {!se.linked && <div className="row-label">{labels[i]}</div>}
              <SliderField
                label="Exponent"
                title="n: 1 = chamfer, 2 = circle, higher = flatter near the edges and tighter in the middle"
                value={se.corners[i].n}
                min={1}
                max={20}
                step={0.01}
                precision={2}
                sliderMax={10}
                onChange={(n) => setSeCorner(i, { n })}
              />
              {se.unit === '%' ? (
                <SliderField
                  label="Size %"
                  value={se.corners[i].size}
                  min={0}
                  max={100}
                  step={0.1}
                  precision={2}
                  sliderMax={50}
                  onChange={(size) => setSeCorner(i, { size })}
                />
              ) : (
                <SliderField
                  label="Size px"
                  value={se.corners[i].size}
                  min={0}
                  precision={2}
                  sliderMax={Math.max(maxR, se.corners[i].size)}
                  onChange={(size) => setSeCorner(i, { size })}
                />
              )}
              <p className="hint">
                = {fmt(seRadii[i])} px ({fmt((seRadii[i] / minSide) * 100)}% of {minSide} px)
              </p>
            </div>
          ))}
          {se.unit === '%' && <p className="hint">Sizes in % follow the rectangle size.</p>}
          <div className="row-label">Exponent presets</div>
          <div className="buttons">
            {EXPONENT_PRESETS.map(([name, n]) => (
              <button
                key={name}
                className={se.corners.every((c) => c.n === n) ? 'active' : ''}
                onClick={() => setSe({ corners: se.corners.map((c) => ({ ...c, n })) as Superellipse['corners'] })}
                title={`Set the exponent of all corners to ${n}`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="section">
          <h3>Bezier corners</h3>
          <label className="check">
            <input
              type="checkbox"
              checked={el.linked}
              onChange={(e) => {
                const linked = e.target.checked
                // Re-linking copies the top-left corner to all corners.
                patch(linked ? { linked, corners: el.corners.map(() => ({ ...el.corners[0] })) as Corners } : { linked })
              }}
            />
            Same for all corners
          </label>
          {el.linked ? cornerEditor(0) : [0, 1, 2, 3].map(cornerEditor)}
          <div className="row-label">Tension presets</div>
          <div className="buttons">
            {TENSION_PRESETS.map(([name, t]) => (
              <button
                key={name}
                onClick={() => patch({ corners: el.corners.map((c) => ({ ...c, t })) as Corners })}
                title={`Set tension of all corners to ${t}`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="section">
        <h3>SVG code</h3>
        <textarea readOnly value={svg} rows={6} spellCheck={false} />
        <div className="buttons">
          <button className="primary" onClick={() => onCopy(svg, 'Copied SVG')}>Copy SVG</button>
          <button onClick={() => onCopy(d, 'Copied path d')}>Copy path d</button>
        </div>
      </div>
    </>
  )
}
