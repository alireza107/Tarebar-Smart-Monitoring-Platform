// Contracts of the AI analysis results (as returned by the video-analytics and
// fruit-pipeline services) and of the records the platform keeps about them.

export const FRUIT_QUALITY_LABELS = [
  'تازه', 'تقریباً تازه', 'متوسط', 'تقریباً فاسد', 'فاسد', 'نامشخص',
] as const
export type FruitQualityLabel = (typeof FRUIT_QUALITY_LABELS)[number]

export type QualityGrade = 'A' | 'B' | 'C' | 'D'

export const DEFECT_TYPES = [
  'bruising', 'mold', 'discoloration', 'soft_spot', 'wrinkling',
  'dryness', 'decay', 'cut_damage', 'pest_damage', 'other',
] as const
export type DefectType = (typeof DEFECT_TYPES)[number]

export const DEFECT_LABELS_FA: Record<DefectType, string> = {
  bruising: 'کوفتگی',
  mold: 'کپک',
  discoloration: 'تغییر رنگ',
  soft_spot: 'نرم‌شدگی',
  wrinkling: 'چروکیدگی',
  dryness: 'خشکی',
  decay: 'پوسیدگی',
  cut_damage: 'بریدگی و آسیب مکانیکی',
  pest_damage: 'آسیب آفت',
  other: 'سایر',
}

export const SEVERITY_LABELS_FA = { low: 'کم', medium: 'متوسط', high: 'زیاد' } as const
export type DefectSeverity = keyof typeof SEVERITY_LABELS_FA

export interface FruitTypeShare {
  name_fa: string
  share_percent: number | null
}

export interface FruitDefect {
  type: DefectType
  label_fa: string
  severity: DefectSeverity
  affected_percent: number | null
  note_fa: string | null
}

export interface QualityFrame {
  index: number
  timestamp_seconds: number | null
  has_fruit: boolean | null
  freshness_score: number | null
  label: string | null
  note_fa: string | null
  thumbnail: string | null
  error: string | null
}

export interface FrameStatistics {
  analyzed: number
  score_min: number | null
  score_max: number | null
  score_mean: number | null
  score_stddev: number | null
}

/** Response of `POST /api/v1/fruit-quality[/from-stream]`. Fields after
 *  `inference_seconds` exist from analysis version 2 and are optional so the UI
 *  keeps working against an older analytics image. */
export interface FruitQualityResult {
  has_fruit: boolean
  label: FruitQualityLabel
  freshness_score: number
  distribution: { fresh: number; middle: number; rotten: number }
  fruit_count_estimate: number | null
  confidence: number
  summary_fa: string
  /** Verdict in words, composed by the analytics service from the validated numbers. */
  verdict_fa?: string | null
  frame_count: number
  inference_seconds: number
  analysis_version?: number
  detail_level?: 'summary' | 'detailed'
  model?: string | null
  grade?: QualityGrade | null
  fruit_types?: FruitTypeShare[]
  defects?: FruitDefect[]
  shelf_life_days_estimate?: number | null
  recommendation_fa?: string | null
  storage_advice_fa?: string | null
  frames?: QualityFrame[]
  frame_statistics?: FrameStatistics | null
  total_seconds?: number
}

export interface IncidentResult {
  answers: { fighting: 'Yes' | 'No'; floor_clean: 'Yes' | 'No' }
  frame_count?: number
  inference_seconds: number
  thumbnail?: string | null
  model?: string | null
}

/** Same thresholds as the analytics service, used when it does not send a grade. */
export function gradeForScore(score: number, hasFruit: boolean): QualityGrade | null {
  if (!hasFruit) return null
  if (score >= 85) return 'A'
  if (score >= 70) return 'B'
  if (score >= 50) return 'C'
  return 'D'
}

export const GRADE_LABELS_FA: Record<QualityGrade, string> = {
  A: 'درجه یک',
  B: 'درجه دو',
  C: 'درجه سه',
  D: 'نامرغوب',
}

/** What is stored in `FruitQualityAssessment.details`. */
export interface QualityDetails {
  analysisVersion: number | null
  verdictFa?: string | null
  fruitTypes: FruitTypeShare[]
  defects: FruitDefect[]
  shelfLifeDaysEstimate: number | null
  storageAdviceFa: string | null
  frameStatistics: FrameStatistics | null
  frames: Array<Omit<QualityFrame, 'thumbnail'>>
  totalSeconds: number | null
}

export interface QualityThumbnail {
  index: number
  timestampSeconds: number | null
  dataUrl: string
}

export interface RecordLocationNames {
  camera: { id: string; name: string } | null
  field: { id: string; name: string } | null
  market: { id: string; name: string } | null
  booth: { id: string; number: string } | null
}

export interface QualityAssessmentRecord extends RecordLocationNames {
  id: string
  source: 'LIVE' | 'UPLOAD'
  cameraId: string | null
  fieldId: string | null
  marketId: string | null
  boothId: string | null
  fileName: string | null
  hasFruit: boolean
  label: string
  grade: string | null
  freshnessScore: number
  confidence: number
  freshPercent: number
  middlePercent: number
  rottenPercent: number
  fruitCountEstimate: number | null
  summaryFa: string
  recommendationFa: string | null
  detailLevel: string
  details: QualityDetails
  thumbnails?: QualityThumbnail[] | null
  frameCount: number
  inferenceSeconds: number
  modelName: string | null
  createdById: string | null
  createdByName: string | null
  createdAt: string
}

export interface IncidentCheckRecord extends RecordLocationNames {
  id: string
  source: 'LIVE' | 'UPLOAD'
  cameraId: string | null
  fieldId: string | null
  marketId: string | null
  boothId: string | null
  fileName: string | null
  fighting: boolean
  floorClean: boolean
  windowLabel: string | null
  windowSeconds: number | null
  frameCount: number
  inferenceSeconds: number
  thumbnail?: string | null
  createdByName: string | null
  createdAt: string
}

export interface MeasurementRunRecord extends RecordLocationNames {
  id: string
  source: 'LIVE' | 'UPLOAD'
  cameraId: string | null
  serviceJobId: string
  processingMode: string | null
  palletType: string | null
  processedFrames: number
  totalFruitObservations: number
  lastFruitCount: number | null
  avgWidthMm: number | null
  avgLengthMm: number | null
  avgDiameterMm: number | null
  createdByName: string | null
  createdAt: string
}
