'use client'

import { FormEvent, MouseEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery } from '@tanstack/react-query'
import { CheckCircle2, Loader2, Play, RotateCcw, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FRUIT_API_BASE, fruitApiJson, fruitArtifactUrl } from '@/lib/fruit-api'
import type { Camera } from '@/modules/camera/types'

type Calibration = {
  id: string
  cameraId: string
  reprojectionError: number
  resolutionWidth: number
  resolutionHeight: number
  createdAt: string
  camera: { id: string; name: string }
}
type InputPreview = { id: string; filename: string; camera_id: string; width: number; height: number; preview_url: string; allow_unsafe_resize: boolean }
type Point = { x: number; y: number }
type FruitSize = { width_mm: number; length_mm: number; equivalent_diameter_mm: number; area_mm2: number }
type FruitFrame = {
  frame_index: number | null
  timestamp_ms: number | null
  num_fruits: number
  fruits: Array<{ fruit_id: number; box: [number, number, number, number]; size: FruitSize | null }>
  measurement_overlay_url?: string
}
type FruitResult = {
  processed_frame_count: number
  total_fruit_observations: number
  average_fruit_size_mm: { width: number; length: number; equivalent_diameter: number } | null
  frames: FruitFrame[]
}
type FruitJob = { id: string; status: 'queued' | 'running' | 'completed' | 'failed'; error?: string; result?: FruitResult }

async function appJson<T>(path: string): Promise<T> {
  const response = await fetch(path)
  if (!response.ok) throw new Error('خطا در دریافت اطلاعات سامانه')
  return response.json()
}

const CORNER_LABELS = ['TL', 'TR', 'BR', 'BL']

