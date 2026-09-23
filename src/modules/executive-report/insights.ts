// Rule engine of the executive report: turns numbers into a scorecard, plain
// Persian highlights and prioritised recommendations. Pure functions only, so
// every rule is unit-tested without a database or the analytics service.
import { DEFECT_LABELS_FA, gradeForScore, GRADE_LABELS_FA, type DefectType } from '@/modules/analysis-records/types'
import type {
  DimensionKey,
  DimensionStatus,
  InsightInput,
  ReportHighlight,
  ReportRecommendation,
  ScoreDimension,
} from './types'

const DEFAULT_SLA_TARGET_MINUTES = 5

export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  traffic: 'تردد و حضور',
  service: 'صف و خدمت‌رسانی',
  quality: 'کیفیت محصول',
  safety: 'ایمنی و نظافت',
  dataHealth: 'سلامت داده و دوربین‌ها',
}

const WEIGHTS: Record<DimensionKey, number> = {
  quality: 0.3,
  service: 0.25,
  safety: 0.2,
  traffic: 0.15,
  dataHealth: 0.1,
}

const WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه']

export function weekdayName(day: number): string {
  return WEEKDAYS[((day % 7) + 7) % 7]
}

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value))
const fa = (value: number, digits = 0) => value.toLocaleString('fa-IR', { maximumFractionDigits: digits })

function statusFor(score: number | null, good: number, watch: number): DimensionStatus {
  if (score === null) return 'unknown'
  if (score >= good) return 'good'
  if (score >= watch) return 'watch'
  return 'poor'
}

function dimension(key: DimensionKey, score: number | null, good: number, watch: number, summary: string): ScoreDimension {
  const rounded = score === null ? null : Math.round(clamp(score))
  return { key, label: DIMENSION_LABELS[key], score: rounded, status: statusFor(rounded, good, watch), summary }
}

export function scoreTraffic(input: InsightInput): ScoreDimension {
  const { averageOccupancy } = input.traffic
  if (averageOccupancy.value === null) {
    return dimension('traffic', null, 70, 50, 'داده حضور افراد برای این بازه ثبت نشده است.')
  }
  const change = averageOccupancy.changePercent
  if (change === null) {
    // Footfall is judged by its trend. Without a comparison there is nothing to
    // judge, and an invented mark would only distort the overall score.
    return dimension(
      'traffic',
      null,
      70,
      50,
      averageOccupancy.value === 0
        ? 'در این بازه هیچ فردی در دید دوربین‌ها ثبت نشده است؛ زاویه و محل نصب دوربین بررسی شود.'
        : `میانگین حضور ${fa(averageOccupancy.value, 1)} نفر؛ دوره مقایسه داده ندارد و روند قابل ارزیابی نیست.`,
    )
  }
  const direction = change >= 0 ? 'افزایش' : 'کاهش'
  return dimension(
    'traffic',
    75 + clamp(change, -50, 25),
    70,
    50,
    `میانگین حضور ${fa(averageOccupancy.value, 1)} نفر با ${fa(Math.abs(change), 1)}٪ ${direction} نسبت به دوره مقایسه.`,
  )
}

export function scoreService(input: InsightInput): ScoreDimension {
  const sla = input.service.slaPercent.value
  const wait = input.service.averageWaitMinutes.value
  const target = input.service.slaTargetMinutes ?? DEFAULT_SLA_TARGET_MINUTES
  if (sla === null && wait === null) {
    return dimension('service', null, 85, 65, 'برای این مکان صفی پایش نشده یا داده‌ای ثبت نشده است.')
  }
  const score = sla ?? clamp(100 - (wait! / target) * 40)
  const parts = [
    wait === null ? null : `میانگین انتظار ${fa(wait, 1)} دقیقه`,
    sla === null ? null : `${fa(sla, 0)}٪ مراجعان در زمان هدف (${fa(target, 0)} دقیقه) خدمت گرفته‌اند`,
  ].filter(Boolean)
  return dimension('service', score, 85, 65, `${parts.join('؛ ')}.`)
}

