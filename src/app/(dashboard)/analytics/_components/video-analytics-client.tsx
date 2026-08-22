'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  AlertCircle,
  Ban,
  CheckCircle2,
  Clock3,
  Download,
  FileVideo,
  Loader2,
  RefreshCw,
  Upload,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  PolygonEditor,
  type PolygonValue,
} from '@/app/(dashboard)/regions/_components/polygon-editor'
import { buildConfiguredQueueCameraYaml, buildRestrictedAreaCameraYaml } from './restricted-area-config'
import { CameraLivePreview } from './camera-live-preview'
import type { Camera as CameraType } from '@/modules/camera/types'

const API_BASE = (
  process.env.NEXT_PUBLIC_VIDEO_ANALYTICS_API_URL ?? 'http://localhost:8000'
).replace(/\/$/, '')

type Application = {
  id: string
  name: string
  description: string
  requires_camera_config: boolean
  metric_schema: MetricDefinition[]
}

type MetricDefinition = {
  key: string
  label: string
  value_type: 'number' | 'integer' | 'boolean' | 'string' | 'table'
  unit: string | null
  aggregation: 'current' | 'total' | 'average' | 'minimum' | 'maximum'
  display: 'card' | 'chart' | 'status' | 'counter' | 'table'
  availability: 'live' | 'final' | 'both'
}

type CrowdedRegionMetric = {
  region_id: number
  row: number
  column: number
  normalized_bounds: [number, number, number, number]
  average_occupancy: number
}

type LiveEvent = {
  type: string
  job_id: string
  timestamp: string
  status: AnalyticsJob['status']
  frame_index: number | null
  progress: number | null
  elapsed_seconds: number
  metrics: Record<string, unknown>
  preview_reference: string | null
  message: string | null
}

type Artifact = {
  filename: string
  media_type: string
  url: string
}

type AnalyticsJob = {
  id: string
  application_id: string
  application: Application
  original_filename: string
  camera_id: string
  status: 'queued' | 'running' | 'cancelling' | 'completed' | 'failed' | 'cancelled'
  created_at: string
  updated_at: string
  max_frames: number | null
  enable_reid: boolean
  tracker_type: string
  error: string | null
  summary: Record<string, unknown> | null
  artifacts: Record<string, Artifact>
  live: LiveEvent | null
  preview_url: string | null
  enabled_tasks: string[]
  source_type: 'file' | 'rtsp'
}

type TrackerOption = {
  type: string
  label: string
  description: string
  requires_reid: boolean
}

const FALLBACK_TRACKERS: TrackerOption[] = [
  { type: 'bytetrack', label: 'ByteTrack', description: 'Baseline motion tracker.', requires_reid: false },
  { type: 'stabletrack', label: 'StableTrack', description: 'Low-frequency association for 0.5 FPS processing.', requires_reid: false },
]

const LIVE_TASKS = [
  {
    id: 'people_counting',
    label: 'شمارش افراد',
    description: 'تعداد فعلی، افراد یکتا، ورود و خروج',
  },
  {
    id: 'heatmap',
    label: 'نقشه حرارتی توقف و تراکم',
    description: 'نمایش نقشه حرارتی و پرتراکم‌ترین بخش‌ها',
  },
  {
    id: 'vertical_queue',
    label: 'پایش خودکار صف',
    description: 'تشخیص خودکار صف و گزارش طول، زمان انتظار و سرعت حرکت',
  },
  {
    id: 'configured_queue',
    label: 'پایش صف تعریف‌شده',
    description: 'شمارش افراد داخل خط صف ثبت‌شده این دوربین در بخش مناطق',
  },
  {
    id: 'restricted_area',
    label: 'ورود به ناحیه ممنوعه',
    description: 'تشخیص زنده ورود و خروج از مناطق ثبت‌شده برای این دوربین',
  },
] as const

type LiveTaskId = (typeof LIVE_TASKS)[number]['id']

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, init)
  } catch {
    throw new Error(`سرویس تحلیل ویدیو در ${API_BASE} در دسترس نیست`)
  }
  if (!response.ok) {
    let message = 'خطا در ارتباط با سرویس تحلیل ویدیو'
    try {
      const body = await response.json()
      if (typeof body.detail === 'string') message = body.detail
    } catch {}
    throw new Error(message)
  }
  return response.json()
}

function artifactUrl(artifact: Artifact): string {
  return `${API_BASE}${artifact.url}`
}

type ExtractedFrame = {
  dataUrl: string
  aspectRatio: number
}

function extractFirstVideoFrameInBrowser(file: File): Promise<ExtractedFrame> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const video = document.createElement('video')

    function cleanup() {
      video.onloadeddata = null
      video.onerror = null
      URL.revokeObjectURL(objectUrl)
      video.removeAttribute('src')
      video.load()
    }

    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    video.onloadeddata = () => {
      if (!video.videoWidth || !video.videoHeight) {
        cleanup()
        reject(new Error('ابعاد فریم ویدیو قابل خواندن نیست.'))
        return
      }
      const width = Math.min(video.videoWidth, 1600)
      const height = Math.max(1, Math.round(width / (video.videoWidth / video.videoHeight)))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) {
        cleanup()
        reject(new Error('امکان خواندن فریم ویدیو وجود ندارد.'))
        return
      }
      context.drawImage(video, 0, 0, width, height)
      const result = {
        dataUrl: canvas.toDataURL('image/jpeg', 0.88),
        aspectRatio: video.videoWidth / video.videoHeight,
      }
      cleanup()
      resolve(result)
    }
    video.onerror = () => {
      cleanup()
      reject(new Error('مرورگر نتوانست فریم اول این ویدیو را باز کند.'))
    }
    video.src = objectUrl
    video.load()
  })
}

