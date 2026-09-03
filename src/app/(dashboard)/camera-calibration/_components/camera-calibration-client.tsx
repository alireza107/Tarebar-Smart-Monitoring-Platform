'use client'

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Loader2, Radio, Upload, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fruitApiJson } from '@/lib/fruit-api'
import { derivePlaybackUrls } from '@/modules/camera/stream'
import type { Camera } from '@/modules/camera/types'
import { CameraStreamPlayer } from '@/app/(dashboard)/monitoring/_components/camera-stream-player'

type CalibrationJob = {
  id: string
  status: 'queued' | 'capturing' | 'running' | 'completed' | 'failed'
  error?: string | null
  capture_seconds?: number
  captured_frames?: number
  calibration_path?: string
  calibration?: {
    resolution: [number, number]
    reprojection_error: number
    camera_matrix: number[][]
    distortion_coefficients: number[]
  }
}

type CalibrationRecord = {
  id: string
  cameraId: string
  cameraGroup: string | null
  boardType: string
  resolutionWidth: number
  resolutionHeight: number
  reprojectionError: number
  createdAt: string
  camera: { id: string; name: string }
}

async function appJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init)
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(typeof body?.error === 'string' ? body.error : 'خطا در ذخیره کالیبراسیون')
  return body as T
}

function recordingMimeType(): string | undefined {
  const candidates = [
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ]
  return candidates.find(candidate => MediaRecorder.isTypeSupported(candidate))
}

function recordStream(stream: MediaStream, seconds: number): Promise<{ blob: Blob; extension: string }> {
  return new Promise((resolve, reject) => {
    const mimeType = recordingMimeType()
    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    } catch (error) {
      reject(error)
      return
    }

    const chunks: Blob[] = []
    const timer = window.setTimeout(() => {
      if (recorder.state !== 'inactive') recorder.stop()
    }, seconds * 1000)
    recorder.ondataavailable = event => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    recorder.onerror = () => {
      window.clearTimeout(timer)
      reject(new Error('ضبط ویدیوی WebRTC ناموفق بود'))
    }
    recorder.onstop = () => {
      window.clearTimeout(timer)
      const type = recorder.mimeType || mimeType || 'video/webm'
      const blob = new Blob(chunks, { type })
      if (!blob.size) {
        reject(new Error('ویدیوی ضبط‌شده خالی است'))
        return
      }
      resolve({ blob, extension: type.includes('mp4') ? 'mp4' : 'webm' })
    }
    recorder.start(1000)
  })
}

function calibrationErrorMessage(error: string | null | undefined): string {
  if (!error) return 'کالیبراسیون ناموفق بود. لطفاً دوباره تلاش کنید.'
  const reprojectionError = error.match(
    /Calibration reprojection error\s+([\d.]+)px exceeds limit\s+([\d.]+)px/i,
  )
  if (reprojectionError) {
    return `خطای کالیبراسیون زیاد است (${reprojectionError[1]} پیکسل؛ حد مجاز ${reprojectionError[2]} پیکسل). لطفاً ویدیو را دوباره ضبط کنید و صفحه را واضح و از زاویه‌های مختلف نشان دهید.`
  }
  return error
}

