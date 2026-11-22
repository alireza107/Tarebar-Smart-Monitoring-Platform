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
  type PerFruitQualityItem,
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
  const [selectedFruitId, setSelectedFruitId] = useState<number | null>(null)
  const grade = qualityGrade(result)
  const scoredFrames = (result.frames ?? []).filter(frame => frame.freshness_score !== null || frame.error || frame.thumbnail)
  const perFruit = result.per_fruit_quality ?? []
  const isMeasured = result.quality_mode === 'measured'
  const palletPolygon = result.pallet_polygon ?? context.palletPolygon ?? null
  const imageWidth = result.image_width ?? context.imageWidth ?? null
  const imageHeight = result.image_height ?? context.imageHeight ?? null
  const countedTotal = result.counted_fruits_total ?? context.countedFruitsTotal ?? result.fruit_count_estimate
  const evaluatedCount = result.evaluated_fruits_count ?? (perFruit.length > 0 ? perFruit.length : null)
  const displayScore = result.freshness_score_mean ?? result.freshness_score
  const hasDetails = result.detail_level === 'detailed' || scoredFrames.length > 0 || perFruit.length > 0

  return <section className="space-y-5 rounded-xl border bg-card p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <CheckCircle2 className="size-5 text-emerald-600" />
        <h2 className="font-semibold">گزارش کیفیت میوه</h2>
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${isMeasured ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          {isMeasured ? 'اندازه‌گیری‌شده (تک‌میوه)' : 'مقادیر تخمینی (کلی صحنه)'}
        </span>
        {result.filter_outside_roi && <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-800">فیلتر محدوده پالت فعال</span>}
      </div>
      <div className="flex items-center gap-2">
        {grade && <span className="rounded-full border px-3 py-1 text-xs font-semibold text-muted-foreground">{GRADE_LABELS_FA[grade]}</span>}
        <span className={`rounded-full border px-3 py-1 text-sm font-bold ${labelTone(result.label)}`}>{result.label}</span>
      </div>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Metric label={isMeasured ? 'میانگین امتیاز تازگی (اندازه‌گیری‌شده)' : 'امتیاز تازگی (تخمینی)'} value={`${fa(displayScore, 1)} از ۱۰۰`} />
      <Metric label="تعداد کل میوه‌های شمارش‌شده" value={countedTotal != null ? fa(countedTotal) : '—'} />
      <Metric label="میوه‌های ارزیابی‌شده در ناحیه" value={evaluatedCount != null ? fa(evaluatedCount) : (countedTotal != null ? fa(countedTotal) : '—')} />
      <Metric label="اطمینان مدل" value={`${fa(result.confidence)} درصد`} />
    </div>

    <DistributionBar distribution={result.distribution} measured={isMeasured} />

    {context.previewUrl && imageWidth && imageHeight && (palletPolygon?.length || perFruit.length > 0) && (
      <QualityRoiOverlay
        previewUrl={context.previewUrl}
        imageWidth={imageWidth}
        imageHeight={imageHeight}
        palletPolygon={palletPolygon}
        perFruit={perFruit}
        selectedFruitId={selectedFruitId}
        onSelectFruit={setSelectedFruitId}
      />
    )}

    {perFruit.length > 0 && (
      <PerFruitQualityTable
        items={perFruit}
        selectedFruitId={selectedFruitId}
        onSelectFruit={setSelectedFruitId}
      />
    )}

    {result.summary_fa && <p className="rounded-lg border bg-muted/20 p-3 text-sm leading-7">{result.summary_fa}</p>}
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
        <Metric label="مدل" value={result.model ?? 'Qwen3-VL-2B'} ltr />
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

export function DistributionBar({ distribution, measured = false }: { distribution: { fresh: number; middle: number; rotten: number }; measured?: boolean }) {
  return <div className="space-y-2">
    <div className="flex h-3 overflow-hidden rounded-full bg-muted" aria-label="توزیع کیفیت میوه‌ها">
      <div className="bg-emerald-500" style={{ width: `${distribution.fresh}%` }} />
      <div className="bg-amber-400" style={{ width: `${distribution.middle}%` }} />
      <div className="bg-red-500" style={{ width: `${distribution.rotten}%` }} />
    </div>
    <div className="grid grid-cols-3 gap-2 text-center text-xs">
      <span className="text-emerald-700">تازه: {measured ? `${fa(distribution.fresh)}٪ (${shareBandFa(distribution.fresh)})` : shareBandFa(distribution.fresh)}</span>
      <span className="text-amber-700">نشانه‌های کهنگی: {measured ? `${fa(distribution.middle)}٪ (${shareBandFa(distribution.middle)})` : shareBandFa(distribution.middle)}</span>
      <span className="text-red-700">فساد: {measured ? `${fa(distribution.rotten)}٪ (${shareBandFa(distribution.rotten)})` : shareBandFa(distribution.rotten)}</span>
    </div>
  </div>
}

function markerColor(score: number): { stroke: string; fill: string } {
  if (score >= 75) return { stroke: '#10b981', fill: 'rgba(16,185,129,0.22)' }
  if (score >= 45) return { stroke: '#f59e0b', fill: 'rgba(245,158,11,0.22)' }
  return { stroke: '#ef4444', fill: 'rgba(239,68,68,0.25)' }
}

function QualityRoiOverlay({
  previewUrl,
  imageWidth,
  imageHeight,
  palletPolygon,
  perFruit,
  selectedFruitId,
  onSelectFruit,
}: {
  previewUrl: string
  imageWidth: number
  imageHeight: number
  palletPolygon: number[][] | null
  perFruit: PerFruitQualityItem[]
  selectedFruitId: number | null
  onSelectFruit: (id: number | null) => void
}) {
  const cornerLabels = ['TL', 'TR', 'BR', 'BL']
  return <div className="space-y-2 rounded-xl border bg-muted/20 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 className="text-sm font-semibold">ناحیه پالت انتخاب‌شده و نشانگر کیفیت هر میوه</h3>
        <p className="text-xs text-muted-foreground">محدوده پالت از مرحله شمارش بازاستفاده شده است. روی هر میوه کلیک کنید تا جزئیات کیفیت و اندازه آن مشخص شود.</p>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-full bg-emerald-500" />تازه (≥۷۵)</span>
        <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-full bg-amber-500" />متوسط (۴۵–۷۴)</span>
        <span className="inline-flex items-center gap-1"><span className="size-2.5 rounded-full bg-red-500" />فاسد (&lt;۴۵)</span>
      </div>
    </div>
    <div className="flex justify-center">
      <div className="relative inline-block max-w-full overflow-hidden rounded-lg border bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={previewUrl} alt="ناحیه پالت و کیفیت میوه‌ها" className="block h-auto max-h-[min(65vh,40rem)] max-w-full object-contain" />
        <svg className="absolute inset-0 size-full" viewBox={`0 0 ${imageWidth} ${imageHeight}`} preserveAspectRatio="none">
          {palletPolygon && palletPolygon.length >= 3 && <>
            <polygon
              points={palletPolygon.map(pt => `${pt[0]},${pt[1]}`).join(' ')}
              fill="rgba(14,165,233,0.10)"
              stroke="#0ea5e9"
              strokeWidth={Math.max(2.5, imageWidth / 380)}
              strokeDasharray={`${Math.max(6, imageWidth / 120)} ${Math.max(4, imageWidth / 180)}`}
            />
            {palletPolygon.slice(0, 4).map((pt, idx) => <g key={idx}>
              <circle cx={pt[0]} cy={pt[1]} r={Math.max(5, imageWidth / 150)} fill="#0ea5e9" stroke="white" strokeWidth={1.5} />
              <text x={pt[0] + 8} y={pt[1] - 8} fill="#38bdf8" stroke="black" strokeWidth={0.7} fontSize={Math.max(13, imageWidth / 60)} paintOrder="stroke">{cornerLabels[idx]}</text>
            </g>)}
          </>}
          {perFruit.map(fruit => {
            const [x1, y1, x2, y2] = fruit.box
            const tone = markerColor(fruit.freshness_score)
            const isSelected = selectedFruitId === fruit.fruit_id
            return <g
              key={fruit.fruit_id}
              className="cursor-pointer"
              onClick={() => onSelectFruit(isSelected ? null : fruit.fruit_id)}
            >
              <rect
                x={x1}
                y={y1}
                width={Math.max(2, x2 - x1)}
                height={Math.max(2, y2 - y1)}
                fill={tone.fill}
                stroke={isSelected ? '#ffffff' : tone.stroke}
                strokeWidth={isSelected ? Math.max(3.5, imageWidth / 250) : Math.max(2, imageWidth / 450)}
                rx={3}
              />
              <text
                x={x1 + 4}
                y={Math.max(14, y1 - 4)}
                fill="white"
                stroke="black"
                strokeWidth={0.9}
                fontSize={Math.max(12, imageWidth / 65)}
                paintOrder="stroke"
              >
                #{fruit.fruit_id} ({fruit.freshness_score})
              </text>
            </g>
          })}
        </svg>
      </div>
    </div>
  </div>
}

function PerFruitQualityTable({
  items,
  selectedFruitId,
  onSelectFruit,
}: {
  items: PerFruitQualityItem[]
  selectedFruitId: number | null
  onSelectFruit: (id: number | null) => void
}) {
  return <div className="space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-semibold">جزئیات کیفیت و اندازه هر میوه ({fa(items.length)} میوه)</h3>
      <span className="text-xs text-muted-foreground">ادغام‌شده بر اساس شناسه میوه (Fruit ID)</span>
    </div>
    <div className="max-h-72 overflow-auto rounded-lg border">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-muted/80 backdrop-blur">
          <tr className="border-b text-right text-muted-foreground">
            <th className="p-2">شناسه</th>
            <th className="p-2">امتیاز تازگی</th>
            <th className="p-2">وضعیت</th>
            <th className="p-2">درجه</th>
            <th className="p-2">نوع مقدار</th>
            <th className="p-2">محدوده پالت</th>
            <th className="p-2">اندازه (عرض×طول / قطر)</th>
            <th className="p-2">توضیح</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => {
            const selected = item.fruit_id === selectedFruitId
            return <tr
              key={item.fruit_id}
              onClick={() => onSelectFruit(selected ? null : item.fruit_id)}
              className={`cursor-pointer border-b last:border-0 hover:bg-muted/40 ${selected ? 'bg-sky-50/80 font-medium' : ''}`}
            >
              <td className="p-2 font-semibold">#{item.fruit_id}</td>
              <td className="p-2 font-bold">{fa(item.freshness_score)} از ۱۰۰</td>
              <td className="p-2"><span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] ${labelTone(String(item.label))}`}>{item.label}</span></td>
              <td className="p-2">{item.grade ? `${item.grade} (${GRADE_LABELS_FA[item.grade]})` : '—'}</td>
              <td className="p-2">
                <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] ${item.measurement_mode === 'measured' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {item.measurement_mode === 'measured' ? 'اندازه‌گیری‌شده' : 'تخمینی'}
                </span>
              </td>
              <td className="p-2">{item.inside_pallet === false ? <span className="text-amber-700">خارج از پالت</span> : <span className="text-emerald-700">داخل پالت</span>}</td>
              <td className="p-2" dir="ltr">
                {item.size
                  ? `${item.size.width_mm.toFixed(1)}×${item.size.length_mm.toFixed(1)} mm (⌀${item.size.equivalent_diameter_mm.toFixed(1)})`
                  : '—'}
              </td>
              <td className="p-2 text-muted-foreground">{item.note_fa ?? '—'}</td>
            </tr>
          })}
        </tbody>
      </table>
    </div>
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
