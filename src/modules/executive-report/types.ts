import type {
  DataQuality,
  DataStatus,
  ManagementAlert,
  ManagementLocationType,
  MetricValue,
  PeakPeriod,
} from '@/modules/management-analytics/types'

export type DimensionKey = 'traffic' | 'service' | 'quality' | 'safety' | 'dataHealth'
export type DimensionStatus = 'good' | 'watch' | 'poor' | 'unknown'

export interface ScoreDimension {
  key: DimensionKey
  label: string
  /** 0–100, or null when there is no data to judge. */
  score: number | null
  status: DimensionStatus
  summary: string
}

export interface ReportHighlight {
  tone: 'positive' | 'negative' | 'neutral'
  text: string
}

export interface ReportRecommendation {
  priority: 'high' | 'medium' | 'low'
  dimension: DimensionKey
  title: string
  detail: string
}

export interface DailyPoint {
  date: string
  value: number | null
  count?: number
}

export interface QualitySection {
  assessments: number
  previousAssessments: number
  averageScore: MetricValue
  averageDistribution: { fresh: number; middle: number; rotten: number } | null
  labels: Array<{ label: string; count: number }>
  grades: Array<{ grade: string; count: number }>
  topDefects: Array<{ type: string; label: string; count: number }>
  daily: DailyPoint[]
  lowest: Array<{ id: string; createdAt: string; locationName: string; label: string; score: number }>
}

export interface SafetySection {
  checks: number
  fights: number
  cleanlinessAlerts: number
  previousFights: number
  previousCleanlinessAlerts: number
  restrictedAreaAlerts: number
  recent: Array<{
    id: string
    createdAt: string
    cameraName: string | null
    locationName: string
    fighting: boolean
    floorClean: boolean
    thumbnail: string | null
  }>
  alerts: ManagementAlert[]
}

export interface ChildRow {
  id: string
  type: Exclude<ManagementLocationType, 'organization'>
  name: string
  occupancy: number | null
  averageWaitMinutes: number | null
  slaPercent: number | null
  qualityScore: number | null
  assessments: number
  incidents: number
}

export interface ExecutiveReport {
  meta: {
    generatedAt: string
    generatedBy: string | null
    location: { type: ManagementLocationType; id: string | null; name: string; parentName: string | null }
    period: { from: string; to: string; days: number }
    comparison: { from: string; to: string } | null
    dataStatus: DataStatus
    dataQuality: DataQuality | null
    cameras: { total: number; withStream: number; calibrated: number }
  }
  scorecard: { overall: number | null; status: DimensionStatus; dimensions: ScoreDimension[] }
  traffic: {
    averageOccupancy: MetricValue
    peakOccupancy: MetricValue
    visitors: MetricValue
    entries: MetricValue
    busiestHours: Array<{ hour: number; value: number }>
    busiestDays: Array<{ day: number; value: number }>
    peakPeriods: PeakPeriod[]
    daily: DailyPoint[]
  }
  service: {
    slaTargetMinutes: number | null
    averageWaitMinutes: MetricValue
    p90WaitMinutes: MetricValue
    slaPercent: MetricValue
    maximumLength: MetricValue
    queues: Array<{
      name: string
      locationName: string
      averageWaitMinutes: number | null
      slaPercent: number | null
      maximumLength: number | null
    }>
  }
  quality: QualitySection
  measurement: {
    runs: number
    averageDiameterMm: MetricValue
    averageFruitCount: number | null
    daily: DailyPoint[]
  }
  safety: SafetySection
  children: { type: ChildRow['type'] | null; rows: ChildRow[] }
  highlights: ReportHighlight[]
  recommendations: ReportRecommendation[]
}

/** Everything the rule engine needs; deliberately free of I/O types. */
export type InsightInput = Pick<
  ExecutiveReport,
  'traffic' | 'service' | 'quality' | 'safety' | 'children'
> & {
  dataQuality: DataQuality | null
  cameras: ExecutiveReport['meta']['cameras']
  measurementRuns: number
}
