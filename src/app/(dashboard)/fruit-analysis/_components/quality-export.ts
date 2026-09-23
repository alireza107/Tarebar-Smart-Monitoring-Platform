import { downloadCsv, downloadJson, fileStamp } from '@/lib/download'
import {
  GRADE_LABELS_FA,
  gradeForScore,
  SEVERITY_LABELS_FA,
  type FruitQualityResult,
} from '@/modules/analysis-records/types'

export interface QualityExportContext {
  /** "دوربین زنده: <name>" or "فایل: <name>" */
  sourceLabel: string
  recordId: string | null
  analyzedAt: Date
}

export function qualityGrade(result: FruitQualityResult) {
  return result.grade ?? gradeForScore(result.freshness_score, result.has_fruit)
}

/** Everything the model returned, minus the bulky evidence images. */
export function exportQualityJson(result: FruitQualityResult, context: QualityExportContext) {
  downloadJson(`fruit-quality-${fileStamp(context.analyzedAt)}.json`, {
    exportedAt: new Date().toISOString(),
    analyzedAt: context.analyzedAt.toISOString(),
    source: context.sourceLabel,
    recordId: context.recordId,
    result: { ...result, frames: (result.frames ?? []).map(frame => ({ ...frame, thumbnail: frame.thumbnail ? '[image omitted]' : null })) },
  })
}

/**
 * One CSV with three blocks (summary, defects, frames). A single file is what
 * managers forward; blocks are separated by an empty row and have own headers.
 */
export function exportQualityCsv(result: FruitQualityResult, context: QualityExportContext) {
  const grade = qualityGrade(result)
  const rows: Array<Array<string | number | null>> = [
    ['زمان ارزیابی', context.analyzedAt.toLocaleString('fa-IR')],
    ['منبع', context.sourceLabel],
    ['شناسه ثبت', context.recordId ?? ''],
    ['میوه دیده شد', result.has_fruit ? 'بله' : 'خیر'],
    ['برچسب کیفیت', result.label],
    ['درجه', grade ? `${grade} (${GRADE_LABELS_FA[grade]})` : ''],
    ['امتیاز تازگی (۰ تا ۱۰۰)', result.freshness_score],
    ['اطمینان مدل (٪)', result.confidence],
    ['سهم تازه (٪)', result.distribution.fresh],
    ['سهم متوسط (٪)', result.distribution.middle],
    ['سهم فاسد (٪)', result.distribution.rotten],
    ['برآورد تعداد میوه', result.fruit_count_estimate],
    ['ماندگاری برآوردی (روز)', result.shelf_life_days_estimate ?? null],
    ['انواع میوه', (result.fruit_types ?? []).map(item => `${item.name_fa}${item.share_percent === null ? '' : ` ${item.share_percent}٪`}`).join('، ')],
    ['نتیجه ارزیابی', result.verdict_fa ?? ''],
    ['توضیح مدل', result.summary_fa],
    ['توصیه', result.recommendation_fa ?? ''],
    ['توصیه نگهداری', result.storage_advice_fa ?? ''],
    ['تعداد فریم بررسی‌شده', result.frame_count],
    ['زمان استنتاج (ثانیه)', result.inference_seconds],
    ['مدل', result.model ?? ''],
  ]
  if (result.defects?.length) {
    rows.push([], ['عیب', 'شدت', 'سهم درگیر (٪)', 'توضیح'])
    for (const defect of result.defects) {
      rows.push([defect.label_fa, SEVERITY_LABELS_FA[defect.severity], defect.affected_percent, defect.note_fa ?? ''])
    }
  }
  const frames = (result.frames ?? []).filter(frame => frame.freshness_score !== null || frame.error)
  if (frames.length) {
    rows.push([], ['فریم', 'زمان (ثانیه)', 'امتیاز تازگی', 'برچسب', 'توضیح', 'خطا'])
    for (const frame of frames) {
      rows.push([frame.index + 1, frame.timestamp_seconds, frame.freshness_score, frame.label ?? '', frame.note_fa ?? '', frame.error ?? ''])
    }
  }
  downloadCsv(`fruit-quality-${fileStamp(context.analyzedAt)}.csv`, ['شاخص', 'مقدار'], rows)
}
