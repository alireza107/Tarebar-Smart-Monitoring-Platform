import { describe, it, expect } from 'vitest'
import {
  polygonArea,
  effectiveArea,
  pointInPolygon,
  isSimplePolygon,
  polygonSchema,
} from '../geometry'

const SQUARE = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
]

describe('polygonArea', () => {
  it('computes the area of a unit square', () => {
    expect(polygonArea(SQUARE)).toBeCloseTo(1)
  })

  it('is orientation-independent', () => {
    expect(polygonArea([...SQUARE].reverse())).toBeCloseTo(1)
  })
})

describe('effectiveArea', () => {
  it('subtracts exclusion areas from the main polygon', () => {
    const hole = [
      { x: 0.1, y: 0.1 },
      { x: 0.3, y: 0.1 },
      { x: 0.3, y: 0.3 },
      { x: 0.1, y: 0.3 },
    ]
    expect(effectiveArea(SQUARE, [hole])).toBeCloseTo(1 - 0.04)
  })

  it('never goes below zero', () => {
    expect(effectiveArea(SQUARE, [SQUARE, SQUARE])).toBe(0)
  })
})

describe('pointInPolygon', () => {
  it('detects an inside point', () => {
    expect(pointInPolygon({ x: 0.5, y: 0.5 }, SQUARE)).toBe(true)
  })
  it('detects an outside point', () => {
    expect(pointInPolygon({ x: 1.5, y: 0.5 }, SQUARE)).toBe(false)
  })
})

describe('isSimplePolygon', () => {
  it('accepts a convex quad', () => {
    expect(isSimplePolygon(SQUARE)).toBe(true)
  })

  it('rejects a self-intersecting bow-tie', () => {
    const bowtie = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ]
    expect(isSimplePolygon(bowtie)).toBe(false)
  })
})

describe('polygonSchema', () => {
  it('rejects fewer than 3 vertices', () => {
    expect(polygonSchema.safeParse([{ x: 0, y: 0 }, { x: 1, y: 1 }]).success).toBe(false)
  })

  it('rejects coordinates outside [0,1]', () => {
    expect(
      polygonSchema.safeParse([
        { x: 0, y: 0 },
        { x: 1.2, y: 0 },
        { x: 1, y: 1 },
      ]).success,
    ).toBe(false)
  })

  it('rejects a self-intersecting polygon', () => {
    expect(
      polygonSchema.safeParse([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ]).success,
    ).toBe(false)
  })

  it('accepts a valid simple polygon', () => {
    expect(polygonSchema.safeParse(SQUARE).success).toBe(true)
  })
})
