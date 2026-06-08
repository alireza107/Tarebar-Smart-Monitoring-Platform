import { z } from 'zod'

/**
 * Geometry for Camera <-> Region mappings.
 *
 * Coordinates are NORMALIZED floats in [0,1] relative to the camera frame
 * (origin top-left). This keeps polygons resolution-independent so the same
 * mapping renders correctly regardless of stream/display size.
 *
 * Shapes:
 *   Point   = { x, y }
 *   Polygon = Point[]      (ring, min 3 vertices, implicitly closed)
 *   EffectiveArea = mainPolygon − exclusionPolygons
 */

export const MIN_POLYGON_VERTICES = 3
export const MAX_POLYGON_VERTICES = 200
export const MAX_EXCLUSIONS = 50

export const pointSchema = z.object({
  x: z.number().min(0, 'مختصات باید بین ۰ و ۱ باشد').max(1, 'مختصات باید بین ۰ و ۱ باشد'),
  y: z.number().min(0, 'مختصات باید بین ۰ و ۱ باشد').max(1, 'مختصات باید بین ۰ و ۱ باشد'),
})

export const polygonSchema = z
  .array(pointSchema)
  .min(MIN_POLYGON_VERTICES, `چندضلعی باید حداقل ${MIN_POLYGON_VERTICES} رأس داشته باشد`)
  .max(MAX_POLYGON_VERTICES, `چندضلعی نمی‌تواند بیش از ${MAX_POLYGON_VERTICES} رأس داشته باشد`)
  .refine(isSimplePolygon, { message: 'اضلاع چندضلعی نباید یکدیگر را قطع کنند' })

export const exclusionPolygonsSchema = z
  .array(polygonSchema)
  .max(MAX_EXCLUSIONS, `حداکثر ${MAX_EXCLUSIONS} ناحیه استثناء مجاز است`)
  .default([])

export type Point = z.infer<typeof pointSchema>
export type Polygon = z.infer<typeof polygonSchema>

// ─── Geometry helpers (pure, dependency-free) ────────────────────────────────

/** Signed polygon area via the shoelace formula. */
export function signedArea(poly: Point[]): number {
  let sum = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    sum += a.x * b.y - b.x * a.y
  }
  return sum / 2
}

export function polygonArea(poly: Point[]): number {
  return Math.abs(signedArea(poly))
}

/**
 * Approximate effective area = area(main) − Σ area(exclusion).
 * Assumes exclusions lie inside the main ring and do not overlap each other
 * (the editor enforces this visually); used for UI hints, not billing.
 */
export function effectiveArea(main: Point[], exclusions: Point[][]): number {
  const excl = exclusions.reduce((acc, e) => acc + polygonArea(e), 0)
  return Math.max(0, polygonArea(main) - excl)
}

/** True if point p is strictly/loosely inside ring (ray casting). */
export function pointInPolygon(p: Point, ring: Point[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]
    const b = ring[j]
    const intersects =
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    if (intersects) inside = !inside
  }
  return inside
}

function onSegment(p: Point, q: Point, r: Point): boolean {
  return (
    Math.min(p.x, r.x) <= q.x &&
    q.x <= Math.max(p.x, r.x) &&
    Math.min(p.y, r.y) <= q.y &&
    q.y <= Math.max(p.y, r.y)
  )
}

function orientation(p: Point, q: Point, r: Point): number {
  const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y)
  if (Math.abs(val) < 1e-12) return 0
  return val > 0 ? 1 : 2
}

/** Proper segment intersection test (handles collinear overlap). */
export function segmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const o1 = orientation(p1, p2, p3)
  const o2 = orientation(p1, p2, p4)
  const o3 = orientation(p3, p4, p1)
  const o4 = orientation(p3, p4, p2)

  if (o1 !== o2 && o3 !== o4) return true
  if (o1 === 0 && onSegment(p1, p3, p2)) return true
  if (o2 === 0 && onSegment(p1, p4, p2)) return true
  if (o3 === 0 && onSegment(p3, p1, p4)) return true
  if (o4 === 0 && onSegment(p3, p2, p4)) return true
  return false
}

/** A polygon is "simple" when no two non-adjacent edges cross. */
export function isSimplePolygon(poly: Point[]): boolean {
  const n = poly.length
  if (n < MIN_POLYGON_VERTICES) return false
  for (let i = 0; i < n; i++) {
    const a1 = poly[i]
    const a2 = poly[(i + 1) % n]
    for (let j = i + 1; j < n; j++) {
      // skip adjacent edges (they share a vertex)
      if (j === i) continue
      if (Math.abs(i - j) === 1 || Math.abs(i - j) === n - 1) continue
      const b1 = poly[j]
      const b2 = poly[(j + 1) % n]
      if (segmentsIntersect(a1, a2, b1, b2)) return false
    }
  }
  return true
}
