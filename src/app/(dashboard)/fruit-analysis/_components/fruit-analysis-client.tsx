'use client'

import { FormEvent, MouseEvent, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Apple, Ban, BrainCircuit, CheckCircle2, Download, FileJson, FileSpreadsheet, Loader2, Play, Radio, RotateCcw, Ruler, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FRUIT_API_BASE, fruitApiJson, fruitArtifactUrl } from '@/lib/fruit-api'
import { videoAnalyticsApiJson } from '@/lib/video-analytics-api'
import type { Camera } from '@/modules/camera/types'
import { useTokenizedUrl } from '@/hooks/use-tokenized-url'
import { downloadCsv, downloadJson, fileStamp } from '@/lib/download'
import { appendAccessToken, getServiceToken, withServiceToken } from '@/lib/service-token-client'
import type { FruitQualityResult } from '@/modules/analysis-records/types'
import { fetchManagementLocations } from '@/modules/management-analytics/client'
import { QualityHistory } from './quality-history'
import { QualityResultView } from './quality-result-view'

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
  size_statistics?: SizeStatistics | null
  frames: FruitFrame[]
}
type FruitJobStatus = 'queued' | 'running' | 'cancelling' | 'completed' | 'failed' | 'cancelled'
type FruitLiveEvent = {
  type: string
  job_id: string
  timestamp: string
  status: FruitJobStatus
  frame_index: number | null
  timestamp_ms: number | null
  progress: number | null
  elapsed_seconds: number
  metrics: Record<string, unknown>
  preview_reference: string | null
  message: string | null
}
type FruitJob = {
  id: string
  status: FruitJobStatus
  error?: string
  result?: FruitResult
  live?: FruitLiveEvent
}
type SizeStatistics = {
  count: number
  diameter_mm?: Record<string, number | null>
  histogram?: Array<{ from_mm: number; to_mm: number; count: number }>
}
type QualityReport = { result: FruitQualityResult; recordId: string | null; sourceLabel: string; analyzedAt: Date }

async function appJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init)
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = body?.detail?.detail ?? body?.detail ?? body?.error
    throw new Error(typeof detail === 'string' ? detail : 'خطا در دریافت اطلاعات سامانه')
  }
  return body as T
}

const CORNER_LABELS = ['TL', 'TR', 'BR', 'BL']