export function CameraCalibrationClient() {
  const queryClient = useQueryClient()
  const formRef = useRef<HTMLFormElement>(null)
  const persistedJob = useRef<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [cameraId, setCameraId] = useState('')
  const [sourceMode, setSourceMode] = useState<'upload' | 'live'>('upload')
  const [webRtcStream, setWebRtcStream] = useState<MediaStream | null>(null)
  const [recording, setRecording] = useState(false)
  const [recordingSecondsLeft, setRecordingSecondsLeft] = useState(0)
  const [recordingError, setRecordingError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState({
    cameraId: '', cameraGroup: '', boardType: 'charuco', columns: 11, rows: 8,
    squareSizeMm: 20, markerSizeMm: 15, dictionary: 'DICT_5X5_50', maxError: 2.5,
  })
  useEffect(() => {
    const pending = window.localStorage.getItem('pending-camera-calibration')
    if (!pending) return
    try {
      const value = JSON.parse(pending) as { jobId: string; submitted: typeof submitted }
      setJobId(value.jobId)
      setSubmitted(value.submitted)
    } catch {
      window.localStorage.removeItem('pending-camera-calibration')
    }
  }, [])

  const cameras = useQuery<{ data: Camera[] }>({
    queryKey: ['cameras'],
    queryFn: () => appJson('/api/cameras'),
  })
  const calibrations = useQuery<{ data: CalibrationRecord[] }>({
    queryKey: ['camera-calibrations'],
    queryFn: () => appJson('/api/camera-calibrations'),
  })
  useEffect(() => {
    if (!cameraId && cameras.data?.data[0]) setCameraId(cameras.data.data[0].id)
  }, [cameraId, cameras.data])

  const start = useMutation({
    mutationFn: (data: FormData) => fruitApiJson<{ data: CalibrationJob }>('/api/v1/calibrations', {
      method: 'POST', body: data,
    }),
    onSuccess: response => {
      persistedJob.current = null
      setJobId(response.data.id)
    },
  })
  const job = useQuery<{ data: CalibrationJob }>({
    queryKey: ['fruit-calibration-job', jobId],
    queryFn: () => fruitApiJson(`/api/v1/jobs/${jobId}`),
    enabled: Boolean(jobId),
    refetchInterval: query => ['queued', 'capturing', 'running'].includes(query.state.data?.data.status ?? '') ? 1500 : false,
  })
  const persist = useMutation({
    mutationFn: (record: Record<string, unknown>) => appJson('/api/camera-calibrations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record),
    }),
    onSuccess: () => {
      window.localStorage.removeItem('pending-camera-calibration')
      queryClient.invalidateQueries({ queryKey: ['camera-calibrations'] })
    },
  })

  useEffect(() => {
    const completed = job.data?.data
    if (!completed?.calibration || !completed.calibration_path || completed.status !== 'completed') return
    if (persistedJob.current === completed.id) return
    persistedJob.current = completed.id
    persist.mutate({
      cameraId: submitted.cameraId,
      serviceJobId: completed.id,
      cameraGroup: submitted.cameraGroup || null,
      boardType: submitted.boardType,
      columns: submitted.columns,
      rows: submitted.rows,
      squareSizeMm: submitted.squareSizeMm,
      markerSizeMm: submitted.boardType === 'charuco' ? submitted.markerSizeMm : null,
      dictionary: submitted.boardType === 'charuco' ? submitted.dictionary : null,
      resolutionWidth: completed.calibration.resolution[0],
      resolutionHeight: completed.calibration.resolution[1],
      reprojectionError: completed.calibration.reprojection_error,
      maxReprojectionError: submitted.maxError,
      calibrationPath: completed.calibration_path,
      parameters: completed.calibration,
    })
  }, [job.data, persist, submitted])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const values = {
      cameraId,
      cameraGroup: String(data.get('camera_group') ?? ''),
      boardType: String(data.get('board') ?? 'charuco'),
      columns: Number(data.get('columns')),
      rows: Number(data.get('rows')),
      squareSizeMm: Number(data.get('square_size_mm')),
      markerSizeMm: Number(data.get('marker_size_mm')),
      dictionary: String(data.get('dictionary')),
      maxError: Number(data.get('max_reprojection_error')),
    }
    setSubmitted(values)
    data.set('camera_id', cameraId)
    setRecordingError(null)

    if (sourceMode === 'live') {
      if (!webRtcStream?.getVideoTracks().some(track => track.readyState === 'live')) {
        setRecordingError('اتصال WebRTC هنوز آماده نیست؛ پس از نمایش تصویر دوباره تلاش کنید.')
        return
      }
      if (typeof MediaRecorder === 'undefined') {
        setRecordingError('این مرورگر از ضبط WebRTC پشتیبانی نمی‌کند.')
        return
      }
      const captureSeconds = Number(data.get('capture_seconds'))
      setRecording(true)
      setRecordingSecondsLeft(captureSeconds)
      const countdown = window.setInterval(() => {
        setRecordingSecondsLeft(value => Math.max(0, value - 1))
      }, 1000)
      try {
        const capture = await recordStream(webRtcStream, captureSeconds)
        data.set('files', capture.blob, `calibration-${cameraId}.${capture.extension}`)
      } catch (error) {
        setRecordingError(error instanceof Error ? error.message : 'ضبط ویدیوی WebRTC ناموفق بود')
        return
      } finally {
        window.clearInterval(countdown)
        setRecording(false)
        setRecordingSecondsLeft(0)
      }
    }

    start.mutate(data, {
      onSuccess: response => window.localStorage.setItem('pending-camera-calibration', JSON.stringify({
        jobId: response.data.id,
        submitted: values,
      })),
    })
  }

  const onMediaStreamChange = useCallback((stream: MediaStream | null) => {
    setWebRtcStream(stream)
  }, [])

  useEffect(() => {
    setWebRtcStream(null)
    setRecordingError(null)
  }, [cameraId, sourceMode])

  const selectedCamera = cameras.data?.data.find(camera => camera.id === cameraId)
  const playbackUrls = useMemo(
    () => derivePlaybackUrls(selectedCamera?.streamUrl),
    [selectedCamera?.streamUrl],
  )

  const currentJob = job.data?.data
  const busy = recording || start.isPending || ['queued', 'capturing', 'running'].includes(currentJob?.status ?? '')

  return <div className="space-y-6">
    <div>
      <h1 className="text-xl font-bold">کالیبراسیون دوربین</h1>
      <p className="mt-1 text-sm text-muted-foreground">رسانه کالیبراسیون را بارگذاری کنید یا هنگام حرکت دادن صفحه، مستقیماً از استریم دوربین ضبط کنید.</p>
    </div>

    <form ref={formRef} onSubmit={submit} className="space-y-5 rounded-xl border bg-card p-5 shadow-sm">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">روش دریافت کالیبراسیون</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${sourceMode === 'upload' ? 'border-primary bg-primary/5' : ''}`}>
            <input type="radio" name="source_mode" value="upload" checked={sourceMode === 'upload'} onChange={() => setSourceMode('upload')} className="mt-1" />
            <span><span className="flex items-center gap-2 text-sm font-medium"><Upload className="size-4" />بارگذاری فایل</span><span className="mt-1 block text-xs text-muted-foreground">تصاویر یا ویدیوی از قبل ضبط‌شده</span></span>
          </label>
          <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${sourceMode === 'live' ? 'border-primary bg-primary/5' : ''}`}>
            <input type="radio" name="source_mode" value="live" checked={sourceMode === 'live'} onChange={() => setSourceMode('live')} className="mt-1" />
            <span><span className="flex items-center gap-2 text-sm font-medium"><Radio className="size-4" />ضبط از استریم زنده</span><span className="mt-1 block text-xs text-muted-foreground">ضبط مستقیم دوربین هنگام حرکت صفحه</span></span>
          </label>
        </div>
      </fieldset>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="camera">دوربین</Label>
          <select id="camera" value={cameraId} onChange={event => setCameraId(event.target.value)} required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            {(cameras.data?.data ?? []).map(camera => <option key={camera.id} value={camera.id}>{camera.name}</option>)}
          </select>
          {!cameras.isLoading && !cameras.data?.data.length && <p className="text-xs text-amber-700">ابتدا در <Link href="/cameras" className="underline">بخش دوربین‌ها</Link> یک دوربین بسازید.</p>}
        </div>
        <Field label="گروه/مدل دوربین (اختیاری)" name="camera_group" placeholder="camera_model_A" />
        <div className="space-y-1.5">
          <Label htmlFor="board">نوع صفحه</Label>
          <select id="board" name="board" defaultValue="charuco" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="charuco">ChArUco</option><option value="checkerboard">Checkerboard</option>
          </select>
        </div>
        <Field label="تعداد ستون" name="columns" type="number" defaultValue="11" min="2" />
        <Field label="تعداد ردیف" name="rows" type="number" defaultValue="8" min="2" />
        <Field label="اندازه مربع (میلی‌متر)" name="square_size_mm" type="number" defaultValue="20" min="0.1" step="0.1" />
        <Field label="اندازه مارکر (میلی‌متر)" name="marker_size_mm" type="number" defaultValue="15" min="0.1" step="0.1" />
        <Field label="دیکشنری ArUco" name="dictionary" defaultValue="DICT_5X5_50" dir="ltr" />
        <Field label="حداکثر خطای بازفرافکنی (px)" name="max_reprojection_error" type="number" defaultValue="2.5" min="0.1" step="0.1" />
        <Field label="فاصله نمونه‌برداری فریم" name="frame_step" type="number" defaultValue="10" min="1" />
        <Field label="حداقل فریم معتبر" name="min_frames" type="number" defaultValue="8" min="3" />
        {sourceMode === 'upload' ? <div className="space-y-1.5 md:col-span-2 lg:col-span-3">
          <Label htmlFor="files">تصاویر یا ویدیوی کالیبراسیون</Label>
          <Input id="files" name="files" type="file" accept="image/*,video/*,.mov,.mkv,.avi" multiple required />
          <p className="text-xs text-muted-foreground">برای تصاویر چند فایل انتخاب کنید؛ برای ویدیو فریم‌ها به‌صورت خودکار نمونه‌برداری می‌شوند.</p>
        </div> : <>
          <Field label="مدت ضبط (ثانیه)" name="capture_seconds" type="number" defaultValue="30" min="5" max="120" />
          <div className="space-y-2 md:col-span-2 lg:col-span-3">
            <Label>پیش‌نمایش زنده</Label>
            {playbackUrls ? <div className="overflow-hidden rounded-lg border bg-black">
              <CameraStreamPlayer
                key={cameraId}
                whepSrc={playbackUrls.whep}
                hlsSrc={playbackUrls.hls}
                onMediaStreamChange={onMediaStreamChange}
              />
            </div> : <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">برای دوربین انتخاب‌شده آدرس استریم تنظیم نشده است. دوربین دیگری انتخاب کنید یا از بارگذاری فایل استفاده کنید.</p>}
            <p className="text-xs text-muted-foreground">پیش‌نمایش و ضبط با WebRTC انجام می‌شود. پس از شروع ضبط، صفحه را آرام حرکت دهید و زاویه‌ها و بخش‌های مختلف تصویر را پوشش دهید.</p>
            {recording && <p className="text-sm font-medium text-red-600">در حال ضبط WebRTC… {recordingSecondsLeft} ثانیه باقی مانده</p>}
          </div>
        </>}
      </div>
      {(recordingError || start.error || job.error || persist.error) && <p className="text-sm text-red-600">{recordingError ?? (start.error ?? job.error ?? persist.error)?.message}</p>}
      {currentJob && <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${currentJob.status === 'failed' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
        {['queued', 'capturing', 'running'].includes(currentJob.status) ? <Loader2 className="size-4 animate-spin" /> : currentJob.status === 'completed' ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
        <span>{currentJob.status === 'completed' ? `کالیبراسیون با خطای ${currentJob.calibration?.reprojection_error.toFixed(3)} پیکسل ذخیره شد.` : currentJob.status === 'failed' ? calibrationErrorMessage(currentJob.error) : currentJob.status === 'capturing' ? `در حال ضبط ${currentJob.capture_seconds ?? ''} ثانیه از استریم؛ صفحه را آرام در تصویر حرکت دهید…` : 'در حال تشخیص صفحه و محاسبه پارامترهای دوربین…'}</span>
      </div>}
      <Button type="submit" disabled={busy || !cameraId || (sourceMode === 'live' && (!playbackUrls || !webRtcStream))}>{sourceMode === 'live' ? <Radio /> : <Upload />}{recording ? 'در حال ضبط…' : busy ? 'در حال کالیبراسیون…' : sourceMode === 'live' ? 'شروع ضبط WebRTC و کالیبراسیون' : 'شروع کالیبراسیون'}</Button>
    </form>

    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="font-semibold">کالیبراسیون‌های ذخیره‌شده</h2>
      <div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-right text-muted-foreground"><th className="p-2">دوربین</th><th className="p-2">صفحه</th><th className="p-2">وضوح</th><th className="p-2">خطا</th><th className="p-2">تاریخ</th></tr></thead><tbody>
        {(calibrations.data?.data ?? []).map(item => <tr key={item.id} className="border-b last:border-0"><td className="p-2 font-medium">{item.camera.name}</td><td className="p-2">{item.boardType}</td><td className="p-2" dir="ltr">{item.resolutionWidth}×{item.resolutionHeight}</td><td className="p-2" dir="ltr">{item.reprojectionError.toFixed(3)} px</td><td className="p-2">{new Date(item.createdAt).toLocaleString('fa-IR')}</td></tr>)}
      </tbody></table>{!calibrations.isLoading && !calibrations.data?.data.length && <p className="py-6 text-center text-sm text-muted-foreground">هنوز کالیبراسیونی ثبت نشده است.</p>}</div>
    </section>
  </div>
}

function Field({ label, name, ...props }: { label: string; name: string } & React.ComponentProps<typeof Input>) {
  return <div className="space-y-1.5"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} {...props} /></div>
}