export function FruitAnalysisClient() {
  const [cameraId, setCameraId] = useState('')
  const [input, setInput] = useState<InputPreview | null>(null)
  const [points, setPoints] = useState<Point[]>([])
  const [jobId, setJobId] = useState<string | null>(null)

  const cameras = useQuery<{ data: Camera[] }>({ queryKey: ['cameras'], queryFn: () => appJson('/api/cameras') })
  const calibrations = useQuery<{ data: Calibration[] }>({ queryKey: ['camera-calibrations'], queryFn: () => appJson('/api/camera-calibrations') })
  const latestByCamera = useMemo(() => {
    const map = new Map<string, Calibration>()
    for (const calibration of calibrations.data?.data ?? []) if (!map.has(calibration.cameraId)) map.set(calibration.cameraId, calibration)
    return map
  }, [calibrations.data])
  const calibratedCameras = useMemo(
    () => (cameras.data?.data ?? []).filter(camera => latestByCamera.has(camera.id)),
    [cameras.data, latestByCamera],
  )
  useEffect(() => {
    if (!cameraId && calibratedCameras[0]) setCameraId(calibratedCameras[0].id)
  }, [calibratedCameras, cameraId])

  const upload = useMutation({
    mutationFn: (formData: FormData) => fruitApiJson<{ data: InputPreview }>('/api/v1/inputs', { method: 'POST', body: formData }),
    onSuccess: response => { setInput(response.data); setPoints([]); setJobId(null) },
  })
  const start = useMutation({
    mutationFn: (payload: Record<string, unknown>) => fruitApiJson<{ data: FruitJob }>('/api/v1/jobs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    }),
    onSuccess: response => setJobId(response.data.id),
  })
  const job = useQuery<{ data: FruitJob }>({
    queryKey: ['fruit-job', jobId],
    queryFn: () => fruitApiJson(`/api/v1/jobs/${jobId}`),
    enabled: Boolean(jobId),
    refetchInterval: query => ['queued', 'running'].includes(query.state.data?.data.status ?? '') ? 2000 : false,
  })

  function submitUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    data.set('camera_id', cameraId)
    upload.mutate(data)
  }

  function choosePoint(event: MouseEvent<SVGSVGElement>) {
    if (!input || points.length >= 4) return
    const rect = event.currentTarget.getBoundingClientRect()
    setPoints(current => [...current, {
      x: ((event.clientX - rect.left) / rect.width) * input.width,
      y: ((event.clientY - rect.top) / rect.height) * input.height,
    }])
  }

  function runAnalysis(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!input || points.length !== 4) return
    const data = new FormData(event.currentTarget)
    start.mutate({
      input_id: input.id,
      camera_id: cameraId,
      corners: points,
      pallet_type: data.get('pallet_type'),
      frame_step: Number(data.get('frame_step')),
      max_frames: data.get('max_frames') ? Number(data.get('max_frames')) : null,
      max_calibration_error: Number(data.get('max_calibration_error')),
      min_pallet_overlap: Number(data.get('min_pallet_overlap')),
      resize_to_calibration: true,
      allow_unsafe_resize: input.allow_unsafe_resize,
    })
  }

  const currentJob = job.data?.data
  const result = currentJob?.result
  const selectedCalibration = latestByCamera.get(cameraId)

  return <div className="space-y-6">
    <div>
      <h1 className="text-xl font-bold">تحلیل میوه</h1>
      <p className="mt-1 text-sm text-muted-foreground">دوربین کالیبره‌شده را انتخاب کنید، محدوده پالت را مشخص کنید و تعداد و اندازه میوه‌ها را ببینید.</p>
    </div>

    {!calibrations.isLoading && calibratedCameras.length === 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      برای تحلیل اندازه ابتدا باید یک دوربین را <Link href="/camera-calibration" className="font-semibold underline">کالیبره کنید</Link>.
    </div>}

    <form onSubmit={submitUpload} className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="font-semibold">۱. انتخاب دوربین و ورودی</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="fruit-camera">دوربین کالیبره‌شده</Label><select id="fruit-camera" value={cameraId} onChange={event => { setCameraId(event.target.value); setInput(null); setPoints([]) }} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
          {calibratedCameras.map(camera => <option key={camera.id} value={camera.id}>{camera.name}</option>)}
        </select>{selectedCalibration && <p className="text-xs text-muted-foreground" dir="ltr">{selectedCalibration.resolutionWidth}×{selectedCalibration.resolutionHeight} · RMS {selectedCalibration.reprojectionError.toFixed(3)} px</p>}</div>
        <div className="space-y-1.5"><Label htmlFor="fruit-file">تصویر یا ویدیوی میوه</Label><Input id="fruit-file" name="file" type="file" accept="image/*,video/*,.mov,.mkv,.avi" required /></div>
      </div>
      <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <input name="allow_unsafe_resize" type="checkbox" value="true" className="mt-0.5 size-4" />
        <span><span className="font-semibold">تغییر اندازه اجباری فقط برای آزمایش</span><span className="mt-1 block text-xs">تصاویر با نسبت ابعاد متفاوت کشیده می‌شوند؛ تعداد و تشخیص قابل آزمایش است، اما اندازه‌گیری میلی‌متری معتبر نیست.</span></span>
      </label>
      {upload.error && <p className="text-sm text-red-600">{upload.error.message}</p>}
      <Button type="submit" disabled={!cameraId || upload.isPending}>{upload.isPending ? <Loader2 className="animate-spin" /> : <Upload />}{upload.isPending ? 'در حال آماده‌سازی فریم…' : 'بارگذاری و نمایش فریم'}</Button>
    </form>

    {input && <form onSubmit={runAnalysis} className="space-y-5 rounded-xl border bg-card p-5 shadow-sm">
      <div><h2 className="font-semibold">۲. انتخاب چهار گوشه پالت</h2><p className="mt-1 text-xs text-muted-foreground">به ترتیب روی گوشه‌های بالا-چپ، بالا-راست، پایین-راست و پایین-چپ کلیک کنید.</p></div>
      {input.allow_unsafe_resize && <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-900">حالت آزمایشی فعال است؛ نتایج اندازه‌گیری فیزیکی این اجرا معتبر نیست.</p>}
      <div className="flex justify-center">
        <div className="relative inline-block max-w-full overflow-hidden rounded-lg border bg-black shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${FRUIT_API_BASE}${input.preview_url}`} alt="فریم انتخاب پالت" className="block h-auto max-h-[min(70vh,45rem)] max-w-full object-contain" />
          <svg className="absolute inset-0 size-full cursor-crosshair" viewBox={`0 0 ${input.width} ${input.height}`} preserveAspectRatio="none" onClick={choosePoint} role="application" aria-label="انتخاب گوشه‌های پالت">
            {points.length > 1 && <polyline points={points.map(point => `${point.x},${point.y}`).join(' ')} fill={points.length === 4 ? 'rgba(16,185,129,.18)' : 'none'} stroke="#10b981" strokeWidth={Math.max(2, input.width / 500)} />}
            {points.map((point, index) => <g key={index}><circle cx={point.x} cy={point.y} r={Math.max(6, input.width / 130)} fill="#10b981" stroke="white" strokeWidth={2} /><text x={point.x + 10} y={point.y - 10} fill="white" stroke="black" strokeWidth={0.8} fontSize={Math.max(16, input.width / 50)} paintOrder="stroke">{CORNER_LABELS[index]}</text></g>)}
          </svg>
        </div>
      </div>
      <div className="flex items-center gap-3"><span className="text-sm">{points.length} از ۴ گوشه</span><Button type="button" variant="outline" size="sm" onClick={() => setPoints(current => current.slice(0, -1))} disabled={!points.length}><RotateCcw />حذف آخرین نقطه</Button></div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5"><Label htmlFor="pallet_type">نوع پالت</Label><select id="pallet_type" name="pallet_type" defaultValue="standard_large" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="standard_large">استاندارد بزرگ (۱۲۰۰×۱۸۰۰)</option><option value="standard_small">استاندارد کوچک (۱۰۰۰×۱۲۰۰)</option><option value="calibration_board">صفحه کالیبراسیون</option></select></div>
        <NumberField label="فاصله فریم‌ها" name="frame_step" defaultValue="10" min="1" />
        <NumberField label="حداکثر فریم (اختیاری)" name="max_frames" min="1" />
        <NumberField label="حداکثر خطای کالیبراسیون" name="max_calibration_error" defaultValue="3.0" min="0.1" step="0.1" />
        <NumberField label="حداقل همپوشانی با پالت" name="min_pallet_overlap" defaultValue="0.5" min="0" max="1" step="0.05" />
      </div>
      {(start.error || job.error) && <p className="text-sm text-red-600">{(start.error ?? job.error)?.message}</p>}
      {currentJob && currentJob.status !== 'completed' && <div className={`rounded-lg border p-3 text-sm ${currentJob.status === 'failed' ? 'border-red-200 bg-red-50 text-red-700' : 'border-sky-200 bg-sky-50 text-sky-800'}`}>{currentJob.status === 'failed' ? currentJob.error : <span className="flex items-center gap-2"><Loader2 className="size-4 animate-spin" />مدل در حال تشخیص، قطعه‌بندی و اندازه‌گیری میوه‌هاست…</span>}</div>}
      <Button type="submit" disabled={points.length !== 4 || start.isPending || ['queued', 'running'].includes(currentJob?.status ?? '')}><Play />شروع تحلیل میوه</Button>
    </form>}

    {result && <ResultView result={result} />}
  </div>
}