export function FruitAnalysisClient({ mode = 'recorded', legacyDashboard = false }: { mode?: 'recorded' | 'live'; legacyDashboard?: boolean }) {
  const queryClient = useQueryClient()
  const [cameraId, setCameraId] = useState('')
  const [input, setInput] = useState<InputPreview | null>(null)
  const [points, setPoints] = useState<Point[]>([])
  const [jobId, setJobId] = useState<string | null>(null)
  const [palletType, setPalletType] = useState('standard_large')
  const [inferenceMode, setInferenceMode] = useState<'sam_only' | 'detector'>('sam_only')
  const [inferenceIntervalMinutes, setInferenceIntervalMinutes] = useState(10)
  const [analysisKind, setAnalysisKind] = useState<'quality' | 'measurement'>('quality')
  const [qualityFile, setQualityFile] = useState<File | null>(null)
  const [qualityPreviewUrl, setQualityPreviewUrl] = useState<string | null>(null)
  const [qualityCameraId, setQualityCameraId] = useState('')
  const [qualityReport, setQualityReport] = useState<QualityReport | null>(null)
  const [measurementReport, setMeasurementReport] = useState<{ result: FruitResult; jobId: string } | null>(null)
  const [detailedQuality, setDetailedQuality] = useState(true)
  const [perFrameQuality, setPerFrameQuality] = useState(false)
  const [qualityLocation, setQualityLocation] = useState('')
  const recordedRuns = useRef(new Set<string>())

  const cameras = useQuery<{ data: Camera[] }>({ queryKey: ['cameras'], queryFn: () => appJson('/api/cameras') })
  const calibrations = useQuery<{ data: Calibration[] }>({ queryKey: ['camera-calibrations'], queryFn: () => appJson('/api/camera-calibrations') })
  // Uploaded files have no camera, so the user may file the result under a location.
  const locations = useQuery({ queryKey: ['management-locations'], queryFn: fetchManagementLocations, staleTime: 5 * 60_000, enabled: mode === 'recorded' })
  const latestByCamera = useMemo(() => {
    const map = new Map<string, Calibration>()
    for (const calibration of calibrations.data?.data ?? []) if (!map.has(calibration.cameraId)) map.set(calibration.cameraId, calibration)
    return map
  }, [calibrations.data])
  const calibratedCameras = useMemo(
    () => (cameras.data?.data ?? []).filter(camera =>
      latestByCamera.has(camera.id) && (mode === 'recorded' || Boolean(camera.streamUrl)),
    ),
    [cameras.data, latestByCamera, mode],
  )
  const liveCameras = useMemo(() => (cameras.data?.data ?? []).filter(camera => Boolean(camera.streamUrl)), [cameras.data])
  useEffect(() => {
    if (!cameraId && calibratedCameras[0]) setCameraId(calibratedCameras[0].id)
  }, [calibratedCameras, cameraId])
  useEffect(() => {
    if (mode === 'live' && !qualityCameraId && liveCameras[0]) setQualityCameraId(liveCameras[0].id)
  }, [liveCameras, mode, qualityCameraId])
  useEffect(() => () => {
    if (qualityPreviewUrl) URL.revokeObjectURL(qualityPreviewUrl)
  }, [qualityPreviewUrl])

  const upload = useMutation({
    mutationFn: (formData: FormData) => fruitApiJson<{ data: InputPreview }>('/api/v1/inputs', { method: 'POST', body: formData }),
    onSuccess: response => { setInput(response.data); setPoints([]); setJobId(null) },
  })
  const prepareLive = useMutation({
    mutationFn: async (allowUnsafeResize: boolean) => {
      const response = await fetch(`/api/cameras/${cameraId}/fruit-input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowUnsafeResize }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        const detail = body?.detail?.detail ?? body?.detail ?? body?.error
        throw new Error(typeof detail === 'string' ? detail : 'دریافت فریم زنده ممکن نشد')
      }
      return body as { data: InputPreview }
    },
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
    refetchInterval: query => ['queued', 'running', 'cancelling'].includes(query.state.data?.data.status ?? '') ? 2000 : false,
  })
  const cancel = useMutation({
    mutationFn: () => fruitApiJson<{ data: FruitJob }>(`/api/v1/jobs/${jobId}/cancel`, { method: 'POST' }),
    onSuccess: response => queryClient.setQueryData(['fruit-job', jobId], response),
  })
  const quality = useMutation({
    mutationFn: async (): Promise<QualityReport> => {
      const analyzedAt = new Date()
      if (mode === 'recorded') {
        if (!qualityFile) throw new Error('ابتدا یک تصویر یا ویدیوی میوه انتخاب کنید')
        const data = new FormData()
        data.set('media', qualityFile)
        data.set('num_frames', '8')
        data.set('detail_level', detailedQuality ? 'detailed' : 'summary')
        data.set('per_frame', String(perFrameQuality))
        data.set('include_thumbnails', 'true')
        const response = await videoAnalyticsApiJson<{ data: FruitQualityResult }>('/api/v1/fruit-quality', { method: 'POST', body: data })
        // Keep the assessment: it feeds the exports and the location's executive report.
        const [locationType, locationId] = qualityLocation ? qualityLocation.split(':') : []
        const stored = await appJson<{ data: { id: string } }>('/api/fruit-quality-assessments', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ result: response.data, fileName: qualityFile.name, ...(locationType ? { locationType, locationId } : {}) }),
        }).catch(() => null)
        return { result: response.data, recordId: stored?.data.id ?? null, sourceLabel: `فایل: ${qualityFile.name}`, analyzedAt }
      }
      if (!qualityCameraId) throw new Error('ابتدا یک دوربین زنده انتخاب کنید')
      const response = await appJson<{ data: FruitQualityResult; recordId: string | null }>(`/api/cameras/${qualityCameraId}/fruit-quality`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numFrames: 8, intervalSeconds: 10, detailLevel: detailedQuality ? 'detailed' : 'summary', perFrame: perFrameQuality, includeThumbnails: true }),
      })
      const cameraName = liveCameras.find(camera => camera.id === qualityCameraId)?.name ?? ''
      return { result: response.data, recordId: response.recordId ?? null, sourceLabel: `دوربین زنده: ${cameraName}`, analyzedAt }
    },
    onSuccess: report => {
      setQualityReport(report)
      queryClient.invalidateQueries({ queryKey: ['fruit-quality-history'] })
    },
  })
  const recordRun = useMutation({
    mutationFn: (payload: Record<string, unknown>) => appJson('/api/fruit-measurement-runs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    }),
  })

  function submitUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    data.set('camera_id', cameraId)
    upload.mutate(data)
  }

  function chooseQualityFile(file: File | null) {
    setQualityFile(file)
    setQualityPreviewUrl(file ? URL.createObjectURL(file) : null)
    quality.reset()
  }

  function prepareLiveFrame(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!cameraId) return
    const data = new FormData(event.currentTarget)
    prepareLive.mutate(data.get('allow_unsafe_resize') === 'true')
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
    const customPallet = palletType === 'custom'
    const legacyMaxFrames = data.get('max_frames')
    start.mutate({
      input_id: input.id,
      camera_id: cameraId,
      corners: points,
      pallet_type: palletType,
      pallet_width_mm: customPallet ? Number(data.get('pallet_width_mm')) : null,
      pallet_length_mm: customPallet ? Number(data.get('pallet_length_mm')) : null,
      processing_mode: legacyDashboard ? 'legacy' : 'interval',
      inference_mode: legacyDashboard ? inferenceMode : 'sam_only',
      inference_interval_minutes: inferenceIntervalMinutes,
      frame_step: legacyDashboard ? Number(data.get('frame_step')) : 10,
      max_frames: legacyDashboard && legacyMaxFrames ? Number(legacyMaxFrames) : null,
      max_calibration_error: Number(data.get('max_calibration_error')),
      min_pallet_overlap: Number(data.get('min_pallet_overlap')),
      resize_to_calibration: true,
      allow_unsafe_resize: input.allow_unsafe_resize,
    })
  }

  const currentJob = job.data?.data
  const { live, connected } = useFruitJobLive(jobId, currentJob)
  const result = currentJob?.result
  const selectedCalibration = latestByCamera.get(cameraId)
  const jobIsActive = ['queued', 'running', 'cancelling'].includes(currentJob?.status ?? '')
  useEffect(() => {
    if (!result || !jobId) return
    setMeasurementReport({ result, jobId })
    // Store the run summary once per job so it counts in the location's reports.
    if (recordedRuns.current.has(jobId)) return
    recordedRuns.current.add(jobId)
    const lastFrame = result.frames[result.frames.length - 1]
    recordRun.mutate({
      cameraId,
      serviceJobId: jobId,
      source: mode === 'live' ? 'LIVE' : 'UPLOAD',
      processingMode: legacyDashboard ? 'legacy' : 'interval',
      palletType,
      processedFrames: result.processed_frame_count,
      totalFruitObservations: result.total_fruit_observations,
      lastFruitCount: lastFrame?.num_fruits ?? null,
      avgWidthMm: result.average_fruit_size_mm?.width ?? null,
      avgLengthMm: result.average_fruit_size_mm?.length ?? null,
      avgDiameterMm: result.average_fruit_size_mm?.equivalent_diameter ?? null,
      sizeStatistics: result.size_statistics ?? null,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once per finished job
  }, [result, jobId])

  return <div className="space-y-6">
    <div>
      <h1 className="text-xl font-bold">{mode === 'live' ? 'تحلیل زنده میوه' : 'تحلیل میوه'}</h1>
      <p className="mt-1 text-sm text-muted-foreground">ارزیابی کیفیت ظاهری با Qwen یا شمارش و تخمین اندازه را انتخاب کنید.</p>
    </div>

    <div className="grid gap-3 sm:grid-cols-2">
      <Button type="button" size="lg" variant={analysisKind === 'quality' ? 'default' : 'outline'} className="h-auto justify-start py-4" onClick={() => setAnalysisKind('quality')}>
        <BrainCircuit className="size-5" /><span className="text-right"><span className="block font-semibold">کیفیت میوه</span><span className="mt-1 block text-xs font-normal opacity-80">امتیاز تازگی با Qwen</span></span>
      </Button>
      <Button type="button" size="lg" variant={analysisKind === 'measurement' ? 'default' : 'outline'} className="h-auto justify-start py-4" onClick={() => setAnalysisKind('measurement')}>
        <Ruler className="size-5" /><span className="text-right"><span className="block font-semibold">شمارش و تخمین اندازه</span><span className="mt-1 block text-xs font-normal opacity-80">روش قبلی با کالیبراسیون</span></span>
      </Button>
    </div>

    {analysisKind === 'quality' && <section className="space-y-5 rounded-xl border bg-card p-5 shadow-sm">
      <div><h2 className="flex items-center gap-2 font-semibold"><Apple className="size-5 text-emerald-600" />ارزیابی کیفیت میوه</h2><p className="mt-1 text-xs text-muted-foreground">مدل فقط نشانه‌های قابل مشاهده را بررسی می‌کند؛ این نتیجه جایگزین آزمایش کیفیت یا ایمنی غذایی نیست.</p></div>
      {mode === 'recorded' ? <>
        <div className="space-y-2"><Label htmlFor="fruit-quality-file">تصویر یا ویدیوی میوه</Label><Input id="fruit-quality-file" type="file" accept="image/*,video/*,.mov,.mkv,.avi,.webm,.m4v" onChange={event => chooseQualityFile(event.target.files?.[0] ?? null)} /></div>
        {qualityPreviewUrl && <div className="flex max-h-[32rem] justify-center overflow-hidden rounded-xl border bg-black">
          {qualityFile?.type.startsWith('video/')
            ? <video src={qualityPreviewUrl} controls muted playsInline className="max-h-[32rem] max-w-full object-contain" />
            // Local object URLs do not use Next image optimization.
            // eslint-disable-next-line @next/next/no-img-element
            : <img src={qualityPreviewUrl} alt="پیش‌نمایش میوه" className="max-h-[32rem] max-w-full object-contain" />}
        </div>}
      </> : <div className="space-y-2"><Label htmlFor="fruit-quality-camera">دوربین زنده</Label><select id="fruit-quality-camera" value={qualityCameraId} onChange={event => setQualityCameraId(event.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">{liveCameras.map(camera => <option key={camera.id} value={camera.id}>{camera.name}</option>)}</select>{!cameras.isLoading && liveCameras.length === 0 && <p className="text-sm text-amber-700">هیچ دوربین دارای استریمی در دسترس نیست.</p>}</div>}
      <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-2">
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={detailedQuality} onChange={event => setDetailedQuality(event.target.checked)} className="mt-1 size-4" /><span><span className="font-medium">تحلیل تفصیلی</span><span className="mt-0.5 block text-xs text-muted-foreground">درجه، انواع میوه، عیوب، ماندگاری و توصیه‌ها را هم گزارش می‌کند.</span></span></label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={perFrameQuality} onChange={event => setPerFrameQuality(event.target.checked)} className="mt-1 size-4" /><span><span className="font-medium">امتیاز فریم‌به‌فریم</span><span className="mt-0.5 block text-xs text-muted-foreground">هر فریم جداگانه ارزیابی می‌شود؛ دقیق‌تر ولی چند برابر کندتر است.</span></span></label>
        {mode === 'recorded' && <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="fruit-quality-location">ثبت در گزارشِ (اختیاری)</Label><select id="fruit-quality-location" value={qualityLocation} onChange={event => setQualityLocation(event.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="">بدون مکان — فقط در سوابق من</option>{(locations.data?.markets ?? []).map(item => <option key={`market:${item.id}`} value={`market:${item.id}`}>بازار {item.name}{item.parentName ? ` · ${item.parentName}` : ''}</option>)}{(locations.data?.booths ?? []).map(item => <option key={`booth:${item.id}`} value={`booth:${item.id}`}>{item.name}{item.parentName ? ` · ${item.parentName}` : ''}</option>)}</select><p className="text-xs text-muted-foreground">با انتخاب بازار یا غرفه، این ارزیابی در گزارش مدیریتی همان مکان محاسبه می‌شود.</p></div>}
      </div>
      {quality.error && <p className="text-sm text-red-600">{quality.error.message}</p>}
      <Button type="button" disabled={quality.isPending || (mode === 'recorded' ? !qualityFile : !qualityCameraId)} onClick={() => quality.mutate()}>{quality.isPending ? <Loader2 className="animate-spin" /> : <BrainCircuit />}{quality.isPending ? 'در حال ارزیابی با Qwen…' : 'اجرای ارزیابی کیفیت'}</Button>
    </section>}

    {analysisKind === 'measurement' && <>
    {!calibrations.isLoading && calibratedCameras.length === 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      {mode === 'live' ? 'برای تحلیل زنده، یک دوربین دارای استریم را ' : 'برای تحلیل اندازه ابتدا باید یک دوربین را '}<Link href="/camera-calibration" className="font-semibold underline">کالیبره کنید</Link>.
    </div>}

    <form onSubmit={mode === 'live' ? prepareLiveFrame : submitUpload} className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="font-semibold">۱. انتخاب دوربین و {mode === 'live' ? 'دریافت فریم زنده' : 'ورودی'}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="fruit-camera">دوربین کالیبره‌شده</Label><select id="fruit-camera" value={cameraId} onChange={event => { setCameraId(event.target.value); setInput(null); setPoints([]) }} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
          {calibratedCameras.map(camera => <option key={camera.id} value={camera.id}>{camera.name}</option>)}
        </select>{selectedCalibration && <p className="text-xs text-muted-foreground" dir="ltr">{selectedCalibration.resolutionWidth}×{selectedCalibration.resolutionHeight} · RMS {selectedCalibration.reprojectionError.toFixed(3)} px</p>}</div>
        {mode === 'recorded'
          ? <div className="space-y-1.5"><Label htmlFor="fruit-file">تصویر یا ویدیوی میوه</Label><Input id="fruit-file" name="file" type="file" accept="image/*,video/*,.mov,.mkv,.avi" required /></div>
          : <div className="rounded-lg border bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">یک فریم تازه از استریم دوربین گرفته و مطابق رزولوشن کالیبراسیون آماده می‌شود.</div>}
      </div>
      <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <input name="allow_unsafe_resize" type="checkbox" value="true" className="mt-0.5 size-4" />
        <span><span className="font-semibold">تغییر اندازه اجباری فقط برای آزمایش</span><span className="mt-1 block text-xs">تصاویر با نسبت ابعاد متفاوت کشیده می‌شوند؛ تعداد و تشخیص قابل آزمایش است، اما اندازه‌گیری میلی‌متری معتبر نیست.</span></span>
      </label>
      {(upload.error || prepareLive.error) && <p className="text-sm text-red-600">{(upload.error ?? prepareLive.error)?.message}</p>}
      <Button type="submit" disabled={!cameraId || upload.isPending || prepareLive.isPending}>{upload.isPending || prepareLive.isPending ? <Loader2 className="animate-spin" /> : mode === 'live' ? <Radio /> : <Upload />}{upload.isPending || prepareLive.isPending ? 'در حال آماده‌سازی فریم…' : mode === 'live' ? 'دریافت و نمایش فریم زنده' : 'بارگذاری و نمایش فریم'}</Button>
    </form>

    {input && <form onSubmit={runAnalysis} className="space-y-5 rounded-xl border bg-card p-5 shadow-sm">
      <div><h2 className="font-semibold">۲. انتخاب چهار گوشه پالت</h2><p className="mt-1 text-xs text-muted-foreground">به ترتیب روی گوشه‌های بالا-چپ، بالا-راست، پایین-راست و پایین-چپ کلیک کنید.</p></div>
      {input.allow_unsafe_resize && <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-900">حالت آزمایشی فعال است؛ نتایج اندازه‌گیری فیزیکی این اجرا معتبر نیست.</p>}
      <div className="flex justify-center">
        <div className="relative inline-block max-w-full overflow-hidden rounded-lg border bg-black shadow-sm">
          <TokenImage src={`${FRUIT_API_BASE}${input.preview_url}`} alt="فریم انتخاب پالت" className="block h-auto max-h-[min(70vh,45rem)] max-w-full object-contain" />
          <svg className="absolute inset-0 size-full cursor-crosshair" viewBox={`0 0 ${input.width} ${input.height}`} preserveAspectRatio="none" onClick={choosePoint} role="application" aria-label="انتخاب گوشه‌های پالت">
            {points.length > 1 && <polyline points={points.map(point => `${point.x},${point.y}`).join(' ')} fill={points.length === 4 ? 'rgba(16,185,129,.18)' : 'none'} stroke="#10b981" strokeWidth={Math.max(2, input.width / 500)} />}
            {points.map((point, index) => <g key={index}><circle cx={point.x} cy={point.y} r={Math.max(6, input.width / 130)} fill="#10b981" stroke="white" strokeWidth={2} /><text x={point.x + 10} y={point.y - 10} fill="white" stroke="black" strokeWidth={0.8} fontSize={Math.max(16, input.width / 50)} paintOrder="stroke">{CORNER_LABELS[index]}</text></g>)}
          </svg>
        </div>
      </div>
      <div className="flex items-center gap-3"><span className="text-sm">{points.length} از ۴ گوشه</span><Button type="button" variant="outline" size="sm" onClick={() => setPoints(current => current.slice(0, -1))} disabled={!points.length}><RotateCcw />حذف آخرین نقطه</Button></div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5"><Label htmlFor="pallet_type">نوع پالت</Label><select id="pallet_type" name="pallet_type" value={palletType} onChange={event => setPalletType(event.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="standard_large">استاندارد بزرگ (۱۲۰۰×۱۸۰۰)</option><option value="standard_small">استاندارد کوچک (۱۰۰۰×۱۲۰۰)</option><option value="custom">ابعاد دلخواه</option><option value="calibration_board">صفحه کالیبراسیون</option></select></div>
        {legacyDashboard ? <>
          <div className="space-y-1.5"><Label htmlFor="inference_mode">روش تشخیص</Label><select id="inference_mode" name="inference_mode" value={inferenceMode} onChange={event => setInferenceMode(event.target.value as 'sam_only' | 'detector')} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="sam_only">فقط SAM (پیش‌فرض، بدون مدل تشخیص)</option><option value="detector">تشخیص‌گر + SAM (روش قبلی)</option></select></div>
          <NumberField label="فاصله فریم‌ها" name="frame_step" defaultValue="10" min="1" />
          <NumberField label={mode === 'live' ? 'حداکثر فریم زنده' : 'حداکثر فریم (اختیاری)'} name="max_frames" defaultValue={mode === 'live' ? '100' : undefined} min="1" required={mode === 'live'} />
        </> : <div className="space-y-1.5 md:col-span-1">
          <Label htmlFor="inference_interval_minutes">فاصله اجرای SAM (دقیقه)</Label>
          <Input id="inference_interval_minutes" name="inference_interval_minutes" type="number" min="1" max="60" step="1" required value={inferenceIntervalMinutes} onChange={event => setInferenceIntervalMinutes(Number(event.target.value))} />
          <p className="text-xs text-muted-foreground">از ۱ دقیقه تا ۱ ساعت؛ بدون ردیابی و با حفظ آخرین ماسک.</p>
        </div>}
        <NumberField label="حداکثر خطای کالیبراسیون" name="max_calibration_error" defaultValue="3.0" min="0.1" step="0.1" />
        <NumberField label="حداقل همپوشانی با پالت" name="min_pallet_overlap" defaultValue="0.5" min="0" max="1" step="0.05" />
        {palletType === 'custom' && <div className="grid gap-4 md:col-span-2 md:grid-cols-2 lg:col-span-4">
          <NumberField label="عرض پالت (میلی‌متر)" name="pallet_width_mm" min="1" step="0.1" required />
          <NumberField label="طول پالت (میلی‌متر)" name="pallet_length_mm" min="1" step="0.1" required />
        </div>}
      </div>
      {(start.error || job.error || cancel.error) && <p className="text-sm text-red-600">{(start.error ?? job.error ?? cancel.error)?.message}</p>}
      {currentJob && currentJob.status !== 'completed' && <div className={`rounded-lg border p-3 text-sm ${currentJob.status === 'failed' ? 'border-red-200 bg-red-50 text-red-700' : currentJob.status === 'cancelled' ? 'border-slate-200 bg-slate-50 text-slate-700' : 'border-sky-200 bg-sky-50 text-sky-800'}`}>{currentJob.status === 'failed' ? currentJob.error : currentJob.status === 'cancelled' ? <span className="flex items-center gap-2"><Ban className="size-4" />پردازش متوقف شد.</span> : <span className="flex items-center gap-2"><Loader2 className="size-4 animate-spin" />{currentJob.status === 'cancelling' ? 'در حال توقف پردازش…' : legacyDashboard ? 'مدل در حال تشخیص، قطعه‌بندی و اندازه‌گیری میوه‌هاست…' : 'تحلیل دوره‌ای فعال است؛ آخرین ماسک تا اجرای بعدی SAM نمایش داده می‌شود.'}</span>}</div>}
      {currentJob && jobIsActive && live && <LivePreviewPanel jobId={currentJob.id} live={live} connected={connected} intervalMode={!legacyDashboard} />}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={points.length !== 4 || start.isPending || jobIsActive}><Play />{mode === 'live' ? 'شروع تحلیل زنده میوه' : 'شروع تحلیل میوه'}</Button>
        {currentJob && ['queued', 'running'].includes(currentJob.status) && <Button type="button" variant="outline" onClick={() => cancel.mutate()} disabled={cancel.isPending}><Ban />{cancel.isPending ? 'در حال ارسال درخواست توقف…' : 'توقف پردازش'}</Button>}
      </div>
    </form>}
    </>}

    {qualityReport && <QualityResultView result={qualityReport.result} context={qualityReport} />}
    {analysisKind === 'quality' && <QualityHistory cameraId={mode === 'live' ? qualityCameraId || undefined : undefined} />}
    {measurementReport && <ResultView result={measurementReport.result} jobId={measurementReport.jobId} />}
  </div>
}

/** Image of the fruit service; the URL gets the service token when authentication is enabled. */
function TokenImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const url = useTokenizedUrl(src)
  if (!url) return <div className={`animate-pulse bg-muted ${className ?? ''}`} style={{ minHeight: '8rem', minWidth: '12rem' }} />
  // Pipeline artifacts are dynamic cross-origin URLs and cannot use next/image optimization.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={className} />
}

function useFruitJobLive(jobId: string | null, job: FruitJob | undefined) {
  const queryClient = useQueryClient()
  const [live, setLive] = useState<FruitLiveEvent | null>(job?.live ?? null)
  const [connected, setConnected] = useState(false)
  const polledLive = job?.live
  const jobStatus = job?.status

  useEffect(() => {
    setLive(null)
    setConnected(false)
  }, [jobId])

  useEffect(() => {
    if (!polledLive) return
    setLive(previous => ({
      ...polledLive,
      metrics: { ...(previous?.metrics ?? {}), ...polledLive.metrics },
      preview_reference: polledLive.preview_reference ?? previous?.preview_reference ?? null,
    }))
  }, [polledLive])

  useEffect(() => {
    if (!jobId || !jobStatus || !['queued', 'running', 'cancelling'].includes(jobStatus)) return
    let source: EventSource | null = null
    let cancelled = false
    let retryTimer: number | undefined
    let retries = 0
    let lastEventId = 0
    const receive = (raw: Event) => {
      const message = raw as MessageEvent<string>
      const eventId = Number(message.lastEventId)
      if (Number.isFinite(eventId) && eventId > lastEventId) lastEventId = eventId
      try {
        const next = JSON.parse(message.data) as FruitLiveEvent
        setLive(previous => ({
          ...next,
          metrics: { ...(previous?.metrics ?? {}), ...next.metrics },
          preview_reference: next.preview_reference ?? previous?.preview_reference ?? null,
        }))
        if (['job_completed', 'job_failed', 'job_cancelled'].includes(next.type)) {
          source?.close()
          queryClient.invalidateQueries({ queryKey: ['fruit-job', jobId] })
        }
      } catch {}
    }
    const open = async (freshToken: boolean) => {
      const token = await getServiceToken(freshToken)
      if (cancelled) return
      const url = `${FRUIT_API_BASE}/api/v1/jobs/${jobId}/events${lastEventId ? `?after=${lastEventId}` : ''}`
      source = new EventSource(appendAccessToken(url, token))
      for (const type of ['job_started', 'preview_updated', 'warning', 'job_completed', 'job_failed', 'job_cancelled']) {
        source.addEventListener(type, receive)
      }
      source.onopen = () => { retries = 0; setConnected(true) }
      source.onerror = () => {
        setConnected(false)
        // A refused connection (for example an expired token) is not retried by the
        // browser; try again with a new token while polling keeps the panel current.
        if (source?.readyState === EventSource.CLOSED && !cancelled && retries < 5) {
          retries += 1
          retryTimer = window.setTimeout(() => void open(true), 3_000)
        }
      }
    }
    void open(false)
    return () => {
      cancelled = true
      window.clearTimeout(retryTimer)
      source?.close()
    }
  }, [jobId, jobStatus, queryClient])

  return { live, connected }
}

function LivePreviewPanel({ jobId, live, connected, intervalMode }: { jobId: string; live: FruitLiveEvent; connected: boolean; intervalMode: boolean }) {
  const processed = numericMetric(live.metrics.processed_frame_count)
  const total = numericMetric(live.metrics.total_sampled_frames)
  const currentFruits = numericMetric(live.metrics.num_fruits)
  const measuredFruits = numericMetric(live.metrics.num_measured_fruits)
  const cumulative = numericMetric(live.metrics.total_fruit_observations)
  const averageSize = sizeMetric(live.metrics.average_fruit_size_mm)
  const fruits = fruitsMetric(live.metrics.fruits)
  const previewStreamUrl = useTokenizedUrl(`${FRUIT_API_BASE}/api/v1/jobs/${jobId}/preview-stream`)

  return <section className="space-y-3 rounded-xl border border-sky-200 bg-sky-50/50 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <p className="text-sm font-semibold text-sky-950">پیش‌نمایش زنده پردازش</p>
        <p className="mt-1 text-xs text-sky-800">{intervalMode ? 'آخرین ماسک روی فریم‌های بعدی باقی می‌ماند؛ شمارش و اندازه در اجرای بعدی SAM به‌روزرسانی می‌شود.' : 'هر فریم بلافاصله پس از تشخیص و اندازه‌گیری نمایش داده می‌شود.'}</p>
      </div>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className={`size-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
        {connected ? 'اتصال زنده' : 'بروزرسانی پشتیبان'}
      </span>
    </div>
    {typeof live.progress === 'number' && <div className="space-y-1">
      <div className="h-2 overflow-hidden rounded-full bg-sky-100"><div className="h-full bg-sky-600 transition-all" style={{ width: `${live.progress}%` }} /></div>
      <p className="text-xs text-muted-foreground" dir="ltr">{live.progress.toFixed(1)}%{processed !== null ? ` · ${processed}${total !== null ? ` / ${total}` : ''} frames` : ''}</p>
    </div>}
    {live.preview_reference && previewStreamUrl && <div className="flex justify-center overflow-hidden rounded-lg border bg-black">
      {/* A persistent MJPEG request keeps the last processed frame visible between updates. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={previewStreamUrl} alt="پیش‌نمایش زنده تحلیل میوه" className="block h-auto max-h-[min(70vh,45rem)] max-w-full object-contain" />
    </div>}
    {(currentFruits !== null || cumulative !== null) && <div className="grid gap-2 text-xs sm:grid-cols-3">
      <LiveMetric label="میوه در فریم فعلی" value={currentFruits} />
      <LiveMetric label="اندازه‌گیری‌شده در فریم" value={measuredFruits} />
      <LiveMetric label="مجموع مشاهدات تا اینجا" value={cumulative} />
    </div>}
    {averageSize && <div className="grid gap-2 text-xs sm:grid-cols-3">
      <LiveMetric label="میانگین عرض" value={averageSize.width} suffix="mm" />
      <LiveMetric label="میانگین طول" value={averageSize.length} suffix="mm" />
      <LiveMetric label="میانگین قطر معادل" value={averageSize.equivalent_diameter} suffix="mm" />
    </div>}
    {fruits.length > 0 && <div className="space-y-1.5">
      <p className="text-xs font-semibold text-sky-950">میوه‌های آخرین اجرای SAM ({fruits.length.toLocaleString('fa-IR')})</p>
      <div className="max-h-64 overflow-auto rounded-lg border bg-background/80">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted/60"><tr className="border-b text-right text-muted-foreground"><th className="p-2">شناسه</th><th className="p-2">عرض</th><th className="p-2">طول</th><th className="p-2">قطر معادل</th></tr></thead>
          <tbody>{fruits.map(fruit => <tr key={fruit.fruit_id} className="border-b last:border-0">
            <td className="p-2">#{fruit.fruit_id}</td>
            <td className="p-2" dir="ltr">{fruit.width_mm.toFixed(1)} mm</td>
            <td className="p-2" dir="ltr">{fruit.length_mm.toFixed(1)} mm</td>
            <td className="p-2" dir="ltr">{fruit.equivalent_diameter_mm.toFixed(1)} mm</td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>}
  </section>
}

function numericMetric(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

type LiveFruit = { fruit_id: number; width_mm: number; length_mm: number; equivalent_diameter_mm: number }

function fruitsMetric(value: unknown): LiveFruit[] {
  if (!Array.isArray(value)) return []
  return value.flatMap(entry => {
    if (!entry || typeof entry !== 'object') return []
    const item = entry as Record<string, unknown>
    const fruitId = numericMetric(item.fruit_id)
    const widthMm = numericMetric(item.width_mm)
    const lengthMm = numericMetric(item.length_mm)
    const equivalentDiameterMm = numericMetric(item.equivalent_diameter_mm)
    return fruitId === null || widthMm === null || lengthMm === null || equivalentDiameterMm === null
      ? []
      : [{ fruit_id: fruitId, width_mm: widthMm, length_mm: lengthMm, equivalent_diameter_mm: equivalentDiameterMm }]
  })
}

function sizeMetric(value: unknown): { width: number; length: number; equivalent_diameter: number } | null {
  if (!value || typeof value !== 'object') return null
  const metric = value as Record<string, unknown>
  const width = numericMetric(metric.width)
  const length = numericMetric(metric.length)
  const equivalentDiameter = numericMetric(metric.equivalent_diameter)
  return width === null || length === null || equivalentDiameter === null
    ? null
    : { width, length, equivalent_diameter: equivalentDiameter }
}

function LiveMetric({ label, value, suffix }: { label: string; value: number | null; suffix?: string }) {
  return <div className="rounded-md border bg-background/80 p-3"><p className="text-muted-foreground">{label}</p><p className="mt-1 text-base font-bold" dir="auto">{value === null ? '—' : `${value.toLocaleString('fa-IR', { maximumFractionDigits: 1 })}${suffix ? ` ${suffix}` : ''}`}</p></div>
}

function NumberField({ label, name, ...props }: { label: string; name: string } & React.ComponentProps<typeof Input>) {
  return <div className="space-y-1.5"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type="number" {...props} /></div>
}

function exportMeasurementCsv(result: FruitResult, jobId: string) {
  downloadCsv(
    `fruit-measurement-${fileStamp()}.csv`,
    ['شناسه کار', 'فریم', 'زمان (میلی‌ثانیه)', 'شناسه میوه', 'عرض (mm)', 'طول (mm)', 'قطر معادل (mm)', 'مساحت (mm²)'],
    result.frames.flatMap(frame => frame.fruits.filter(fruit => fruit.size).map(fruit => [
      jobId, frame.frame_index ?? 0, frame.timestamp_ms, fruit.fruit_id,
      fruit.size!.width_mm, fruit.size!.length_mm, fruit.size!.equivalent_diameter_mm, fruit.size!.area_mm2,
    ])),
  )
}

function ResultView({ result, jobId }: { result: FruitResult; jobId: string }) {
  const average = result.average_fruit_size_mm
  const statistics = result.size_statistics
  const histogram = statistics?.histogram ?? []
  const peak = Math.max(1, ...histogram.map(bin => bin.count))
  // The service builds the complete export (every frame, overlays) from its own files.
  const openServiceExport = async (format: 'csv' | 'json' | 'zip') => {
    window.open(await withServiceToken(`${FRUIT_API_BASE}/api/v1/jobs/${jobId}/export?format=${format}`), '_blank', 'noopener,noreferrer')
  }
  return <section className="space-y-5 rounded-xl border bg-card p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2"><CheckCircle2 className="size-5 text-emerald-600" /><h2 className="font-semibold">نتیجه تحلیل</h2></div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => void openServiceExport('zip')}><Download />بسته کامل (ZIP)</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => exportMeasurementCsv(result, jobId)}><FileSpreadsheet />اندازه هر میوه (CSV)</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => downloadJson(`fruit-measurement-${fileStamp()}.json`, { jobId, exportedAt: new Date().toISOString(), result })}><FileJson />JSON</Button>
      </div>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Metric label="تعداد میوه" value={result.total_fruit_observations.toLocaleString('fa-IR')} />
      <Metric label="میانگین عرض" value={average ? `${average.width.toFixed(1)} mm` : '—'} />
      <Metric label="میانگین طول" value={average ? `${average.length.toFixed(1)} mm` : '—'} />
      <Metric label="قطر معادل میانگین" value={average ? `${average.equivalent_diameter.toFixed(1)} mm` : '—'} />
    </div>
    {statistics?.diameter_mm && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {([['min', 'کوچک‌ترین قطر'], ['p10', 'صدک ۱۰'], ['median', 'میانه قطر'], ['p90', 'صدک ۹۰'], ['max', 'بزرگ‌ترین قطر']] as const).map(([key, label]) => <Metric key={key} label={label} value={statistics.diameter_mm?.[key] == null ? '—' : `${statistics.diameter_mm[key]!.toFixed(1)} mm`} />)}
    </div>}
    {histogram.length > 0 && <div className="space-y-2">
      <p className="text-xs font-semibold">توزیع قطر معادل (آخرین اجرای SAM)</p>
      <div className="flex h-28 items-end gap-1" dir="ltr">{histogram.map(bin => <div key={bin.from_mm} className="flex flex-1 flex-col items-center gap-1" title={`${bin.from_mm}–${bin.to_mm} mm: ${bin.count}`}>
        <div className="w-full rounded-t bg-emerald-500/80" style={{ height: `${(bin.count / peak) * 100}%`, minHeight: bin.count ? 2 : 0 }} />
        <span className="text-[10px] text-muted-foreground">{bin.from_mm}</span>
      </div>)}</div>
    </div>}
    <p className="text-xs text-muted-foreground">{result.processed_frame_count.toLocaleString('fa-IR')} فریم پردازش شده است. در ویدیو، تعداد بالا مجموع مشاهدات میوه در فریم‌های نمونه‌برداری‌شده است.</p>
    <div className="grid gap-4 lg:grid-cols-2">{result.frames.filter(frame => frame.measurement_overlay_url).map((frame, index) => <figure key={`${frame.frame_index}-${index}`} className="overflow-hidden rounded-lg border"><TokenImage src={fruitArtifactUrl(frame.measurement_overlay_url!)} alt={`اندازه میوه‌ها در فریم ${frame.frame_index ?? 0}`} className="w-full" /><figcaption className="p-2 text-xs text-muted-foreground">فریم {frame.frame_index ?? 0} — {frame.num_fruits.toLocaleString('fa-IR')} میوه</figcaption></figure>)}</div>
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-right text-muted-foreground"><th className="p-2">فریم</th><th className="p-2">شناسه</th><th className="p-2">عرض</th><th className="p-2">طول</th><th className="p-2">قطر معادل</th></tr></thead><tbody>{result.frames.flatMap((frame, frameIndex) => frame.fruits.filter(fruit => fruit.size).map(fruit => <tr key={`${frameIndex}-${fruit.fruit_id}`} className="border-b last:border-0"><td className="p-2">{frame.frame_index ?? 0}</td><td className="p-2">#{fruit.fruit_id}</td><td className="p-2" dir="ltr">{fruit.size!.width_mm.toFixed(1)} mm</td><td className="p-2" dir="ltr">{fruit.size!.length_mm.toFixed(1)} mm</td><td className="p-2" dir="ltr">{fruit.size!.equivalent_diameter_mm.toFixed(1)} mm</td></tr>))}</tbody></table></div>
  </section>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border bg-muted/30 p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-xl font-bold" dir="auto">{value}</p></div>
}
