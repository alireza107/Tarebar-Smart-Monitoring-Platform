'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, ChevronDown, FileJson, FileSpreadsheet, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  GRADE_LABELS_FA,
  SEVERITY_LABELS_FA,
  shareBandFa,
  type FruitQualityResult,
  type QualityAspect,
} from '@/modules/analysis-records/types'
import { exportQualityCsv, exportQualityJson, qualityGrade, type QualityExportContext } from './quality-export'

const fa = (value: number, digits = 0) => value.toLocaleString('fa-IR', { maximumFractionDigits: digits })

export function labelTone(label: string) {
  if (label === 'تازه' || label === 'تقریباً تازه') return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  if (label === 'فاسد' || label === 'تقریباً فاسد') return 'border-red-200 bg-red-50 text-red-800'
  return 'border-amber-200 bg-amber-50 text-amber-800'
}

const SEVERITY_TONE = { low: 'text-emerald-700', medium: 'text-amber-700', high: 'text-red-700' } as const

export function QualityResultView({ result, context }: { result: FruitQualityResult; context: QualityExportContext }) {
  const [open, setOpen] = useState(false)
  const grade = qualityGrade(result)
  const scoredFrames = (result.frames ?? []).filter(frame => frame.freshness_score !== null || frame.error || frame.thumbnail)
  const hasDetails = result.detail_level === 'detailed' || scoredFrames.length > 0

  return <section className="space-y-5 rounded-xl border bg-card p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2"><CheckCircle2 className="size-5 text-emerald-600" /><h2 className="font-semibold">گزارش کیفیت میوه</h2></div>
      <div className="flex items-center gap-2">
        {grade && <span className="rounded-full border px-3 py-1 text-xs font-semibold text-muted-foreground">{GRADE_LABELS_FA[grade]}</span>}
        <span className={`rounded-full border px-3 py-1 text-sm font-bold ${labelTone(result.label)}`}>{result.label}</span>
      </div>
    </div>

    <div className="grid gap-3 sm:grid-cols-3">
      <Metric label="امتیاز تازگی" value={`${fa(result.freshness_score)} از ۱۰۰`} />
      <Metric label="اطمینان مدل" value={`${fa(result.confidence)} درصد`} />
      <Metric label="فریم‌های بررسی‌شده" value={fa(result.frame_count)} />
    </div>

    <DistributionBar distribution={result.distribution} />

    {result.verdict_fa && <p className="rounded-lg border bg-muted/30 p-3 text-sm font-medium leading-7">{result.verdict_fa}</p>}
    {!!result.quality_profile?.length && <QualityProfile aspects={result.quality_profile} />}

    <div className="flex flex-wrap items-center gap-2 border-t pt-4">
      {context.recordId && <Link href={`/reports/quality/${context.recordId}`} target="_blank" className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"><Printer className="size-3.5" />گزارش کامل و چاپ / PDF</Link>}
      <Button type="button" variant="outline" size="sm" onClick={() => exportQualityCsv(result, context)}><FileSpreadsheet />خروجی CSV</Button>
      <Button type="button" variant="outline" size="sm" onClick={() => exportQualityJson(result, context)}><FileJson />خروجی JSON</Button>
      <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} className="mr-auto inline-flex items-center gap-1 text-xs font-medium text-primary">
        {open ? 'بستن جزئیات' : 'نمایش جزئیات کامل'}<ChevronDown className={`size-4 transition ${open ? 'rotate-180' : ''}`} />
      </button>
    </div>
    {context.recordId
      ? <p className="text-[11px] text-muted-foreground">این ارزیابی در سوابق ثبت شد و در گزارش مدیریتی مکان مربوط محاسبه می‌شود.</p>
      : <p className="text-[11px] text-amber-700">این ارزیابی در سوابق ثبت نشد؛ خروجی CSV و JSON همچنان در دسترس است.</p>}

    {open && <div className="space-y-5 border-t pt-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Metric label="زمان استنتاج" value={`${fa(result.inference_seconds, 1)} ثانیه`} />
        <Metric label="مدل" value={result.model ?? 'Qwen2.5-VL'} ltr />
      </div>

      {result.recommendation_fa && <Block title="توصیه"><p className="text-sm leading-7">{result.recommendation_fa}</p></Block>}

      {!!result.defects?.length && <Block title="عیوب مشاهده‌شده">
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-right text-xs text-muted-foreground"><th className="p-2">عیب</th><th className="p-2">شدت</th><th className="p-2">گستردگی</th></tr></thead>
          <tbody>{result.defects.map((defect, index) => <tr key={`${defect.type}-${index}`} className="border-b last:border-0"><td className="p-2 font-medium">{defect.label_fa}</td><td className={`p-2 font-medium ${SEVERITY_TONE[defect.severity]}`}>{SEVERITY_LABELS_FA[defect.severity]}</td><td className="p-2">{defect.extent_label_fa ?? '—'}</td></tr>)}</tbody>
        </table></div>
      </Block>}

      {scoredFrames.length > 0 && <Block title="بررسی فریم‌به‌فریم" description={result.frame_statistics?.score_mean != null ? `میانگین ${fa(result.frame_statistics.score_mean, 1)} · کمینه ${fa(result.frame_statistics.score_min ?? 0)} · بیشینه ${fa(result.frame_statistics.score_max ?? 0)} · انحراف معیار ${fa(result.frame_statistics.score_stddev ?? 0, 1)}` : undefined}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{scoredFrames.map(frame => <figure key={frame.index} className="overflow-hidden rounded-lg border bg-muted/20">
          {/* Evidence thumbnails are inline data URLs returned by the analytics service. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {frame.thumbnail && <img src={frame.thumbnail} alt={`فریم ${frame.index + 1}`} className="aspect-video w-full bg-black object-contain" />}
          <figcaption className="space-y-1 p-2 text-xs">
            <div className="flex items-center justify-between"><span className="font-medium">فریم {fa(frame.index + 1)}{frame.timestamp_seconds != null && <span className="mr-1 text-muted-foreground" dir="ltr">{frame.timestamp_seconds.toFixed(1)}s</span>}</span>{frame.freshness_score !== null && <span className="font-bold">{fa(frame.freshness_score)}</span>}</div>
            {frame.label && <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] ${labelTone(frame.label)}`}>{frame.label}</span>}
            {frame.error && <p className="text-red-600">تحلیل این فریم ممکن نشد</p>}
          </figcaption>
        </figure>)}</div>
      </Block>}

      {!hasDetails && <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">برای دریافت عیوب، شاخص‌های آسیب و سطح، و بررسی فریم‌به‌فریم، پیش از اجرا گزینه «تحلیل تفصیلی» را فعال کنید.</p>}
      <p className="text-[11px] text-muted-foreground">این ارزیابی فقط بر پایه شواهد ظاهری تصویر است و جایگزین آزمون کیفیت یا ایمنی غذایی نیست.</p>
    </div>}
  </section>
}

export function DistributionBar({ distribution }: { distribution: { fresh: number; middle: number; rotten: number } }) {
  return <div className="space-y-2">
    <div className="flex h-3 overflow-hidden rounded-full bg-muted" aria-label="توزیع کیفیت میوه‌ها">
      <div className="bg-emerald-500" style={{ width: `${distribution.fresh}%` }} />
      <div className="bg-amber-400" style={{ width: `${distribution.middle}%` }} />
      <div className="bg-red-500" style={{ width: `${distribution.rotten}%` }} />
    </div>
    {/* Bands, not percentages: the model's shares are a judgement of the scene, not a count. */}
    <div className="grid grid-cols-3 gap-2 text-center text-xs"><span className="text-emerald-700">تازه: {shareBandFa(distribution.fresh)}</span><span className="text-amber-700">نشانه‌های کهنگی: {shareBandFa(distribution.middle)}</span><span className="text-red-700">فساد: {shareBandFa(distribution.rotten)}</span></div>
  </div>
}

const ASPECT_TONE = { good: 'border-emerald-200 bg-emerald-50 text-emerald-800', watch: 'border-amber-200 bg-amber-50 text-amber-800', poor: 'border-red-200 bg-red-50 text-red-800' } as const

/** The lot's condition as observable aspects; composed by the analytics service from the validated result. */
export function QualityProfile({ aspects }: { aspects: QualityAspect[] }) {
  return <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
    {aspects.map(aspect => <div key={aspect.key} className="rounded-lg border p-3">
      <div className="flex items-start justify-between gap-2"><p className="text-xs text-muted-foreground">{aspect.label_fa}</p><span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${ASPECT_TONE[aspect.status]}`}>{aspect.value_fa}</span></div>
      {aspect.note_fa && <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{aspect.note_fa}</p>}
    </div>)}
  </div>
}

function Block({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <div className="space-y-2"><div><h3 className="text-sm font-semibold">{title}</h3>{description && <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>}</div>{children}</div>
}

function Metric({ label, value, ltr = false }: { label: string; value: string; ltr?: boolean }) {
  return <div className="rounded-lg border bg-muted/30 p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-xl font-bold" dir={ltr ? 'ltr' : 'auto'}>{value}</p></div>
}
