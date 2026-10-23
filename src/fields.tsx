import { useState } from 'react'

const clamp = (v: number, min = -Infinity, max = Infinity) => Math.min(max, Math.max(min, v))

const show = (v: number, precision: number) => String(Math.round(v * 10 ** precision) / 10 ** precision)

type NumProps = {
  label: string
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
  precision?: number
  title?: string
}

/** Number input. Drag the label left/right to scrub the value (Figma style). */
export function NumField({ label, value, onChange, step = 1, min, max, precision = 0, title }: NumProps) {
  const [text, setText] = useState<string | null>(null)
  const set = (v: number) => onChange(Number(show(clamp(v, min, max), precision)))

  const onScrubStart = (e: React.PointerEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startVal = value
    const move = (ev: PointerEvent) => {
      const mult = ev.shiftKey ? 10 : ev.altKey ? 0.1 : 1
      set(startVal + Math.round((ev.clientX - startX) / 2) * step * mult)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      document.body.classList.remove('scrubbing')
    }
    document.body.classList.add('scrubbing')
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <label className="num" title={title}>
      <span className="num-label" onPointerDown={onScrubStart}>
        {label}
      </span>
      <input
        inputMode="decimal"
        value={text ?? show(value, precision)}
        onFocus={(e) => {
          setText(show(value, precision))
          e.target.select()
        }}
        onBlur={() => setText(null)}
        onChange={(e) => {
          setText(e.target.value)
          const n = parseFloat(e.target.value)
          if (!Number.isNaN(n)) set(n)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            const d = (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1)
            const next = clamp(value + d, min, max)
            set(next)
            setText(show(next, precision))
          }
        }}
      />
    </label>
  )
}

type SliderProps = NumProps & { sliderMax: number }

/** Range slider + number field. The number field may exceed the slider range. */
export function SliderField(props: SliderProps) {
  const { value, onChange, min = 0, sliderMax, step = 1 } = props
  return (
    <div className="slider-field">
      <input
        type="range"
        min={min}
        max={sliderMax}
        step={step}
        value={Math.min(value, sliderMax)}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <NumField {...props} />
    </div>
  )
}
