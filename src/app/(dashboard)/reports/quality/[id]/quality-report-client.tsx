'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, FileJson } from 'lucide-react'
import { faDate, faNumber, MiniBars, PrintButton, ReportSection, ReportSheet, ReportStat } from '@/components/report/report-primitives'
import { downloadJson, fileStamp } from '@/lib/download'
import { GRADE_LABELS_FA, SEVERITY_LABELS_FA, shareBandFa, type QualityAssessmentRecord, type QualityGrade } from '@/modules/analysis-records/types'
import { boothLabel } from '@/lib/persian'

async function fetchAssessment(id: string): Promise<QualityAssessmentRecord> {
  const response = await fetch(`/api/fruit-quality-assessments/${id}`)
  if (response.status === 404) throw new Error('این ارزیابی پیدا نشد یا در محدوده دسترسی شما نیست.')
  if (!response.ok) throw new Error('دریافت گزارش ممکن نشد.')
  return ((await response.json()) as { data: QualityAssessmentRecord }).data
}

const ASPECT_TONE = { good: 'border-emerald-200 bg-emerald-50', watch: 'border-amber-200 bg-amber-50', poor: 'border-red-200 bg-red-50' } as const

function tone(score: number): 'good' | 'watch' | 'poor' {
  return score >= 80 ? 'good' : score >= 60 ? 'watch' : 'poor'
}