export function scoreQuality(input: InsightInput): ScoreDimension {
  const { assessments, averageScore } = input.quality
  if (assessments === 0 || averageScore.value === null) {
    return dimension('quality', null, 80, 60, 'در این بازه ارزیابی کیفیت میوه ثبت نشده است.')
  }
  const grade = gradeForScore(averageScore.value, true)
  return dimension(
    'quality',
    averageScore.value,
    80,
    60,
    `${fa(assessments)} ارزیابی؛ میانگین تازگی ${fa(averageScore.value, 1)} از ۱۰۰${grade ? ` (${GRADE_LABELS_FA[grade]})` : ''}.`,
  )
}

export function scoreSafety(input: InsightInput): ScoreDimension {
  const { checks, fights, cleanlinessAlerts, restrictedAreaAlerts } = input.safety
  if (checks === 0 && restrictedAreaAlerts === 0) {
    return dimension('safety', null, 85, 65, 'در این بازه پایش حادثه یا نظافت انجام نشده است.')
  }
  const fightRate = checks ? fights / checks : 0
  const dirtyRate = checks ? cleanlinessAlerts / checks : 0
  const score = 100 - fightRate * 300 - dirtyRate * 80 - Math.min(20, restrictedAreaAlerts * 2)
  return dimension(
    'safety',
    score,
    85,
    65,
    `${fa(checks)} بازه پایش؛ ${fa(fights)} مورد درگیری، ${fa(cleanlinessAlerts)} هشدار نظافت و ${fa(restrictedAreaAlerts)} هشدار ناحیه ممنوعه.`,
  )
}

export function scoreDataHealth(input: InsightInput): ScoreDimension {
  if (input.cameras.total === 0) {
    return dimension('dataHealth', 0, 90, 70, 'برای این مکان هیچ دوربینی تعریف نشده است.')
  }
  const coverage = input.dataQuality?.coveragePercent ?? null
  if (coverage === null) {
    return dimension('dataHealth', null, 90, 70, `${fa(input.cameras.total)} دوربین تعریف شده ولی داده تجمیعی دریافت نشده است.`)
  }
  return dimension(
    'dataHealth',
    coverage,
    90,
    70,
    `پوشش داده ${fa(coverage, 0)}٪ از ${fa(input.dataQuality?.expectedSources ?? input.cameras.total)} منبع؛ ${fa(input.cameras.total)} دوربین تعریف‌شده.`,
  )
}

export function buildScorecard(input: InsightInput) {
  const dimensions = [scoreQuality(input), scoreService(input), scoreSafety(input), scoreTraffic(input), scoreDataHealth(input)]
  const scored = dimensions.filter(item => item.score !== null)
  const weight = scored.reduce((sum, item) => sum + WEIGHTS[item.key], 0)
  const overall = weight
    ? Math.round(scored.reduce((sum, item) => sum + item.score! * WEIGHTS[item.key], 0) / weight)
    : null
  return { overall, status: statusFor(overall, 80, 60), dimensions }
}

