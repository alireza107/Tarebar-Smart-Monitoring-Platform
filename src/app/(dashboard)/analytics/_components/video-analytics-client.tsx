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
  error: string | null
  summary: Record<string, unknown> | null
  artifacts: Record<string, Artifact>
  live: LiveEvent | null
  preview_url: string | null
}

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

export function VideoAnalyticsClient({ canEnableReid }: { canEnableReid: boolean }) {
  const queryClient = useQueryClient()
  const formRef = useRef<HTMLFormElement>(null)
  const [selectedApplication, setSelectedApplication] = useState('people_counting')
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)

  const applicationsQuery = useQuery<{ data: Application[] }>({
    queryKey: ['video-analytics-applications'],
    queryFn: () => apiJson('/api/v1/applications'),
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

  const createJob = useMutation({
    mutationFn: (formData: FormData) =>
      apiJson<{ data: AnalyticsJob }>('/api/v1/jobs', { method: 'POST', body: formData }),
    onSuccess: response => {
      formRef.current?.reset()
      setSelectedApplication('people_counting')
      queryClient.invalidateQueries({ queryKey: ['video-analytics-jobs'] })
      setSelectedJobId(response.data.id)
    },
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    data.set('application_id', selectedApplication)
    if (!data.get('max_frames')) data.delete('max_frames')
    createJob.mutate(data)
  }

  const serviceError = applicationsQuery.error ?? jobsQuery.error

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">تحلیل ویدیوی ضبط‌شده</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ویدیو را بارگذاری کنید و یکی از برنامه‌های موجود در video_analytics_mvp را اجرا کنید.
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

      <form ref={formRef} onSubmit={submit} className="space-y-5 rounded-xl border bg-card p-5 shadow-sm">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="video">فایل ویدیو</Label>
            <Input id="video" name="video" type="file" accept="video/*,.mkv,.avi" required />
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
            {(selectedApplication === 'configured_queue' || selectedApplication === 'full_analytics') && (
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs leading-6 text-blue-800">
                <p className="font-semibold">صف افراد تشخیص‌داده‌شده چیست؟</p>
                <p>
                  این تحلیل افراد داخل محدوده صف ویدیو را دنبال می‌کند و با صف کارهای پردازشی
                  بارگذاری‌ها متفاوت است. طول صف،
                  زمان انتظار تقریبی، عبور از ظرفیت مجاز و میزان حرکت به‌سمت نقطه خدمت را گزارش می‌دهد.
                  برای اجرا باید چندضلعی صف، ظرفیت و نقطه خدمت در YAML دوربین تعریف شده باشد.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="camera_id">شناسه منبع آزمایشی</Label>
            <Input id="camera_id" name="camera_id" defaultValue="uploaded-video" dir="ltr" required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="max_frames">حداکثر فریم برای تست سریع (اختیاری)</Label>
            <Input id="max_frames" name="max_frames" type="number" min={1} placeholder="مثال: 300" dir="ltr" />
            {selectedApplication === 'detection' && (
              <p className="text-xs text-amber-600">در حالت تشخیص ساده، محدودیت فریم اعمال نمی‌شود.</p>
            )}
          </div>

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

          {canEnableReid && selectedApplication !== 'detection' && (
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

        {createJob.error && <p className="text-sm text-red-600">{createJob.error.message}</p>}

        <div className="flex justify-end">
          <Button type="submit" disabled={createJob.isPending || !applicationsQuery.data}>
            {createJob.isPending ? <Loader2 className="animate-spin" /> : <Upload />}
            {createJob.isPending ? 'در حال بارگذاری...' : 'بارگذاری و شروع تحلیل'}
          </Button>
        </div>
      </form>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">صف کارهای پردازشی</h2>
          <Button variant="outline" size="sm" onClick={() => jobsQuery.refetch()} disabled={jobsQuery.isFetching}>
            <RefreshCw className={jobsQuery.isFetching ? 'animate-spin' : ''} /> بروزرسانی
          </Button>
        </div>
        {jobsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">در حال دریافت پردازش‌ها...</p>
        ) : (jobsQuery.data?.data.length ?? 0) === 0 ? (
          <div className="rounded-xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
            هنوز ویدیویی برای تحلیل ارسال نشده است.
          </div>
        ) : (
          <div className="space-y-4">
            {jobsQuery.data?.data.map((job, index) => (
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
              {job.application.name} · {job.camera_id}
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
          <DynamicMetrics schema={job.application.metric_schema} live={live} history={history} phase="live" />
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

          <DynamicMetrics schema={job.application.metric_schema} live={live ?? job.live} history={history} phase="final" />

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
