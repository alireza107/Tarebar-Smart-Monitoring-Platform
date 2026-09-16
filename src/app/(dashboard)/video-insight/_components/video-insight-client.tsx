'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { BrainCircuit, Loader2, Radio, Square, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CameraStreamPlayer } from '@/app/(dashboard)/monitoring/_components/camera-stream-player'
import { derivePlaybackUrls } from '@/modules/camera/stream'
import type { Camera } from '@/modules/camera/types'
import { videoAnalyticsApiJson } from '@/lib/video-analytics-api'

type YesNo = 'Yes' | 'No'
type InsightResult = {
  answers: { fighting: YesNo; floor_clean: YesNo }
  frame_count: number
  inference_seconds: number
}
type InsightLog = InsightResult & { id: number; checkedAt: Date; window: string }
type InferenceRequest = { intervalSeconds: number; startSeconds?: number; endSeconds?: number; signal: AbortSignal }

async function appJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init)
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = body?.detail?.detail ?? body?.detail ?? body?.error
    throw new Error(typeof detail === 'string' ? detail : 'خطا در دریافت اطلاعات سامانه')
  }
  return body as T
}

function formatVideoTime(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remainder = Math.floor(seconds % 60)
  return `${minutes.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`
}

function answerEvent(kind: 'fighting' | 'floor', answer: YesNo) {
  if (kind === 'fighting') return answer === 'Yes' ? 'درگیری افراد مشاهده شد' : 'درگیری افراد مشاهده نشد'
  return answer === 'Yes' ? 'کف صحنه تمیز است' : 'کف صحنه تمیز نیست'
}

function answerClass(kind: 'fighting' | 'floor', answer: YesNo) {
  const isAlert = kind === 'fighting' ? answer === 'Yes' : answer === 'No'
  return isAlert ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
}

