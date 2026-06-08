'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, Eraser, Undo2, Square, Scissors } from 'lucide-react'
import type { Point } from '@/modules/region/geometry'

const VW = 1000 // virtual canvas width
const VH = 562 // virtual canvas height (≈16:9)

export interface PolygonValue {
  mainPolygon: Point[]
  exclusionPolygons: Point[][]
}

interface PolygonEditorProps {
  value: PolygonValue
  onChange: (next: PolygonValue) => void
  /** Optional camera snapshot rendered behind the polygons. */
  backgroundUrl?: string | null
}

type Target = { ring: 'main' } | { ring: 'exclusion'; index: number }

function toSvg(p: Point): [number, number] {
  return [p.x * VW, p.y * VH]
}

function ringPath(ring: Point[]): string {
  if (ring.length === 0) return ''
  return ring.map((p, i) => `${i === 0 ? 'M' : 'L'} ${(p.x * VW).toFixed(1)} ${(p.y * VH).toFixed(1)}`).join(' ') + ' Z'
}

function area(ring: Point[]): number {
  let s = 0
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    s += a.x * b.y - b.x * a.y
  }
  return Math.abs(s / 2)
}

export function PolygonEditor({ value, onChange, backgroundUrl }: PolygonEditorProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [target, setTarget] = useState<Target>({ ring: 'main' })
  const dragRef = useRef<{ ring: Target; index: number } | null>(null)

  const activeRing: Point[] =
    target.ring === 'main' ? value.mainPolygon : value.exclusionPolygons[target.index] ?? []

  function clientToNorm(e: { clientX: number; clientY: number }): Point {
    const rect = svgRef.current!.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
    return { x: round(x), y: round(y) }
  }

  function setRing(t: Target, ring: Point[]) {
    if (t.ring === 'main') {
      onChange({ ...value, mainPolygon: ring })
    } else {
      const next = value.exclusionPolygons.map((r, i) => (i === t.index ? ring : r))
      onChange({ ...value, exclusionPolygons: next })
    }
  }

  // Click on empty canvas -> append a vertex to the active ring.
  function handleBackgroundPointerDown(e: React.PointerEvent) {
    if (dragRef.current) return
    const p = clientToNorm(e)
    setRing(target, [...activeRing, p])
  }

  function handleVertexPointerDown(e: React.PointerEvent, ringTarget: Target, index: number) {
    e.stopPropagation()
    dragRef.current = { ring: ringTarget, index }
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent) {
    const drag = dragRef.current
    if (!drag) return
    const p = clientToNorm(e)
    const ring = drag.ring.ring === 'main' ? value.mainPolygon : value.exclusionPolygons[drag.ring.index]
    const nextRing = ring.map((pt, i) => (i === drag.index ? p : pt))
    setRing(drag.ring, nextRing)
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (dragRef.current) {
      try {
        ;(e.target as Element).releasePointerCapture(e.pointerId)
      } catch {}
      dragRef.current = null
    }
  }

  function addExclusion() {
    const next = [...value.exclusionPolygons, []]
    onChange({ ...value, exclusionPolygons: next })
    setTarget({ ring: 'exclusion', index: next.length - 1 })
  }

  function undoLastPoint() {
    if (activeRing.length === 0) return
    setRing(target, activeRing.slice(0, -1))
  }

  function clearActive() {
    if (target.ring === 'main') {
      onChange({ ...value, mainPolygon: [] })
    } else {
      const next = value.exclusionPolygons.filter((_, i) => i !== target.index)
      onChange({ ...value, exclusionPolygons: next })
      setTarget({ ring: 'main' })
    }
  }

  const effective = Math.max(
    0,
    area(value.mainPolygon) - value.exclusionPolygons.reduce((acc, r) => acc + area(r), 0),
  )

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={target.ring === 'main' ? 'default' : 'outline'}
          onClick={() => setTarget({ ring: 'main' })}
        >
          <Square /> چندضلعی اصلی
        </Button>
        {value.exclusionPolygons.map((_, i) => (
          <Button
            key={i}
            type="button"
            size="sm"
            variant={target.ring === 'exclusion' && target.index === i ? 'default' : 'outline'}
            onClick={() => setTarget({ ring: 'exclusion', index: i })}
          >
            <Scissors /> استثناء {i + 1}
          </Button>
        ))}
        <Button type="button" size="sm" variant="outline" onClick={addExclusion}>
          <Plus /> ناحیه استثناء
        </Button>
        <div className="mr-auto flex items-center gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={undoLastPoint}>
            <Undo2 /> واگرد نقطه
          </Button>
          <Button type="button" size="sm" variant="destructive" onClick={clearActive}>
            <Eraser /> پاک‌کردن ناحیه فعال
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative w-full overflow-hidden rounded-lg border border-input bg-muted/40" style={{ aspectRatio: '16 / 9' }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VW} ${VH}`}
          className="absolute inset-0 h-full w-full touch-none select-none"
          onPointerDown={handleBackgroundPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {backgroundUrl && (
            <image href={backgroundUrl} x={0} y={0} width={VW} height={VH} preserveAspectRatio="xMidYMid slice" />
          )}
          {!backgroundUrl && <GridBackground />}

          {/* Main polygon */}
          {value.mainPolygon.length > 0 && (
            <path
              d={ringPath(value.mainPolygon)}
              fill="rgba(16,185,129,0.18)"
              stroke="#10b981"
              strokeWidth={2}
            />
          )}

          {/* Exclusion polygons */}
          {value.exclusionPolygons.map((ring, i) =>
            ring.length > 0 ? (
              <path
                key={i}
                d={ringPath(ring)}
                fill="rgba(239,68,68,0.22)"
                stroke="#ef4444"
                strokeWidth={2}
                strokeDasharray="6 4"
              />
            ) : null,
          )}

          {/* Vertices (main) */}
          {value.mainPolygon.map((p, i) => {
            const [cx, cy] = toSvg(p)
            const active = target.ring === 'main'
            return (
              <circle
                key={`m-${i}`}
                cx={cx}
                cy={cy}
                r={active ? 8 : 5}
                fill="#fff"
                stroke="#10b981"
                strokeWidth={2}
                className="cursor-grab"
                onPointerDown={e => handleVertexPointerDown(e, { ring: 'main' }, i)}
              />
            )
          })}

          {/* Vertices (exclusions) */}
          {value.exclusionPolygons.map((ring, ri) =>
            ring.map((p, i) => {
              const [cx, cy] = toSvg(p)
              const active = target.ring === 'exclusion' && target.index === ri
              return (
                <circle
                  key={`e-${ri}-${i}`}
                  cx={cx}
                  cy={cy}
                  r={active ? 8 : 5}
                  fill="#fff"
                  stroke="#ef4444"
                  strokeWidth={2}
                  className="cursor-grab"
                  onPointerDown={e => handleVertexPointerDown(e, { ring: 'exclusion', index: ri }, i)}
                />
              )
            }),
          )}
        </svg>
      </div>

      {/* Status */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          برای افزودن نقطه روی تصویر کلیک کنید؛ برای جابه‌جایی، نقطه را بکشید.
        </span>
        <span>
          رئوس اصلی: {value.mainPolygon.length} · استثناءها: {value.exclusionPolygons.length} · مساحت مؤثر:{' '}
          {(effective * 100).toFixed(1)}٪
        </span>
      </div>
    </div>
  )
}

function GridBackground() {
  const lines = []
  for (let i = 1; i < 10; i++) lines.push(<line key={`v${i}`} x1={(i / 10) * VW} y1={0} x2={(i / 10) * VW} y2={VH} stroke="currentColor" strokeWidth={0.5} className="text-foreground/10" />)
  for (let i = 1; i < 6; i++) lines.push(<line key={`h${i}`} x1={0} y1={(i / 6) * VH} x2={VW} y2={(i / 6) * VH} stroke="currentColor" strokeWidth={0.5} className="text-foreground/10" />)
  return <g>{lines}</g>
}

function round(n: number): number {
  return Math.round(n * 1e4) / 1e4
}