export function buildHighlights(input: InsightInput): ReportHighlight[] {
  const highlights: ReportHighlight[] = []
  const { traffic, service, quality, safety } = input

  const change = traffic.averageOccupancy.changePercent
  if (traffic.averageOccupancy.value !== null && change !== null && Math.abs(change) >= 5) {
    highlights.push({
      tone: change > 0 ? 'positive' : 'negative',
      text: `میانگین حضور افراد نسبت به دوره مقایسه ${fa(Math.abs(change), 1)}٪ ${change > 0 ? 'افزایش' : 'کاهش'} داشته است.`,
    })
  }
  if (traffic.peakOccupancy.value !== null) {
    const hour = traffic.busiestHours[0]
    highlights.push({
      tone: 'neutral',
      text: `اوج حضور ${fa(traffic.peakOccupancy.value)} نفر${hour ? `؛ پرترددترین ساعت روز ${fa(hour.hour)}:۰۰` : ''}${traffic.busiestDays[0] ? ` و پرترددترین روز ${weekdayName(traffic.busiestDays[0].day)}` : ''}.`,
    })
  }
  if (service.slaPercent.value !== null) {
    highlights.push({
      tone: service.slaPercent.value >= 85 ? 'positive' : service.slaPercent.value >= 65 ? 'neutral' : 'negative',
      text: `${fa(service.slaPercent.value, 0)}٪ مراجعان در زمان هدف خدمت گرفته‌اند${service.averageWaitMinutes.value !== null ? `؛ میانگین انتظار ${fa(service.averageWaitMinutes.value, 1)} دقیقه` : ''}.`,
    })
  }
  if (quality.assessments > 0 && quality.averageScore.value !== null) {
    const spoiled = quality.labels
      .filter(item => item.label === 'فاسد' || item.label === 'تقریباً فاسد')
      .reduce((sum, item) => sum + item.count, 0)
    highlights.push({
      tone: quality.averageScore.value >= 80 ? 'positive' : quality.averageScore.value >= 60 ? 'neutral' : 'negative',
      text: `میانگین تازگی محصول ${fa(quality.averageScore.value, 1)} از ۱۰۰ در ${fa(quality.assessments)} ارزیابی${spoiled ? `؛ ${fa(spoiled)} ارزیابی در وضعیت «فاسد» یا «تقریباً فاسد»` : ''}.`,
    })
    const qualityChange = quality.averageScore.changePercent
    if (qualityChange !== null && Math.abs(qualityChange) >= 5) {
      highlights.push({
        tone: qualityChange > 0 ? 'positive' : 'negative',
        text: `امتیاز تازگی نسبت به دوره مقایسه ${fa(Math.abs(qualityChange), 1)}٪ ${qualityChange > 0 ? 'بهتر' : 'بدتر'} شده است.`,
      })
    }
  }
  if (safety.fights > 0) {
    highlights.push({ tone: 'negative', text: `${fa(safety.fights)} مورد درگیری فیزیکی در ${fa(safety.checks)} بازه پایش تشخیص داده شد.` })
  } else if (safety.checks > 0) {
    highlights.push({ tone: 'positive', text: `در ${fa(safety.checks)} بازه پایش هیچ درگیری فیزیکی مشاهده نشد.` })
  }
  if (safety.cleanlinessAlerts > 0) {
    highlights.push({ tone: 'negative', text: `در ${fa(safety.cleanlinessAlerts)} بازه، کف محیط تمیز ارزیابی نشد.` })
  }
  const coverage = input.dataQuality?.coveragePercent ?? null
  if (coverage !== null && coverage < 80) {
    highlights.push({ tone: 'negative', text: `پوشش داده دوربین‌ها ${fa(coverage, 0)}٪ است؛ شاخص‌های تردد و صف با احتیاط تفسیر شوند.` })
  }
  return highlights
}

const DEFECT_ADVICE: Partial<Record<DefectType, string>> = {
  mold: 'رطوبت و تهویه محل نگهداری کنترل و محصول کپک‌زده فوراً جدا شود.',
  decay: 'محصول پوسیده جدا و معدوم شود تا به بار سالم سرایت نکند.',
  bruising: 'شیوه تخلیه، جابه‌جایی و ارتفاع چیدمان بازبینی شود تا کوفتگی کاهش یابد.',
  soft_spot: 'زمان ماند محصول کوتاه و بار رسیده زودتر عرضه شود.',
  wrinkling: 'زمان نگهداری کوتاه‌تر و از سردخانه یا سایه‌بان استفاده شود.',
  dryness: 'محصول از تابش مستقیم و جریان هوای خشک دور نگه داشته شود.',
  discoloration: 'چرخش موجودی (اول‌وارد، اول‌خارج) اجرا شود.',
  cut_damage: 'ابزار و جعبه‌های حمل بازبینی شوند تا آسیب مکانیکی کم شود.',
  pest_damage: 'بار ورودی از نظر آفت بازرسی و محموله آلوده برگشت داده شود.',
}

