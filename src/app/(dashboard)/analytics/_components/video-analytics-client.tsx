'use client'

import { FormEvent, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  AlertCircle,
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
  status: 'queued' | 'running' | 'completed' | 'failed'
  created_at: string
  updated_at: string
  max_frames: number | null
  error: string | null
  summary: Record<string, unknown> | null
  artifacts: Record<string, Artifact>
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

export function VideoAnalyticsClient() {
  const queryClient = useQueryClient()
  const formRef = useRef<HTMLFormElement>(null)
  const [selectedApplication, setSelectedApplication] = useState('people_counting')

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
      return jobs.some(job => job.status === 'queued' || job.status === 'running') ? 2_000 : 10_000
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
    onSuccess: () => {
      formRef.current?.reset()
      setSelectedApplication('people_counting')
      queryClient.invalidateQueries({ queryKey: ['video-analytics-jobs'] })
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
          <h2 className="text-base font-semibold">پردازش‌ها</h2>
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
            {jobsQuery.data?.data.map(job => <JobCard key={job.id} job={job} />)}
          </div>
        )}
      </section>
    </div>
  )
}

function JobCard({ job }: { job: AnalyticsJob }) {
  const output = job.artifacts.annotated_video
  const summaryItems = job.summary
    ? [
        ['فریم پردازش‌شده', job.summary.frames],
        ['بیشترین افراد', job.summary.maximum_confirmed_humans],
        ['بیشترین اشغال منطقه', job.summary.maximum_total_zone_occupancy],
      ].filter(([, value]) => value !== undefined && value !== null)
    : []

  return (
    <article className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <FileVideo className="size-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold" dir="ltr">{job.original_filename}</p>
            <p className="mt-1 text-xs text-muted-foreground">{job.application.name} · {job.camera_id}</p>
          </div>
        </div>
        <JobStatus status={job.status} />
      </div>

      {job.status === 'failed' && (
        <div className="m-4 rounded-lg bg-red-50 p-3 text-xs text-red-700" dir="ltr">{job.error}</div>
      )}

      {(job.status === 'queued' || job.status === 'running') && (
        <div className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {job.status === 'queued' ? 'در صف پردازش...' : 'مدل در حال پردازش ویدیو است...'}
        </div>
      )}

      {job.status === 'completed' && (
        <div className="space-y-4 p-4">
          {output && (
            <video className="aspect-video w-full max-w-3xl rounded-lg bg-black object-contain" controls preload="metadata" src={artifactUrl(output)} />
          )}

          {summaryItems.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-3">
              {summaryItems.map(([label, value]) => (
                <div key={String(label)} className="rounded-lg bg-muted/50 px-3 py-2">
                  <p className="text-xs text-muted-foreground">{String(label)}</p>
                  <p className="mt-0.5 font-semibold" dir="ltr">{String(value)}</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {Object.entries(job.artifacts)
              .filter(([key]) => key !== 'annotated_video')
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
    </article>
  )
}

function JobStatus({ status }: { status: AnalyticsJob['status'] }) {
  const config = {
    queued: { label: 'در صف', icon: Clock3, className: 'bg-amber-100 text-amber-700' },
    running: { label: 'در حال پردازش', icon: Activity, className: 'bg-blue-100 text-blue-700' },
    completed: { label: 'تکمیل شد', icon: CheckCircle2, className: 'bg-green-100 text-green-700' },
    failed: { label: 'ناموفق', icon: XCircle, className: 'bg-red-100 text-red-700' },
  }[status]
  const Icon = config.icon
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${config.className}`}>
      <Icon className="size-3.5" /> {config.label}
    </span>
  )
}
