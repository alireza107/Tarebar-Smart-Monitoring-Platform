import { describe, expect, it } from 'vitest'
import { buildHighlights, buildRecommendations, buildScorecard, weekdayName } from '../insights'
import type { InsightInput } from '../types'

const empty = { value: null, changePercent: null }

function input(overrides: Partial<InsightInput> = {}): InsightInput {
  return {
    traffic: { averageOccupancy: empty, peakOccupancy: empty, visitors: empty, entries: empty, busiestHours: [], busiestDays: [], peakPeriods: [], daily: [] },
    service: { slaTargetMinutes: 5, averageWaitMinutes: empty, p90WaitMinutes: empty, slaPercent: empty, maximumLength: empty, queues: [] },
    quality: { assessments: 0, previousAssessments: 0, averageScore: empty, averageDistribution: null, labels: [], grades: [], topDefects: [], daily: [], lowest: [] },
    safety: { checks: 0, fights: 0, cleanlinessAlerts: 0, previousFights: 0, previousCleanlinessAlerts: 0, restrictedAreaAlerts: 0, recent: [], alerts: [] },
    children: { type: null, rows: [] },
    dataQuality: null,
    cameras: { total: 3, withStream: 3, calibrated: 1 },
    measurementRuns: 0,
    ...overrides,
  }
}

describe('buildScorecard', () => {
  it('reports unknown dimensions and no overall score when nothing was measured', () => {
    const card = buildScorecard(input())
    expect(card.overall).toBeNull()
    expect(card.status).toBe('unknown')
    expect(card.dimensions.every(item => item.status === 'unknown')).toBe(true)
  })

  it('does not invent a traffic mark when there is no comparison period to judge the trend by', () => {
    const measured = (value: number) => buildScorecard(input({
      traffic: { ...input().traffic, averageOccupancy: { value, changePercent: null } },
    })).dimensions.find(item => item.key === 'traffic')

    expect(measured(12)).toMatchObject({ score: null, status: 'unknown' })
    expect(measured(12)?.summary).toContain('روند قابل ارزیابی نیست')
    // A camera that never sees anyone is a placement problem worth saying out loud.
    expect(measured(0)).toMatchObject({ score: null, status: 'unknown' })
    expect(measured(0)?.summary).toContain('هیچ فردی')
  })

  it('scores traffic from its change against the comparison period', () => {
    const card = buildScorecard(input({
      traffic: { ...input().traffic, averageOccupancy: { value: 18, changePercent: -22 } },
    }))
    expect(card.dimensions.find(item => item.key === 'traffic')).toMatchObject({ score: 53, status: 'watch' })
  })

  it('weights only the dimensions that have data', () => {
    const card = buildScorecard(input({
      quality: { ...input().quality, assessments: 10, averageScore: { value: 90, changePercent: null } },
      service: { ...input().service, slaPercent: { value: 50, changePercent: null } },
    }))
    // quality 90 × 0.30 + service 50 × 0.25, renormalised over 0.55
    expect(card.overall).toBe(Math.round((90 * 0.3 + 50 * 0.25) / 0.55))
    expect(card.dimensions.find(item => item.key === 'quality')?.status).toBe('good')
    expect(card.dimensions.find(item => item.key === 'service')?.status).toBe('poor')
  })

  it('scores data health as zero when a location has no camera', () => {
    const card = buildScorecard(input({ cameras: { total: 0, withStream: 0, calibrated: 0 } }))
    expect(card.dimensions.find(item => item.key === 'dataHealth')).toMatchObject({ score: 0, status: 'poor' })
  })

  it('penalises fights much more than cleanliness alerts', () => {
    const fights = buildScorecard(input({ safety: { ...input().safety, checks: 10, fights: 2 } }))
    const dirty = buildScorecard(input({ safety: { ...input().safety, checks: 10, cleanlinessAlerts: 2 } }))
    const score = (card: ReturnType<typeof buildScorecard>) => card.dimensions.find(item => item.key === 'safety')!.score!
    expect(score(fights)).toBeLessThan(score(dirty))
    expect(score(fights)).toBe(40)
    expect(score(dirty)).toBe(84)
  })
})

describe('buildRecommendations', () => {
  it('asks for a quality routine when nothing was assessed', () => {
    const titles = buildRecommendations(input()).map(item => item.title)
    expect(titles).toContain('تعریف برنامه منظم ارزیابی کیفیت')
  })

  it('puts high priority items first and names the worst child location', () => {
    const items = buildRecommendations(input({
      quality: {
        ...input().quality, assessments: 12, averageScore: { value: 48, changePercent: -12 },
        averageDistribution: { fresh: 40, middle: 35, rotten: 25 },
        topDefects: [{ type: 'mold', label: 'کپک', count: 7 }],
      },
      children: {
        type: 'booth',
        rows: [
          { id: 'b1', type: 'booth', name: 'غرفه ۱۲', occupancy: null, averageWaitMinutes: null, slaPercent: null, qualityScore: 35, assessments: 6, incidents: 0 },
          { id: 'b2', type: 'booth', name: 'غرفه ۷', occupancy: null, averageWaitMinutes: null, slaPercent: null, qualityScore: 82, assessments: 6, incidents: 0 },
        ],
      },
    }))
    expect(items[0].priority).toBe('high')
    expect(items.find(item => item.title === 'بازرسی فوری کیفیت محصول')?.detail).toContain('غرفه ۱۲')
    expect(items.map(item => item.title)).toEqual(expect.arrayContaining(['جداسازی محصول فاسد', 'رفع عیب پرتکرار: کپک', 'انتقال تجربه واحد برتر']))
    const priorities = items.map(item => item.priority)
    expect([...priorities].sort((a, b) => ['high', 'medium', 'low'].indexOf(a) - ['high', 'medium', 'low'].indexOf(b))).toEqual(priorities)
  })

  it('recommends extra service capacity in the busiest hours when the SLA is missed', () => {
    const items = buildRecommendations(input({
      traffic: { ...input().traffic, busiestHours: [{ hour: 10, value: 40 }, { hour: 17, value: 35 }] },
      service: { ...input().service, slaPercent: { value: 52, changePercent: null }, averageWaitMinutes: { value: 9, changePercent: null } },
    }))
    const item = items.find(entry => entry.dimension === 'service' && entry.priority === 'high')
    expect(item?.detail).toContain('۱۰:۰۰')
    expect(item?.detail).toContain('۱۷:۰۰')
  })

  it('flags fights and missing cameras', () => {
    const items = buildRecommendations(input({
      safety: { ...input().safety, checks: 20, fights: 1 },
      cameras: { total: 0, withStream: 0, calibrated: 0 },
    }))
    expect(items.filter(item => item.priority === 'high').map(item => item.dimension)).toEqual(expect.arrayContaining(['safety', 'dataHealth']))
  })
})

describe('buildHighlights', () => {
  it('mentions a drop in attendance and a clean safety record', () => {
    const texts = buildHighlights(input({
      traffic: { ...input().traffic, averageOccupancy: { value: 18, changePercent: -22 } },
      safety: { ...input().safety, checks: 30 },
    }))
    expect(texts.find(item => item.tone === 'negative')?.text).toContain('کاهش')
    expect(texts.find(item => item.tone === 'positive')?.text).toContain('هیچ درگیری')
  })

  it('stays silent when there is nothing to say', () => {
    expect(buildHighlights(input())).toEqual([])
  })
})

describe('weekdayName', () => {
  it('starts the week on Saturday like the analytics service', () => {
    expect(weekdayName(0)).toBe('شنبه')
    expect(weekdayName(6)).toBe('جمعه')
  })
})