export function buildRecommendations(input: InsightInput): ReportRecommendation[] {
  const items: ReportRecommendation[] = []
  const { traffic, service, quality, safety, children } = input
  const peakHours = traffic.busiestHours.slice(0, 2).map(item => `${fa(item.hour)}:۰۰`).join(' و ')

  // ── Product quality ────────────────────────────────────────────────────────
  const score = quality.averageScore.value
  if (quality.assessments === 0) {
    items.push({
      priority: 'low',
      dimension: 'quality',
      title: 'تعریف برنامه منظم ارزیابی کیفیت',
      detail: 'در این بازه ارزیابی کیفیتی ثبت نشده است. دست‌کم یک ارزیابی روزانه برای هر غرفه یا دوربین اصلی برنامه‌ریزی شود تا روند کیفیت قابل پایش باشد.',
    })
  } else if (score !== null && score < 60) {
    const worst = [...children.rows].filter(row => row.qualityScore !== null).sort((a, b) => a.qualityScore! - b.qualityScore!)[0]
    items.push({
      priority: 'high',
      dimension: 'quality',
      title: 'بازرسی فوری کیفیت محصول',
      detail: `میانگین تازگی ${fa(score, 1)} از ۱۰۰ است.${worst ? ` پایین‌ترین امتیاز مربوط به «${worst.name}» با ${fa(worst.qualityScore!, 1)} است؛ بازرسی از آنجا آغاز شود.` : ''}`,
    })
  } else if (score !== null && score < 80) {
    items.push({
      priority: 'medium',
      dimension: 'quality',
      title: 'پایش نزدیک‌تر کیفیت و چرخش موجودی',
      detail: `میانگین تازگی ${fa(score, 1)} از ۱۰۰ است. تناوب ارزیابی افزایش یابد و بار قدیمی‌تر زودتر عرضه شود.`,
    })
  }
  if (quality.averageDistribution && quality.averageDistribution.rotten >= 15) {
    items.push({
      priority: 'high',
      dimension: 'quality',
      title: 'جداسازی محصول فاسد',
      detail: `به‌طور میانگین ${fa(quality.averageDistribution.rotten, 0)}٪ محصول مشاهده‌شده فاسد ارزیابی شده است. جداسازی روزانه و ثبت ضایعات انجام شود.`,
    })
  }
  const topDefect = quality.topDefects[0]
  if (topDefect && DEFECT_ADVICE[topDefect.type as DefectType]) {
    items.push({
      priority: 'medium',
      dimension: 'quality',
      title: `رفع عیب پرتکرار: ${DEFECT_LABELS_FA[topDefect.type as DefectType] ?? topDefect.label}`,
      detail: `این عیب در ${fa(topDefect.count)} ارزیابی دیده شده است. ${DEFECT_ADVICE[topDefect.type as DefectType]}`,
    })
  }
  const ranked = children.rows.filter(row => row.qualityScore !== null && row.assessments > 0)
  if (ranked.length >= 2) {
    const sorted = [...ranked].sort((a, b) => b.qualityScore! - a.qualityScore!)
    const best = sorted[0]
    const worst = sorted[sorted.length - 1]
    if (best.qualityScore! - worst.qualityScore! >= 20) {
      items.push({
        priority: 'low',
        dimension: 'quality',
        title: 'انتقال تجربه واحد برتر',
        detail: `فاصله کیفیت «${best.name}» (${fa(best.qualityScore!, 0)}) و «${worst.name}» (${fa(worst.qualityScore!, 0)}) زیاد است. شیوه نگهداری و تأمین واحد برتر به دیگران منتقل شود.`,
      })
    }
  }

  // ── Queues and service ─────────────────────────────────────────────────────
  const sla = service.slaPercent.value
  const wait = service.averageWaitMinutes.value
  const target = service.slaTargetMinutes ?? DEFAULT_SLA_TARGET_MINUTES
  if ((sla !== null && sla < 65) || (wait !== null && wait > target * 1.5)) {
    items.push({
      priority: 'high',
      dimension: 'service',
      title: 'افزایش ظرفیت خدمت‌رسانی در ساعات اوج',
      detail: `${wait !== null ? `میانگین انتظار ${fa(wait, 1)} دقیقه است` : `تحقق زمان هدف ${fa(sla!, 0)}٪ است`}.${peakHours ? ` در ساعات ${peakHours} نیروی خدمت یا باجه اضافه شود.` : ' نیروی خدمت یا باجه اضافه شود.'}`,
    })
  } else if (sla !== null && sla < 85) {
    items.push({
      priority: 'medium',
      dimension: 'service',
      title: 'بهبود زمان انتظار',
      detail: `تحقق زمان هدف ${fa(sla, 0)}٪ است.${peakHours ? ` برنامه شیفت در ساعات ${peakHours} بازبینی شود.` : ''}`,
    })
  }
  const longest = [...service.queues].filter(item => item.averageWaitMinutes !== null).sort((a, b) => b.averageWaitMinutes! - a.averageWaitMinutes!)[0]
  if (longest && longest.averageWaitMinutes! > target) {
    items.push({
      priority: 'medium',
      dimension: 'service',
      title: `رسیدگی به صف «${longest.name}»`,
      detail: `طولانی‌ترین انتظار در «${longest.locationName}» با میانگین ${fa(longest.averageWaitMinutes!, 1)} دقیقه ثبت شده است.`,
    })
  }

  // ── Safety and cleanliness ─────────────────────────────────────────────────
  if (safety.fights > 0) {
    items.push({
      priority: 'high',
      dimension: 'safety',
      title: 'بازبینی رویدادهای درگیری',
      detail: `${fa(safety.fights)} مورد درگیری تشخیص داده شده است. تصاویر شاهد بازبینی و حضور حراست در نقاط و ساعات وقوع تقویت شود.`,
    })
  }
  if (safety.checks > 0 && safety.cleanlinessAlerts / safety.checks >= 0.2) {
    items.push({
      priority: 'medium',
      dimension: 'safety',
      title: 'افزایش نوبت‌های نظافت',
      detail: `در ${fa((safety.cleanlinessAlerts / safety.checks) * 100, 0)}٪ بازه‌های پایش، کف محیط تمیز نبوده است.${peakHours ? ` نوبت نظافت پس از ساعات ${peakHours} اضافه شود.` : ''}`,
    })
  }
  if (safety.restrictedAreaAlerts > 0) {
    items.push({
      priority: 'medium',
      dimension: 'safety',
      title: 'کنترل دسترسی به نواحی ممنوعه',
      detail: `${fa(safety.restrictedAreaAlerts)} هشدار ورود به ناحیه ممنوعه ثبت شده است. موانع فیزیکی و علائم هشدار بازبینی شوند.`,
    })
  }
  if (safety.checks === 0) {
    items.push({
      priority: 'low',
      dimension: 'safety',
      title: 'فعال‌سازی پایش حادثه و نظافت',
      detail: 'پایش دوره‌ای «تشخیص حادثه» روی دوربین‌های اصلی این مکان اجرا شود تا وضعیت ایمنی و نظافت در گزارش بعدی دیده شود.',
    })
  }

  // ── Traffic ────────────────────────────────────────────────────────────────
  const change = traffic.averageOccupancy.changePercent
  if (change !== null && change <= -20) {
    items.push({
      priority: 'medium',
      dimension: 'traffic',
      title: 'بررسی علت افت مراجعه',
      detail: `حضور افراد ${fa(Math.abs(change), 1)}٪ کمتر از دوره مقایسه است. عوامل قیمت، تأمین کالا و دسترسی بررسی شود.`,
    })
  }

  // ── Data health ────────────────────────────────────────────────────────────
  const coverage = input.dataQuality?.coveragePercent ?? null
  if (input.cameras.total === 0) {
    items.push({
      priority: 'high',
      dimension: 'dataHealth',
      title: 'تعریف دوربین برای این مکان',
      detail: 'هیچ دوربینی به این مکان متصل نیست؛ بدون آن شاخص‌های تردد، صف و ایمنی قابل محاسبه نیست.',
    })
  } else if (coverage !== null && coverage < 80) {
    items.push({
      priority: 'medium',
      dimension: 'dataHealth',
      title: 'رفع قطعی دوربین‌ها',
      detail: `پوشش داده ${fa(coverage, 0)}٪ است. دوربین‌های قطع یا بدون استریم در بخش «عملیات زنده» بررسی شوند.`,
    })
  } else if (coverage === null) {
    items.push({
      priority: 'medium',
      dimension: 'dataHealth',
      title: 'بررسی جمع‌آوری داده تحلیلی',
      detail: 'دوربین تعریف شده ولی داده تجمیعی دریافت نشده است. اتصال استریم دوربین‌ها و سرویس تحلیل ویدیو بررسی شود.',
    })
  }
  if (input.cameras.total > 0 && input.cameras.calibrated === 0 && input.measurementRuns === 0) {
    items.push({
      priority: 'low',
      dimension: 'dataHealth',
      title: 'کالیبراسیون دوربین برای اندازه‌گیری میوه',
      detail: 'هیچ دوربینی در این مکان کالیبره نشده است؛ برای گزارش اندازه و تعداد میوه، کالیبراسیون یک دوربین انجام شود.',
    })
  }

  const order = { high: 0, medium: 1, low: 2 } as const
  return items.sort((a, b) => order[a.priority] - order[b.priority])
}