function EventTable({ kind, logs }: { kind: 'fighting' | 'floor'; logs: InsightLog[] }) {
  const title = kind === 'fighting' ? 'Are there persons fighting in the video?' : 'Is the floor of the scene clean?'
  return <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
    <div className="border-b px-4 py-3">
      <h2 className="font-semibold" dir="ltr">{title}</h2>
      <p className="mt-1 text-xs text-muted-foreground">رویدادهای قابل فهم استخراج‌شده از پنجره‌های پردازش‌شده</p>
    </div>
    <Table>
      <TableHeader><TableRow>
        <TableHead>زمان بررسی</TableHead><TableHead>بازه ویدیو</TableHead><TableHead>فریم‌ها</TableHead><TableHead>پاسخ</TableHead><TableHead>رویداد</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {logs.length === 0 && <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">هنوز رویدادی ثبت نشده است.</TableCell></TableRow>}
        {logs.map(log => {
          const answer = kind === 'fighting' ? log.answers.fighting : log.answers.floor_clean
          return <TableRow key={`${kind}-${log.id}`}>
            <TableCell className="whitespace-nowrap">{log.checkedAt.toLocaleTimeString('fa-IR')}</TableCell>
            <TableCell className="whitespace-nowrap" dir="ltr">{log.window}</TableCell>
            <TableCell>{log.frame_count}</TableCell>
            <TableCell><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${answerClass(kind, answer)}`}>{answer}</span></TableCell>
            <TableCell>{answerEvent(kind, answer)}</TableCell>
          </TableRow>
        })}
      </TableBody>
    </Table>
  </section>
}

export function VideoInsightClient({ mode }: { mode: 'recorded' | 'live' }) {
  const [file, setFile] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoDuration, setVideoDuration] = useState(0)
  const [cameraId, setCameraId] = useState('')
  const [intervalSeconds, setIntervalSeconds] = useState('10')
  const [logs, setLogs] = useState<InsightLog[]>([])
  const [running, setRunning] = useState(false)
  const runningRef = useRef(false)
  const runIdRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const nextId = useRef(1)

  const cameras = useQuery<{ data: Camera[] }>({
    queryKey: ['cameras'], queryFn: () => appJson('/api/cameras'), enabled: mode === 'live',
  })
  const liveCameras = useMemo(() => (cameras.data?.data ?? []).filter(camera => Boolean(camera.streamUrl)), [cameras.data])
  const selectedCamera = liveCameras.find(camera => camera.id === cameraId)
  const playback = derivePlaybackUrls(selectedCamera?.streamUrl)

  useEffect(() => {
    if (mode === 'live' && !cameraId && liveCameras[0]) setCameraId(liveCameras[0].id)
  }, [cameraId, liveCameras, mode])

  useEffect(() => () => {
    runningRef.current = false
    abortRef.current?.abort()
    if (videoUrl) URL.revokeObjectURL(videoUrl)
  }, [videoUrl])

  const inference = useMutation({
    mutationFn: async (request: InferenceRequest) => {
      if (mode === 'recorded') {
        if (!file) throw new Error('ابتدا یک فایل ویدیویی انتخاب کنید')
        const data = new FormData()
        data.set('video', file)
        data.set('num_frames', '8')
        data.set('window_start_seconds', String(request.startSeconds ?? 0))
        data.set('window_end_seconds', String(request.endSeconds))
        return videoAnalyticsApiJson<{ data: InsightResult }>('/api/v1/video-insights', { method: 'POST', body: data, signal: request.signal })
      }
      if (!cameraId) throw new Error('ابتدا یک دوربین زنده انتخاب کنید')
      return appJson<{ data: InsightResult }>(`/api/cameras/${cameraId}/video-insight`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: request.signal,
        body: JSON.stringify({ numFrames: 8, intervalSeconds: request.intervalSeconds }),
      })
    },
  })

  function stop() {
    runningRef.current = false
    runIdRef.current += 1
    abortRef.current?.abort()
    setRunning(false)
  }

  function resetSource() {
    stop()
    setLogs([])
    nextId.current = 1
    inference.reset()
  }

  function chooseVideo(next: File | null) {
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    resetSource()
    setVideoDuration(0)
    setFile(next)
    setVideoUrl(next ? URL.createObjectURL(next) : null)
  }

  async function start() {
    const interval = Number(intervalSeconds)
    if (!Number.isFinite(interval) || interval < 10 || interval > 60) return
    if (mode === 'recorded' && (!file || !videoDuration)) return
    if (mode === 'live' && !cameraId) return
    setLogs([])
    nextId.current = 1
    runningRef.current = true
    const runId = ++runIdRef.current
    setRunning(true)
    let windowStart = 0
    try {
      while (runningRef.current && runIdRef.current === runId) {
        const windowEnd = mode === 'recorded' ? Math.min(windowStart + interval, videoDuration) : undefined
        const controller = new AbortController()
        abortRef.current = controller
        const cycleStarted = Date.now()
        const response = await inference.mutateAsync({
          intervalSeconds: interval, startSeconds: windowStart, endSeconds: windowEnd, signal: controller.signal,
        })
        if (!runningRef.current || runIdRef.current !== runId) break
        const windowLabel = mode === 'recorded'
          ? `${formatVideoTime(windowStart)}–${formatVideoTime(windowEnd ?? windowStart)}`
          : `${interval} s window`
        setLogs(previous => [{ ...response.data, id: nextId.current++, checkedAt: new Date(), window: windowLabel }, ...previous].slice(0, 100))
        if (mode === 'recorded') {
          if (videoRef.current && windowEnd !== undefined) videoRef.current.currentTime = windowEnd
          if (windowEnd === undefined || windowEnd >= videoDuration) break
          windowStart = windowEnd
        } else {
          const remaining = interval * 1000 - (Date.now() - cycleStarted)
          if (remaining > 0) await new Promise(resolve => window.setTimeout(resolve, remaining))
        }
      }
    } catch {
      // React Query retains failures for the visible error message below.
    } finally {
      if (runIdRef.current === runId) {
        runningRef.current = false
        abortRef.current = null
        setRunning(false)
      }
    }
  }

  const validInterval = Number(intervalSeconds) >= 10 && Number(intervalSeconds) <= 60
  const canStart = validInterval && (mode === 'recorded' ? Boolean(file && videoDuration) : Boolean(cameraId))

  return <div className="space-y-5">
    <div>
      <div className="flex items-center gap-2"><BrainCircuit className="size-6 text-primary" /><h1 className="text-xl font-bold">{mode === 'live' ? 'پایش زنده ویدیو' : 'پایش ویدیو'}</h1></div>
      <p className="mt-1 text-sm text-muted-foreground">دو وضعیت ثابت در بازه‌های زمانی انتخابی بررسی می‌شوند؛ خروجی مدل نمایش داده نمی‌شود و فقط رویدادهای Yes/No ثبت می‌شوند.</p>
    </div>

    <div className="space-y-5 rounded-xl border bg-card p-5 shadow-sm">
      {mode === 'recorded' ? <div className="space-y-2">
        <Label htmlFor="insight-video">فایل ویدیو</Label>
        <Input id="insight-video" type="file" accept="video/*,.mov,.mkv,.avi,.webm,.m4v" onChange={event => chooseVideo(event.target.files?.[0] ?? null)} />
      </div> : <div className="space-y-2">
        <Label htmlFor="insight-camera">دوربین زنده</Label>
        <select id="insight-camera" value={cameraId} disabled={running} onChange={event => { resetSource(); setCameraId(event.target.value) }} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
          {liveCameras.map(camera => <option key={camera.id} value={camera.id}>{camera.name}</option>)}
        </select>
        {!cameras.isLoading && liveCameras.length === 0 && <p className="text-sm text-amber-700">هیچ دوربین دارای استریمی در دسترس نیست.</p>}
      </div>}

      <div className="overflow-hidden rounded-xl border bg-black">
        {mode === 'recorded' && videoUrl && <video ref={videoRef} key={videoUrl} src={videoUrl} controls muted playsInline onLoadedMetadata={event => setVideoDuration(event.currentTarget.duration)} className="aspect-video size-full object-contain" />}
        {mode === 'recorded' && !videoUrl && <div className="flex aspect-video items-center justify-center text-sm text-white/60"><Upload className="ml-2 size-5" />ویدیویی انتخاب نشده است</div>}
        {mode === 'live' && playback && <CameraStreamPlayer whepSrc={playback.whep} hlsSrc={playback.hls} />}
        {mode === 'live' && !playback && <div className="flex aspect-video items-center justify-center text-sm text-white/60"><Radio className="ml-2 size-5" />استریم قابل پخش انتخاب نشده است</div>}
      </div>

      <div className="grid items-end gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="space-y-2">
          <Label htmlFor="insight-interval">فاصله پردازش (ثانیه)</Label>
          <Input id="insight-interval" type="number" inputMode="decimal" min={10} max={60} step={1} disabled={running} value={intervalSeconds} onChange={event => setIntervalSeconds(event.target.value)} />
          <p className="text-xs text-muted-foreground">هر بار ۸ فریم از بازه N ثانیه‌ای بررسی می‌شود. N را می‌توانید بین ۱۰ تا ۶۰ تغییر دهید.</p>
        </div>
        {running
          ? <Button type="button" variant="destructive" onClick={stop}><Square />توقف پردازش</Button>
          : <Button type="button" disabled={!canStart} onClick={() => void start()}><BrainCircuit />شروع پردازش</Button>}
      </div>

      {running && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />در حال پردازش بازه بعدی و ثبت رویدادها…</p>}
      {inference.error && !(inference.error instanceof DOMException && inference.error.name === 'AbortError') && <p className="text-sm text-red-600">{inference.error.message}</p>}
    </div>

    <div className="grid gap-5 xl:grid-cols-2">
      <EventTable kind="fighting" logs={logs} />
      <EventTable kind="floor" logs={logs} />
    </div>
  </div>
}