function NumberField({ label, name, ...props }: { label: string; name: string } & React.ComponentProps<typeof Input>) {
  return <div className="space-y-1.5"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type="number" {...props} /></div>
}

function ResultView({ result }: { result: FruitResult }) {
  const average = result.average_fruit_size_mm
  return <section className="space-y-5 rounded-xl border bg-card p-5 shadow-sm">
    <div className="flex items-center gap-2"><CheckCircle2 className="size-5 text-emerald-600" /><h2 className="font-semibold">نتیجه تحلیل</h2></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Metric label="تعداد میوه" value={result.total_fruit_observations.toLocaleString('fa-IR')} />
      <Metric label="میانگین عرض" value={average ? `${average.width.toFixed(1)} mm` : '—'} />
      <Metric label="میانگین طول" value={average ? `${average.length.toFixed(1)} mm` : '—'} />
      <Metric label="قطر معادل میانگین" value={average ? `${average.equivalent_diameter.toFixed(1)} mm` : '—'} />
    </div>
    <p className="text-xs text-muted-foreground">{result.processed_frame_count.toLocaleString('fa-IR')} فریم پردازش شده است. در ویدیو، تعداد بالا مجموع مشاهدات میوه در فریم‌های نمونه‌برداری‌شده است.</p>
    {/* Pipeline artifacts are dynamic cross-origin URLs and cannot use next/image optimization. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <div className="grid gap-4 lg:grid-cols-2">{result.frames.filter(frame => frame.measurement_overlay_url).map((frame, index) => <figure key={`${frame.frame_index}-${index}`} className="overflow-hidden rounded-lg border"><img src={fruitArtifactUrl(frame.measurement_overlay_url!)} alt={`اندازه میوه‌ها در فریم ${frame.frame_index ?? 0}`} className="w-full" /><figcaption className="p-2 text-xs text-muted-foreground">فریم {frame.frame_index ?? 0} — {frame.num_fruits.toLocaleString('fa-IR')} میوه</figcaption></figure>)}</div>
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-right text-muted-foreground"><th className="p-2">فریم</th><th className="p-2">شناسه</th><th className="p-2">عرض</th><th className="p-2">طول</th><th className="p-2">قطر معادل</th></tr></thead><tbody>{result.frames.flatMap((frame, frameIndex) => frame.fruits.filter(fruit => fruit.size).map(fruit => <tr key={`${frameIndex}-${fruit.fruit_id}`} className="border-b last:border-0"><td className="p-2">{frame.frame_index ?? 0}</td><td className="p-2">#{fruit.fruit_id}</td><td className="p-2" dir="ltr">{fruit.size!.width_mm.toFixed(1)} mm</td><td className="p-2" dir="ltr">{fruit.size!.length_mm.toFixed(1)} mm</td><td className="p-2" dir="ltr">{fruit.size!.equivalent_diameter_mm.toFixed(1)} mm</td></tr>))}</tbody></table></div>
  </section>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border bg-muted/30 p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-xl font-bold" dir="auto">{value}</p></div>
}