/** Complete, printable record of one fruit-quality assessment. */
export function QualityReportClient({ id }: { id: string }) {
  const { data, isLoading, error } = useQuery({ queryKey: ['fruit-quality-assessment', id], queryFn: () => fetchAssessment(id) })

  if (isLoading) return <div className="mx-auto h-96 max-w-5xl animate-pulse rounded-xl bg-muted" />
  if (error || !data) return <div className="mx-auto max-w-xl rounded-xl border bg-card p-6 text-center text-sm text-red-600">{error?.message ?? 'دریافت گزارش ممکن نشد.'}</div>

  const details = data.details
  const location = [data.field?.name, data.market?.name, data.booth ? boothLabel(data.booth.number) : null].filter(Boolean).join(' › ')
  const grade = data.grade as QualityGrade | null
  const frames = details.frames.filter(frame => frame.freshness_score !== null)
  const thumbnails = new Map((data.thumbnails ?? []).map(item => [item.index, item.dataUrl]))

  return <div className="space-y-4">
    <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 print:hidden">
      <Link href="/fruit-analysis" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowRight className="size-4" />بازگشت به تحلیل میوه</Link>
      <div className="flex gap-2">
        <button type="button" onClick={() => downloadJson(`fruit-quality-${fileStamp(new Date(data.createdAt))}.json`, { ...data, thumbnails: undefined })} className="inline-flex h-9 items-center gap-2 rounded-lg border bg-background px-4 text-sm font-medium hover:bg-accent"><FileJson className="size-4" />JSON</button>
        <PrintButton />
      </div>
    </div>

    <ReportSheet>
      <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-emerald-600 pb-4">
        <div>
          <p className="text-xs font-medium text-emerald-700">سامانه هوشمند میادین میوه و تره‌بار</p>
          <h1 className="mt-1 text-2xl font-bold">گزارش ارزیابی کیفیت میوه</h1>
          <p className="mt-1 text-sm text-slate-600">{location || 'بدون مکان ثبت‌شده'}</p>
        </div>
        <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-1 text-xs text-slate-600">
          <dt>زمان ارزیابی</dt><dd className="font-medium text-slate-900">{faDate(data.createdAt, true)}</dd>
          <dt>منبع</dt><dd className="font-medium text-slate-900">{data.source === 'LIVE' ? `دوربین زنده${data.camera ? ` · ${data.camera.name}` : ''}` : `فایل${data.fileName ? ` · ${data.fileName}` : ''}`}</dd>
          <dt>ثبت‌کننده</dt><dd className="font-medium text-slate-900">{data.createdByName ?? '—'}</dd>
          <dt>شناسه</dt><dd className="font-mono text-[10px] text-slate-900" dir="ltr">{data.id}</dd>
        </dl>
      </header>

      <ReportSection title="نتیجه کلی">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4">
          <ReportStat label="برچسب کیفیت" value={data.label} hint={grade ? GRADE_LABELS_FA[grade] : undefined} tone={data.hasFruit ? tone(data.freshnessScore) : 'neutral'} />
          <ReportStat label="امتیاز تازگی" value={`${faNumber(data.freshnessScore)} از ۱۰۰`} tone={data.hasFruit ? tone(data.freshnessScore) : 'neutral'} />
          <ReportStat label="اطمینان مدل" value={`${faNumber(data.confidence)}٪`} />
          <ReportStat label="فریم‌های بررسی‌شده" value={faNumber(data.frameCount)} />
        </div>
        <div className="space-y-1.5">
          <div className="flex h-4 overflow-hidden rounded-full bg-slate-100"><div className="bg-emerald-500" style={{ width: `${data.freshPercent}%` }} /><div className="bg-amber-400" style={{ width: `${data.middlePercent}%` }} /><div className="bg-red-500" style={{ width: `${data.rottenPercent}%` }} /></div>
          <div className="grid grid-cols-3 text-center text-xs"><span className="text-emerald-700">تازه: {shareBandFa(data.freshPercent)}</span><span className="text-amber-700">نشانه‌های کهنگی: {shareBandFa(data.middlePercent)}</span><span className="text-red-700">فساد: {shareBandFa(data.rottenPercent)}</span></div>
        </div>
        {details.verdictFa && <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-medium leading-7">{details.verdictFa}</p>}
      </ReportSection>

      {!!details.qualityProfile?.length && <ReportSection title="پروفایل کیفیت" description="وضعیت بار در شاخص‌های قابل مشاهده؛ برآمده از نتیجه اعتبارسنجی‌شده">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3">
          {details.qualityProfile.map(aspect => <div key={aspect.key} className={`rounded-lg border p-3 ${ASPECT_TONE[aspect.status]}`}><p className="text-[11px] text-slate-500">{aspect.label_fa}</p><p className="mt-1 text-sm font-bold text-slate-900">{aspect.value_fa}</p>{aspect.note_fa && <p className="mt-1 text-[11px] leading-5 text-slate-600">{aspect.note_fa}</p>}</div>)}
        </div>
      </ReportSection>}

      {data.recommendationFa && <ReportSection title="توصیه">
        <div className="rounded-lg border border-slate-200 p-3"><p className="text-[11px] text-slate-500">اقدام پیشنهادی (بر پایه درجه کیفیت)</p><p className="mt-1 text-sm leading-7">{data.recommendationFa}</p></div>
      </ReportSection>}

      {details.defects.length > 0 && <ReportSection title="عیوب مشاهده‌شده">
        <table className="w-full text-sm"><thead><tr className="border-b border-slate-200 text-right text-xs text-slate-500"><th className="p-2">عیب</th><th className="p-2">شدت</th><th className="p-2">گستردگی</th></tr></thead>
          <tbody>{details.defects.map((defect, index) => <tr key={`${defect.type}-${index}`} className="border-b border-slate-100 last:border-0"><td className="p-2 font-medium">{defect.label_fa}</td><td className="p-2">{SEVERITY_LABELS_FA[defect.severity]}</td><td className="p-2">{defect.extent_label_fa ?? '—'}</td></tr>)}</tbody>
        </table>
      </ReportSection>}

      {(frames.length > 0 || thumbnails.size > 0) && <ReportSection title="شواهد تصویری و بررسی فریم‌به‌فریم" description={details.frameStatistics?.score_mean != null ? `میانگین ${faNumber(details.frameStatistics.score_mean, 1)} · کمینه ${faNumber(details.frameStatistics.score_min ?? 0)} · بیشینه ${faNumber(details.frameStatistics.score_max ?? 0)} · انحراف معیار ${faNumber(details.frameStatistics.score_stddev ?? 0, 1)}` : undefined}>
        {frames.length > 1 && <MiniBars max={100} points={frames.map(frame => ({ label: `${frame.index + 1}`, value: frame.freshness_score }))} />}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 print:grid-cols-4">{details.frames.filter(frame => thumbnails.has(frame.index) || frame.freshness_score !== null).map(frame => <figure key={frame.index} className="report-section overflow-hidden rounded-lg border border-slate-200">
          {/* Evidence thumbnails are inline data URLs stored with the assessment. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {thumbnails.has(frame.index) && <img src={thumbnails.get(frame.index)} alt={`فریم ${frame.index + 1}`} className="aspect-video w-full bg-black object-contain" />}
          <figcaption className="space-y-0.5 p-2 text-[11px]"><div className="flex justify-between"><span>فریم {faNumber(frame.index + 1)}{frame.timestamp_seconds != null && <span className="mr-1 text-slate-500" dir="ltr">{frame.timestamp_seconds.toFixed(1)}s</span>}</span>{frame.freshness_score !== null && <b>{faNumber(frame.freshness_score)}</b>}</div>{frame.label && <p className="text-slate-600">{frame.label}</p>}</figcaption>
        </figure>)}</div>
      </ReportSection>}

      <footer className="border-t border-slate-200 pt-3 text-[11px] leading-5 text-slate-500">
        <p>مدل: <span dir="ltr">{data.modelName ?? 'Qwen2.5-VL'}</span> · {faNumber(data.frameCount)} فریم · زمان استنتاج {faNumber(data.inferenceSeconds, 1)} ثانیه · سطح تحلیل: {data.detailLevel === 'detailed' ? 'تفصیلی' : 'خلاصه'}</p>
        <p>این ارزیابی فقط بر پایه شواهد ظاهری تصویر انجام شده و جایگزین آزمون کیفیت، طعم یا ایمنی غذایی نیست.</p>
      </footer>
    </ReportSheet>
  </div>
}