async function extractFirstVideoFrameViaServer(file: File): Promise<ExtractedFrame> {
  const formData = new FormData()
  formData.append('video', file)
  let response: Response
  try {
    response = await fetch(`${API_BASE}/api/v1/frames/first`, { method: 'POST', body: formData })
  } catch {
    throw new Error(`سرویس تحلیل ویدیو در ${API_BASE} در دسترس نیست`)
  }
  if (!response.ok) {
    let message = 'سرویس نتوانست فریم اول این ویدیو را استخراج کند.'
    try {
      const body = await response.json()
      if (typeof body.detail === 'string') message = body.detail
    } catch {}
    throw new Error(message)
  }
  const body = (await response.json()) as {
    data: { data_url: string; aspect_ratio: number }
  }
  return { dataUrl: body.data.data_url, aspectRatio: body.data.aspect_ratio }
}

// Some codecs (e.g. HEVC-in-MP4) are accepted by the backend's OpenCV
// pipeline but can't be decoded by the browser's <video> element. Fall back
// to server-side extraction so the polygon editor still gets a frame.
async function extractFirstVideoFrame(file: File): Promise<ExtractedFrame> {
  try {
    return await extractFirstVideoFrameInBrowser(file)
  } catch {
    return extractFirstVideoFrameViaServer(file)
  }
}

const EMPTY_DRAWN_REGION: PolygonValue = {
  mainPolygon: [],
  exclusionPolygons: [],
}

const DRAWN_REGION_APPLICATIONS = {
  restricted_area: {
    title: 'ناحیه محدود روی فریم اول',
    description: 'حداقل سه نقطه روی تصویر انتخاب کنید. مقادیر نرمال‌شده به‌صورت خودکار به ماژول تشخیص ارسال می‌شود.',
    incompleteError: 'ناحیه محدود باید حداقل سه رأس داشته باشد.',
    className: 'border-emerald-200 bg-emerald-50/50',
  },
  configured_queue: {
    title: 'خط صف روی فریم اول',
    description: 'حداقل سه نقطه روی تصویر انتخاب کنید تا محدوده صف مشخص شود. تعداد افراد داخل صف و سرعت حرکت صف محاسبه می‌شود.',
    incompleteError: 'خط صف باید حداقل سه رأس داشته باشد.',
    className: 'border-sky-200 bg-sky-50/50',
  },
} as const

type DrawnRegionApplicationId = keyof typeof DRAWN_REGION_APPLICATIONS

function isDrawnRegionApplication(id: string): id is DrawnRegionApplicationId {
  return id in DRAWN_REGION_APPLICATIONS
}

export function VideoAnalyticsClient({
  canEnableReid,
  mode = 'recorded',
}: {
  canEnableReid: boolean
  mode?: 'recorded' | 'live'
}) {
  const queryClient = useQueryClient()
  const formRef = useRef<HTMLFormElement>(null)
  const [selectedApplication, setSelectedApplication] = useState('people_counting')
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [firstFrame, setFirstFrame] = useState<ExtractedFrame | null>(null)
  const [isExtractingFrame, setIsExtractingFrame] = useState(false)
  const [frameError, setFrameError] = useState<string | null>(null)
  const [drawnRegion, setDrawnRegion] = useState<PolygonValue>(EMPTY_DRAWN_REGION)
  const [configurationError, setConfigurationError] = useState<string | null>(null)
  const [selectedLiveCameraId, setSelectedLiveCameraId] = useState('')
  const [selectedLiveApplications, setSelectedLiveApplications] = useState<LiveTaskId[]>([
    'people_counting',
    'heatmap',
  ])
  const [selectedTracker, setSelectedTracker] = useState('bytetrack')

  useEffect(() => {
    let active = true
    setFirstFrame(null)
    setFrameError(null)
    setDrawnRegion(EMPTY_DRAWN_REGION)
    setIsExtractingFrame(false)
    if (!videoFile) return () => { active = false }

    setIsExtractingFrame(true)
    extractFirstVideoFrame(videoFile)
      .then(frame => {
        if (active) setFirstFrame(frame)
      })
      .catch(error => {
        if (active) setFrameError(error instanceof Error ? error.message : String(error))
      })
      .finally(() => {
        if (active) setIsExtractingFrame(false)
      })

    return () => { active = false }
  }, [videoFile])

  const applicationsQuery = useQuery<{ data: Application[] }>({
    queryKey: ['video-analytics-applications'],
    queryFn: () => apiJson('/api/v1/applications'),
    retry: 1,
  })
  const trackersQuery = useQuery<{ data: TrackerOption[] }>({
    queryKey: ['video-analytics-trackers'],
    queryFn: () => apiJson('/api/v1/trackers'),
    retry: 1,
  })
  const camerasQuery = useQuery<{ data: CameraType[] }>({
    queryKey: ['video-analytics-cameras'],
    queryFn: async () => {
      const response = await fetch('/api/cameras')
      if (!response.ok) throw new Error('خطا در دریافت دوربین‌ها')
      return response.json()
    },
    retry: 1,
  })
  const jobsQuery = useQuery<{ data: AnalyticsJob[] }>({
    queryKey: ['video-analytics-jobs'],
    queryFn: () => apiJson('/api/v1/jobs'),
    refetchInterval: query => {
      const jobs = query.state.data?.data ?? []
      return jobs.some(job => ['queued', 'running', 'cancelling'].includes(job.status)) ? 2_000 : 10_000
    },
    retry: 1,
  })

  const selected = useMemo(
    () => applicationsQuery.data?.data.find(item => item.id === selectedApplication),
    [applicationsQuery.data, selectedApplication],
  )
  const trackerOptions = trackersQuery.data?.data?.length ? trackersQuery.data.data : FALLBACK_TRACKERS
  const selectedTrackerOption = trackerOptions.find(item => item.type === selectedTracker) ?? trackerOptions[0]

  const liveCameras = useMemo(
    () => (camerasQuery.data?.data ?? []).filter(camera => Boolean(camera.streamUrl)),
    [camerasQuery.data],
  )
  const selectedLiveCamera = useMemo(
    () => liveCameras.find(camera => camera.id === selectedLiveCameraId) ?? liveCameras[0],
    [liveCameras, selectedLiveCameraId],
  )

  useEffect(() => {
    if (!selectedLiveCameraId && liveCameras[0]) setSelectedLiveCameraId(liveCameras[0].id)
  }, [liveCameras, selectedLiveCameraId])

  const selectedCameraHasRestrictedArea = Boolean(
    selectedLiveCamera?.regions?.some(mapping => mapping.region.type === 'RESTRICTED_AREA'),
  )
  const selectedCameraHasQueue = Boolean(
    selectedLiveCamera?.regions?.some(mapping => mapping.region.type === 'QUEUE'),
  )
  useEffect(() => {
    if (selectedCameraHasRestrictedArea) {
      setSelectedLiveApplications(current => current.includes('restricted_area')
        ? current
        : [...current, 'restricted_area'])
    } else {
      setSelectedLiveApplications(current => current.filter(id => id !== 'restricted_area'))
    }
  }, [selectedLiveCamera?.id, selectedCameraHasRestrictedArea])
  useEffect(() => {
    if (!selectedCameraHasQueue) {
      setSelectedLiveApplications(current => current.filter(id => id !== 'configured_queue'))
    }
  }, [selectedLiveCamera?.id, selectedCameraHasQueue])

  const visibleJobs = useMemo(
    () => (jobsQuery.data?.data ?? []).filter(job => mode === 'live' ? job.source_type === 'rtsp' : job.source_type !== 'rtsp'),
    [jobsQuery.data, mode],
  )

  const createJob = useMutation({
    mutationFn: (formData: FormData) =>
      apiJson<{ data: AnalyticsJob }>('/api/v1/jobs', { method: 'POST', body: formData }),
    onSuccess: response => {
      formRef.current?.reset()
      setSelectedApplication('people_counting')
      setVideoFile(null)
      setFirstFrame(null)
      setDrawnRegion(EMPTY_DRAWN_REGION)
      setConfigurationError(null)
      queryClient.invalidateQueries({ queryKey: ['video-analytics-jobs'] })
      setSelectedJobId(response.data.id)
    },
  })

  const createLiveJob = useMutation({
    mutationFn: async () => {
      if (!selectedLiveCamera) throw new Error('ابتدا یک دوربین زنده انتخاب کنید.')
      const response = await fetch(`/api/cameras/${selectedLiveCamera.id}/analytics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationIds: selectedLiveApplications,
          maxFrames: 1_800,
          trackerType: selectedTracker,
        }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        const detail = body?.detail?.detail ?? body?.detail ?? body?.error
        throw new Error(typeof detail === 'string' ? detail : 'شروع تحلیل زنده ناموفق بود')
      }
      return body as { data: AnalyticsJob }
    },
    onSuccess: response => {
      queryClient.invalidateQueries({ queryKey: ['video-analytics-jobs'] })
      setSelectedJobId(response.data.id)
    },
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    data.set('application_id', selectedApplication)
    data.set('tracker_type', selectedTracker)
    if (!data.get('max_frames')) data.delete('max_frames')
    setConfigurationError(null)

    if (isDrawnRegionApplication(selectedApplication)) {
      if (isExtractingFrame || !firstFrame) {
        setConfigurationError('ابتدا منتظر بمانید تا فریم اول ویدیو آماده شود.')
        return
      }
      if (drawnRegion.mainPolygon.length < 3) {
        setConfigurationError(DRAWN_REGION_APPLICATIONS[selectedApplication].incompleteError)
        return
      }
      try {
        const cameraId = String(data.get('camera_id') ?? '')
        const yaml = selectedApplication === 'restricted_area'
          ? buildRestrictedAreaCameraYaml({
              cameraId,
              points: drawnRegion.mainPolygon,
            })
          : buildConfiguredQueueCameraYaml({
              cameraId,
              points: drawnRegion.mainPolygon,
            })
        data.set(
          'camera_config',
          new File([yaml], 'camera.yaml', { type: 'application/yaml' }),
        )
      } catch (error) {
        setConfigurationError(error instanceof Error ? error.message : String(error))
        return
      }
    }
    createJob.mutate(data)
  }

  const serviceError = applicationsQuery.error ?? jobsQuery.error

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">{mode === 'live' ? 'تحلیل زنده' : 'تحلیل ویدیو'}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === 'live'
            ? 'تحلیل‌ها را برای هر دوربین جداگانه روشن یا خاموش کنید و نتیجه پردازش‌شده را زنده ببینید.'
            : 'یک فایل ویدیویی بارگذاری کنید و نتایج تحلیل ضبط‌شده را جدا از پایش زنده ببینید.'}
        </p>
      </div>

      {serviceError && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="text-sm font-semibold">سرویس تحلیل ویدیو متصل نیست</p>
            <p className="mt-1 text-xs" dir="ltr">{(serviceError as Error).message}</p>
            <p className="mt-2 text-xs">ابتدا FastAPI را روی پورت 8000 اجرا کنید.</p>
          </div>
        </div>
      )}

      {mode === 'live' && <section className="space-y-5 rounded-xl border bg-card p-5 shadow-sm">
        <div>
          <h2 className="text-base font-semibold">تحلیل دوربین زنده</h2>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">
            دوربین و نوع تحلیل را انتخاب کنید؛ خروجی پردازش‌شده و دکمه توقف در همین صفحه نمایش داده می‌شود.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="live_camera">دوربین زنده</Label>
            <select
              id="live_camera"
              value={selectedLiveCamera?.id ?? ''}
              onChange={event => setSelectedLiveCameraId(event.target.value)}
              disabled={camerasQuery.isLoading || liveCameras.length === 0}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {liveCameras.map(camera => (
                <option key={camera.id} value={camera.id}>{camera.name}</option>
              ))}
            </select>
            {liveCameras.length === 0 && !camerasQuery.isLoading && (
              <p className="text-xs text-amber-600">هیچ دوربینی با آدرس استریم ثبت نشده است.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="live_tracker">ردیاب افراد (موقت)</Label>
            <select
              id="live_tracker"
              value={selectedTracker}
              onChange={event => setSelectedTracker(event.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {trackerOptions.map(tracker => (
                <option key={tracker.type} value={tracker.type}>{tracker.label}</option>
              ))}
            </select>
            {selectedTrackerOption && (
              <p className="text-xs text-muted-foreground">{selectedTrackerOption.description}</p>
            )}
          </div>

          <div className="space-y-2 lg:row-span-2">
            <Label>تحلیل‌های فعال</Label>
            <div className="space-y-2" role="group" aria-label="تحلیل‌های زنده">
              {LIVE_TASKS.filter(task =>
                (task.id !== 'restricted_area' || selectedCameraHasRestrictedArea) &&
                (task.id !== 'configured_queue' || selectedCameraHasQueue),
              ).map(task => {
                const checked = selectedLiveApplications.includes(task.id)
                return (
                  <label
                    key={task.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                      checked ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'hover:bg-accent'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setSelectedLiveApplications(current => {
                        if (checked) return current.filter(id => id !== task.id)
                        if (task.id === 'configured_queue') {
                          return [...current.filter(id => id !== 'vertical_queue'), task.id]
                        }
                        if (task.id === 'vertical_queue') {
                          return [...current.filter(id => id !== 'configured_queue'), task.id]
                        }
                        return [...current, task.id]
                      })}
                      className="mt-1 size-4 rounded border-input accent-primary"
                    />
                    <span>
                      <span className="block text-sm font-semibold">{task.label}</span>
                      <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                        {task.description}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              همه تحلیل‌های انتخاب‌شده در یک پردازش مشترک اجرا می‌شوند؛ تشخیص و ردیابی فقط یک‌بار انجام می‌شود.
              پایش خودکار صف و پایش صف تعریف‌شده را نمی‌توان همزمان در یک پردازش انتخاب کرد.
            </p>
            {!selectedCameraHasRestrictedArea && selectedLiveCamera && (
              <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                برای فعال‌سازی تشخیص ناحیه ممنوعه، ابتدا در بخش مناطق یک محدوده برای این دوربین رسم کنید.
              </p>
            )}
            {!selectedCameraHasQueue && selectedLiveCamera && (
              <p className="rounded-md border border-sky-200 bg-sky-50 p-2 text-xs text-sky-900">
                برای پایش صف تعریف‌شده، ابتدا در بخش مناطق یک خط صف برای این دوربین ثبت کنید.
              </p>
            )}
          </div>
        </div>

        {selectedLiveCamera && (
          <div className="mx-auto w-full max-w-4xl overflow-hidden rounded-lg border bg-black">
            <CameraLivePreview
              cameraId={selectedLiveCamera.id}
              cameraName={selectedLiveCamera.name}
            />
          </div>
        )}

        {createLiveJob.error && (
          <p className="text-sm text-red-600" dir="auto">{createLiveJob.error.message}</p>
        )}
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() => createLiveJob.mutate()}
            disabled={createLiveJob.isPending || !selectedLiveCamera || selectedLiveApplications.length === 0}
          >
            {createLiveJob.isPending ? <Loader2 className="animate-spin" /> : <Activity />}
            {createLiveJob.isPending ? 'در حال اتصال...' : `شروع ${selectedLiveApplications.length} تحلیل با هم`}
          </Button>
        </div>
      </section>}

      {mode === 'recorded' && <form ref={formRef} onSubmit={submit} className="space-y-5 rounded-xl border bg-card p-5 shadow-sm">
        <div>
          <h2 className="text-base font-semibold">تحلیل ویدیوی ضبط‌شده</h2>
          <p className="mt-1 text-xs text-muted-foreground">برای تحلیل آفلاین، فایل ویدیو و برنامه تحلیلی را انتخاب کنید.</p>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="video">فایل ویدیو</Label>
            <Input
              id="video"
              name="video"
              type="file"
              accept="video/*,.mkv,.avi"
              required
              onChange={event => setVideoFile(event.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">MP4، MOV، AVI، MKV، WebM یا M4V؛ حداکثر پیش‌فرض ۱ گیگابایت</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="application">برنامه تحلیلی</Label>
            <select
              id="application"
              value={selectedApplication}
              onChange={event => setSelectedApplication(event.target.value)}
              disabled={!applicationsQuery.data}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {(applicationsQuery.data?.data ?? []).map(application => (
                <option key={application.id} value={application.id}>{application.name}</option>
              ))}
            </select>
            {selected && <p className="text-xs text-muted-foreground">{selected.description}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tracker_type">ردیاب افراد (موقت)</Label>
            <select
              id="tracker_type"
              name="tracker_type"
              value={selectedTracker}
              onChange={event => setSelectedTracker(event.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {trackerOptions.map(tracker => (
                <option key={tracker.type} value={tracker.type}>{tracker.label}</option>
              ))}
            </select>
            {selectedTrackerOption && (
              <p className="text-xs text-muted-foreground">{selectedTrackerOption.description}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="camera_id">شناسه منبع آزمایشی</Label>
            <Input id="camera_id" name="camera_id" defaultValue="uploaded-video" dir="ltr" required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="max_frames">حداکثر فریم برای تست سریع (اختیاری)</Label>
            <Input id="max_frames" name="max_frames" type="number" min={1} placeholder="مثال: 300" dir="ltr" />
          </div>

          {isDrawnRegionApplication(selectedApplication) && (
            <div className={`space-y-3 rounded-lg border p-4 lg:col-span-2 ${DRAWN_REGION_APPLICATIONS[selectedApplication].className}`}>
              <div>
                <Label>{DRAWN_REGION_APPLICATIONS[selectedApplication].title}</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  {DRAWN_REGION_APPLICATIONS[selectedApplication].description}
                </p>
              </div>
              {isExtractingFrame && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> در حال استخراج فریم اول…
                </div>
              )}
              {frameError && <p className="text-sm text-red-600">{frameError}</p>}
              {firstFrame && (
                <PolygonEditor
                  value={drawnRegion}
                  onChange={setDrawnRegion}
                  backgroundUrl={firstFrame.dataUrl}
                  aspectRatio={firstFrame.aspectRatio}
                  allowExclusions={false}
                />
              )}
              {!videoFile && (
                <p className="text-sm text-muted-foreground">برای نمایش فریم اول، یک فایل ویدیو انتخاب کنید.</p>
              )}
            </div>
          )}

          {!isDrawnRegionApplication(selectedApplication) && (
          <div className="space-y-1.5 lg:col-span-2">
            <Label htmlFor="camera_config">
              تنظیمات دوربین YAML {selected?.requires_camera_config ? '(الزامی برای این برنامه)' : '(اختیاری)'}
            </Label>
            <Input
              id="camera_config"
              name="camera_config"
              type="file"
              accept=".yaml,.yml,application/yaml,text/yaml"
              required={selected?.requires_camera_config}
            />
            <p className="text-xs text-muted-foreground">
              برای مناطق محدود، صف پیکربندی‌شده، خطوط شمارش و کالیبراسیون از YAML استفاده می‌شود.
            </p>
          </div>
          )}

          {canEnableReid && (
            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4 lg:col-span-2">
              <label htmlFor="enable_reid" className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-amber-900">
                <input
                  id="enable_reid"
                  name="enable_reid"
                  type="checkbox"
                  value="true"
                  className="size-4 rounded border-amber-400"
                />
                فعال‌سازی بازشناسی ظاهری OSNet (فقط مدیر سازمان)
              </label>
              <p className="text-xs leading-6 text-amber-800">
                پیوستگی شناسه افراد پس از پوشیدگی یا خروج کوتاه از تصویر را بهتر می‌کند، اما برای هر فرد
                پردازش بیشتری انجام می‌دهد و سرعت تحلیل را کاهش می‌دهد. حالت پیش‌فرض خاموش است.
              </p>
            </div>
          )}
        </div>

        {configurationError && <p className="text-sm text-red-600">{configurationError}</p>}
        {createJob.error && <p className="text-sm text-red-600">{createJob.error.message}</p>}

        <div className="flex justify-end">
          <Button type="submit" disabled={createJob.isPending || !applicationsQuery.data}>
            {createJob.isPending ? <Loader2 className="animate-spin" /> : <Upload />}
            {createJob.isPending ? 'در حال بارگذاری...' : 'بارگذاری و شروع تحلیل'}
          </Button>
        </div>
      </form>}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">صف کارهای پردازشی</h2>
          <Button variant="outline" size="sm" onClick={() => jobsQuery.refetch()} disabled={jobsQuery.isFetching}>
            <RefreshCw className={jobsQuery.isFetching ? 'animate-spin' : ''} /> بروزرسانی
          </Button>
        </div>
        {jobsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">در حال دریافت پردازش‌ها...</p>
        ) : visibleJobs.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
            هنوز ویدیویی برای تحلیل ارسال نشده است.
          </div>
        ) : (
          <div className="space-y-4">
            {visibleJobs.map((job, index) => (
              <JobCard
                key={job.id}
                job={job}
                selected={selectedJobId === job.id || (!selectedJobId && index === 0)}
                onSelect={() => setSelectedJobId(job.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function JobCard({
  job,
  selected,
  onSelect,
}: {
  job: AnalyticsJob
  selected: boolean
  onSelect: () => void
}) {
  const queryClient = useQueryClient()
  const { live, history, connected } = useJobLive(job, selected)
  const cancelJob = useMutation({
    mutationFn: () => apiJson(`/api/v1/jobs/${job.id}/cancel`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['video-analytics-jobs'] }),
  })
  const output = job.artifacts.heatmap_video ?? job.artifacts.annotated_video
  const outputLabel = job.artifacts.heatmap_video
    ? 'ویدیوی نقشه حرارتی تراکم'
    : 'ویدیوی خروجی تحلیل'
  const metricTasks = job.enabled_tasks.length > 0
    ? job.enabled_tasks
    : job.application_id === 'configured_queue'
      ? [job.application_id]
      : []
  const applicationLabel = job.enabled_tasks.length > 0
    ? job.enabled_tasks.map(taskId => LIVE_TASKS.find(task => task.id === taskId)?.label ?? taskId).join(' + ')
    : LIVE_TASKS.find(task => task.id === job.application_id)?.label ?? job.application.name
  return (
    <article className={`overflow-hidden rounded-xl border bg-card shadow-sm ${selected ? 'ring-2 ring-primary/30' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4">
        <button type="button" onClick={onSelect} className="flex min-w-0 items-start gap-3 text-start">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <FileVideo className="size-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold" dir="ltr">{job.original_filename}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {applicationLabel} · {job.camera_id}
              {` · ردیاب ${job.live?.metrics?.active_tracker ?? job.tracker_type ?? 'bytetrack'}`}
              {job.enable_reid ? ' · OSNet ReID فعال' : ''}
            </p>
          </div>
        </button>
        <div className="flex items-center gap-2">
          {selected && ['queued', 'running', 'cancelling'].includes(job.status) && (
            <span className={`size-2 rounded-full ${connected ? 'bg-green-500' : 'bg-amber-500'}`} title={connected ? 'SSE connected' : 'Polling fallback'} />
          )}
          <JobStatus status={job.status} />
        </div>
      </div>

      {job.status === 'failed' && (
        <div className="m-4 rounded-lg bg-red-50 p-3 text-xs text-red-700" dir="ltr">{job.error}</div>
      )}

      {selected && ['queued', 'running', 'cancelling'].includes(job.status) && (
        <div className="space-y-4 p-4">
          <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              {job.status === 'queued' ? 'در صف پردازش...' : job.status === 'cancelling' ? 'در حال لغو...' : 'پردازش زنده در حال اجرا است'}
            </span>
            {job.status !== 'cancelling' && (
              <Button variant="outline" size="sm" onClick={() => cancelJob.mutate()} disabled={cancelJob.isPending}>
                <Ban /> لغو
              </Button>
            )}
          </div>
          {typeof live?.progress === 'number' && (
            <div className="space-y-1">
              <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${live.progress}%` }} /></div>
              <p className="text-xs text-muted-foreground" dir="ltr">{live.progress.toFixed(1)}% · frame {(live.frame_index ?? -1) + 1}</p>
            </div>
          )}
          {live?.preview_reference && (
            <div className="aspect-video w-full max-w-4xl overflow-hidden rounded-lg bg-black">
              {/* The persistent MJPEG request keeps the previous decoded frame visible. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="size-full object-contain"
                src={`${API_BASE}/api/v1/jobs/${job.id}/preview-stream`}
                alt="Live processed video stream"
              />
            </div>
          )}
          {metricTasks.length > 0 ? (
            <LiveTaskMetrics tasks={metricTasks} live={live} history={history} />
          ) : (
            <DynamicMetrics schema={job.application.metric_schema} live={live} history={history} phase="live" />
          )}
        </div>
      )}

      {job.status === 'completed' && (
        <div className="space-y-4 p-4">
          {output && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">{outputLabel}</p>
              <video className="aspect-video w-full max-w-3xl rounded-lg bg-black object-contain" controls preload="metadata" src={artifactUrl(output)} />
            </div>
          )}

          {metricTasks.length > 0 ? (
            <LiveTaskMetrics tasks={metricTasks} live={live ?? job.live} history={history} />
          ) : (
            <DynamicMetrics schema={job.application.metric_schema} live={live ?? job.live} history={history} phase="final" />
          )}

          <div className="flex flex-wrap gap-2">
            {Object.entries(job.artifacts)
              .filter(([, artifact]) => artifact.url !== output?.url)
              .map(([key, artifact]) => (
                <a
                  key={key}
                  href={artifactUrl(artifact)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  <Download className="size-3.5" /> {artifact.filename}
                </a>
              ))}
          </div>
        </div>
      )}
      {job.status === 'cancelled' && (
        <div className="p-5 text-sm text-muted-foreground">این کار پردازشی لغو شد. رویدادها و خروجی‌های جزئی برای بررسی نگهداری شده‌اند.</div>
      )}
    </article>
  )
}

function useJobLive(job: AnalyticsJob, enabled: boolean) {
  const queryClient = useQueryClient()
  const [live, setLive] = useState<LiveEvent | null>(job.live)
  const [history, setHistory] = useState<Record<string, number[]>>({})
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!job.live) return
    setLive(previous => ({
      ...job.live!,
      metrics: { ...(previous?.metrics ?? {}), ...job.live!.metrics },
      preview_reference: job.live!.preview_reference ?? previous?.preview_reference ?? null,
    }))
  }, [job.live])
  useEffect(() => {
    if (!enabled || !['queued', 'running', 'cancelling'].includes(job.status)) return
    const source = new EventSource(`${API_BASE}/api/v1/jobs/${job.id}/events`)
    const receive = (raw: Event) => {
      const message = raw as MessageEvent<string>
      try {
        const next = JSON.parse(message.data) as LiveEvent
        setLive(previous => ({
          ...next,
          metrics: { ...(previous?.metrics ?? {}), ...next.metrics },
          preview_reference: next.preview_reference ?? previous?.preview_reference ?? null,
        }))
        setHistory(previous => appendHistory(previous, next.metrics))
        if (['job_completed', 'job_failed', 'job_cancelled'].includes(next.type)) {
          source.close()
          queryClient.invalidateQueries({ queryKey: ['video-analytics-jobs'] })
        }
      } catch {}
    }
    const eventTypes = ['job_started', 'preview_updated', 'metrics_updated', 'progress_updated', 'warning', 'job_completed', 'job_failed', 'job_cancelled']
    eventTypes.forEach(type => source.addEventListener(type, receive))
    source.onopen = () => setConnected(true)
    source.onerror = () => setConnected(false)
    return () => source.close()
  }, [enabled, job.id, job.status, queryClient])
  return { live, history, connected }
}

function appendHistory(previous: Record<string, number[]>, metrics: Record<string, unknown>) {
  const next = { ...previous }
  Object.entries(metrics).forEach(([key, value]) => {
    if (typeof value === 'number' && Number.isFinite(value)) next[key] = [...(next[key] ?? []), value].slice(-60)
  })
  return next
}

const IMPORTANT_LIVE_METRICS: Record<LiveTaskId, MetricDefinition[]> = {
  people_counting: [
    { key: 'current_people', label: 'افراد حاضر', value_type: 'integer', unit: 'نفر', aggregation: 'current', display: 'counter', availability: 'both' },
  ],
  heatmap: [
    { key: 'top_crowded_regions', label: 'پرتراکم‌ترین بخش‌ها', value_type: 'table', unit: null, aggregation: 'current', display: 'table', availability: 'both' },
  ],
  vertical_queue: [
    { key: 'queue_length', label: 'طول صف', value_type: 'integer', unit: 'نفر', aggregation: 'current', display: 'chart', availability: 'both' },
    { key: 'queue_wait_seconds', label: 'زمان انتظار تقریبی', value_type: 'number', unit: 'ثانیه', aggregation: 'average', display: 'chart', availability: 'both' },
    { key: 'queue_speed', label: 'سرعت حرکت صف', value_type: 'number', unit: 'px/s', aggregation: 'average', display: 'chart', availability: 'both' },
  ],
  configured_queue: [
    { key: 'queue_length', label: 'افراد داخل صف', value_type: 'integer', unit: 'نفر', aggregation: 'current', display: 'chart', availability: 'both' },
    { key: 'queue_wait_seconds', label: 'زمان انتظار تقریبی', value_type: 'number', unit: 'ثانیه', aggregation: 'average', display: 'chart', availability: 'both' },
    { key: 'queue_speed', label: 'میانگین سرعت افراد صف', value_type: 'number', unit: 'px/s', aggregation: 'average', display: 'chart', availability: 'both' },
    { key: 'queue_details', label: 'جزئیات هر خط صف', value_type: 'table', unit: null, aggregation: 'current', display: 'table', availability: 'both' },
  ],
  restricted_area: [
    { key: 'restricted_occupancy', label: 'افراد داخل محدوده', value_type: 'integer', unit: 'نفر', aggregation: 'current', display: 'status', availability: 'both' },
    { key: 'restricted_entries', label: 'ورود به محدوده', value_type: 'integer', unit: 'نفر', aggregation: 'total', display: 'counter', availability: 'both' },
    { key: 'restricted_exits', label: 'خروج از محدوده', value_type: 'integer', unit: 'نفر', aggregation: 'total', display: 'counter', availability: 'both' },
    { key: 'restricted_violations', label: 'هشدارهای تأییدشده', value_type: 'integer', unit: null, aggregation: 'total', display: 'counter', availability: 'both' },
  ],
}

function LiveTaskMetrics({
  tasks,
  live,
  history,
}: {
  tasks: string[]
  live: LiveEvent | null
  history: Record<string, number[]>
}) {
  if (!live) return null
  const metrics: Record<string, unknown> = { ...live.metrics }
  return (
    <div className="space-y-4">
      {LIVE_TASKS.filter(task => tasks.includes(task.id)).map(task => {
        const definitions = IMPORTANT_LIVE_METRICS[task.id]
        const hasValue = definitions.some(definition => metrics[definition.key] !== undefined && metrics[definition.key] !== null)
        if (!hasValue) return null
        return (
          <section key={task.id} className="rounded-xl border bg-muted/10 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">{task.label}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{task.description}</p>
              </div>
              <span className="rounded-full bg-green-100 px-2 py-1 text-[10px] font-semibold text-green-700">
                فعال
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {definitions.map(definition => (
                <MetricWidget
                  key={definition.key}
                  definition={definition}
                  value={metrics[definition.key]}
                  history={history[definition.key] ?? []}
                />
              ))}
            </div>
          </section>
        )
      })}
      <div className="flex flex-wrap gap-4 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground" dir="ltr">
        <span>Frames: {formatDisplayValue(live.metrics.frame_count)}</span>
        <span>FPS: {formatDisplayValue(live.metrics.processing_fps)}</span>
        <span>Elapsed: {formatDisplayValue(live.elapsed_seconds)}s</span>
      </div>
    </div>
  )
}

function DynamicMetrics({
  schema,
  live,
  history,
  phase,
}: {
  schema: MetricDefinition[]
  live: LiveEvent | null
  history: Record<string, number[]>
  phase: 'live' | 'final'
}) {
  if (!live) return null
  const metrics: Record<string, unknown> = { ...live.metrics, progress: live.progress, elapsed_seconds: live.elapsed_seconds }
  const visible = schema.filter(item => item.availability === 'both' || item.availability === phase)
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {visible.map(definition => (
        <MetricWidget key={definition.key} definition={definition} value={metrics[definition.key]} history={history[definition.key] ?? []} />
      ))}
    </div>
  )
}

function MetricWidget({ definition, value, history }: { definition: MetricDefinition; value: unknown; history: number[] }) {
  if (value === undefined || value === null) return null
  if (definition.key === 'top_crowded_regions') {
    return <CrowdedRegionsWidget label={definition.label} value={value} />
  }
  if (definition.key === 'queue_details') {
    return <QueueDetailsWidget label={definition.label} value={value} />
  }
  if (definition.display === 'table' && typeof value === 'object' && !Array.isArray(value)) {
    return (
      <div className="rounded-lg border bg-muted/20 p-3 sm:col-span-2">
        <p className="text-xs text-muted-foreground">{definition.label}</p>
        <div className="mt-2 grid grid-cols-2 gap-1 text-xs" dir="ltr">
          {Object.entries(value as Record<string, unknown>).map(([key, item]) => <div key={key} className="flex justify-between rounded bg-background px-2 py-1"><span>{key}</span><strong>{String(item)}</strong></div>)}
        </div>
      </div>
    )
  }
  return (
    <div className={`rounded-lg border p-3 ${definition.display === 'status' ? 'border-blue-200 bg-blue-50' : 'bg-muted/20'}`}>
      <p className="text-xs text-muted-foreground">{definition.label}</p>
      <p className="mt-1 text-lg font-semibold" dir="ltr">{formatDisplayValue(value)}{definition.unit ? ` ${definition.unit}` : ''}</p>
      {definition.display === 'chart' && history.length > 1 && <Sparkline values={history} />}
    </div>
  )
}

function QueueDetailsWidget({ label, value }: { label: string; value: unknown }) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const queues = Object.entries(value as Record<string, unknown>)
  if (queues.length === 0) return null
  return (
    <div className="rounded-lg border bg-muted/20 p-3 sm:col-span-2 lg:col-span-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2" dir="ltr">
        {queues.map(([queueId, raw]) => {
          const details = raw && typeof raw === 'object' && !Array.isArray(raw)
            ? raw as Record<string, unknown>
            : {}
          return (
            <div key={queueId} className="rounded border bg-background px-3 py-2 text-xs">
              <p className="font-semibold">{queueId}</p>
              <p className="mt-1 text-muted-foreground">
                {formatDisplayValue(details.people)} people · {formatDisplayValue(details.average_speed_pixels_per_second)} px/s
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CrowdedRegionsWidget({ label, value }: { label: string; value: unknown }) {
  const regions = parseCrowdedRegions(value)
  if (regions.length === 0) return null
  const ranks = new Map(regions.map((region, index) => [region.region_id, index + 1]))
  return (
    <div className="rounded-lg border bg-muted/20 p-4 sm:col-span-2 lg:col-span-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            شماره ناحیه‌ها با برچسب‌های روی ویدیوی نقشه حرارتی یکسان است.
          </p>
        </div>
        <div className="flex gap-2 text-[11px]" dir="ltr">
          <span className="rounded bg-red-500 px-2 py-1 font-semibold text-white">TOP 1</span>
          <span className="rounded bg-orange-500 px-2 py-1 font-semibold text-white">TOP 2</span>
          <span className="rounded bg-yellow-400 px-2 py-1 font-semibold text-slate-950">TOP 3</span>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(280px,1.25fr)_minmax(260px,1fr)]">
        <div className="grid grid-cols-4 overflow-hidden rounded-lg border-2 border-slate-300 bg-slate-950" dir="ltr">
          {Array.from({ length: 12 }, (_, index) => {
            const regionId = index + 1
            const rank = ranks.get(regionId)
            return (
              <div
                key={regionId}
                className={`relative flex aspect-[4/3] items-center justify-center border border-white/50 text-sm font-bold ${crowdedRegionCellClass(rank)}`}
                title={`Region ${regionId}${rank ? ` · Top ${rank}` : ''}`}
              >
                R{regionId}
                {rank && (
                  <span className="absolute end-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
                    #{rank}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        <div className="space-y-2" dir="ltr">
          {regions.map((region, index) => (
            <div key={region.region_id} className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2">
              <div className="flex items-center gap-3">
                <span className={`flex size-8 items-center justify-center rounded-md text-sm font-bold ${crowdedRegionBadgeClass(index + 1)}`}>
                  #{index + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold">Region {region.region_id}</p>
                  <p className="text-xs text-muted-foreground">Row {region.row}, column {region.column}</p>
                </div>
              </div>
              <div className="text-end">
                <p className="text-base font-bold">{region.average_occupancy.toFixed(2)}</p>
                <p className="text-[11px] text-muted-foreground">average occupancy</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function parseCrowdedRegions(value: unknown): CrowdedRegionMetric[] {
  if (!Array.isArray(value)) return []
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return []
    const record = item as Record<string, unknown>
    const bounds = record.normalized_bounds
    if (
      typeof record.region_id !== 'number' ||
      typeof record.row !== 'number' ||
      typeof record.column !== 'number' ||
      typeof record.average_occupancy !== 'number' ||
      !Array.isArray(bounds) ||
      bounds.length !== 4 ||
      !bounds.every(bound => typeof bound === 'number')
    ) return []
    return [{
      region_id: record.region_id,
      row: record.row,
      column: record.column,
      normalized_bounds: bounds as [number, number, number, number],
      average_occupancy: record.average_occupancy,
    }]
  }).slice(0, 3)
}

function crowdedRegionCellClass(rank: number | undefined) {
  if (rank === 1) return 'bg-red-500/80 text-white ring-4 ring-inset ring-red-200'
  if (rank === 2) return 'bg-orange-500/80 text-white ring-4 ring-inset ring-orange-200'
  if (rank === 3) return 'bg-yellow-400/85 text-slate-950 ring-4 ring-inset ring-yellow-100'
  return 'bg-slate-800/80 text-white/80'
}

function crowdedRegionBadgeClass(rank: number) {
  if (rank === 1) return 'bg-red-500 text-white'
  if (rank === 2) return 'bg-orange-500 text-white'
  return 'bg-yellow-400 text-slate-950'
}

function Sparkline({ values }: { values: number[] }) {
  const minimum = Math.min(...values)
  const range = Math.max(...values) - minimum || 1
  const points = values.map((value, index) => `${(index * 100) / (values.length - 1)},${30 - ((value - minimum) * 28) / range}`).join(' ')
  return <svg viewBox="0 0 100 32" className="mt-2 h-8 w-full" preserveAspectRatio="none"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg>
}

function formatDisplayValue(value: unknown) {
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2)
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

function JobStatus({ status }: { status: AnalyticsJob['status'] }) {
  const config = {
    queued: { label: 'در صف', icon: Clock3, className: 'bg-amber-100 text-amber-700' },
    running: { label: 'در حال پردازش', icon: Activity, className: 'bg-blue-100 text-blue-700' },
    cancelling: { label: 'در حال لغو', icon: Loader2, className: 'bg-amber-100 text-amber-700' },
    completed: { label: 'تکمیل شد', icon: CheckCircle2, className: 'bg-green-100 text-green-700' },
    failed: { label: 'ناموفق', icon: XCircle, className: 'bg-red-100 text-red-700' },
    cancelled: { label: 'لغو شد', icon: Ban, className: 'bg-slate-100 text-slate-700' },
  }[status]
  const Icon = config.icon
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${config.className}`}>
      <Icon className="size-3.5" /> {config.label}
    </span>
  )
}
