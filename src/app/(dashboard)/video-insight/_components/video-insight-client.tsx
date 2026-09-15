'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { BrainCircuit, Loader2, Radio, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CameraStreamPlayer } from '@/app/(dashboard)/monitoring/_components/camera-stream-player'
import { derivePlaybackUrls } from '@/modules/camera/stream'
import type { Camera } from '@/modules/camera/types'
import { videoAnalyticsApiJson } from '@/lib/video-analytics-api'

type InsightResult = {
  text: string
  english_text: string
  translated_query: string
  detailed: boolean
  frame_count: number
  inference_seconds: number
  translation_seconds: number
  total_seconds: number
  model: string
}

async function appJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init)
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = body?.detail?.detail ?? body?.detail ?? body?.error
    throw new Error(typeof detail === 'string' ? detail : 'خطا در دریافت اطلاعات سامانه')
  }
  return body as T
}

export function VideoInsightClient({ mode }: { mode: 'recorded' | 'live' }) {
  const [file, setFile] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [query, setQuery] = useState('در این بخش از ویدیو چه اتفاقی می‌افتد؟')
  const [cameraId, setCameraId] = useState('')
  const [maxTokens, setMaxTokens] = useState('80')
  const [detailed, setDetailed] = useState(false)
  const [result, setResult] = useState<InsightResult | null>(null)
  const cameras = useQuery<{ data: Camera[] }>({
    queryKey: ['cameras'],
    queryFn: () => appJson('/api/cameras'),
    enabled: mode === 'live',
  })
  const liveCameras = useMemo(
    () => (cameras.data?.data ?? []).filter(camera => Boolean(camera.streamUrl)),
    [cameras.data],
  )
  const selectedCamera = liveCameras.find(camera => camera.id === cameraId)
  const playback = derivePlaybackUrls(selectedCamera?.streamUrl)

  useEffect(() => {
    if (mode === 'live' && !cameraId && liveCameras[0]) setCameraId(liveCameras[0].id)
  }, [cameraId, liveCameras, mode])

  useEffect(() => () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl)
  }, [videoUrl])

  const inference = useMutation({
    mutationFn: async () => {
      const requestedMaxTokens = Number(maxTokens)
      if (!Number.isInteger(requestedMaxTokens) || requestedMaxTokens < 16 || requestedMaxTokens > 512) {
        throw new Error('تعداد توکن خروجی باید عددی بین ۱۶ و ۵۱۲ باشد')
      }
      if (mode === 'recorded') {
        if (!file) throw new Error('ابتدا یک فایل ویدیویی انتخاب کنید')
        const data = new FormData()
        data.set('video', file)
        data.set('query', query)
        data.set('num_frames', '8')
        data.set('max_new_tokens', String(requestedMaxTokens))
        data.set('detailed', String(detailed))
        return videoAnalyticsApiJson<{ data: InsightResult }>('/api/v1/video-insights', { method: 'POST', body: data })
      }
      if (!cameraId) throw new Error('ابتدا یک دوربین زنده انتخاب کنید')
      return appJson<{ data: InsightResult }>(`/api/cameras/${cameraId}/video-insight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, numFrames: 8, maxNewTokens: requestedMaxTokens, detailed }),
      })
    },
    onSuccess: response => setResult(response.data),
  })

  function chooseVideo(next: File | null) {
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    setFile(next)
    setVideoUrl(next ? URL.createObjectURL(next) : null)
    setResult(null)
    inference.reset()
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setResult(null)
    inference.mutate()
  }

  return <div className="space-y-5">
    <div>
      <div className="flex items-center gap-2"><BrainCircuit className="size-6 text-primary" /><h1 className="text-xl font-bold">{mode === 'live' ? 'درک زنده ویدیو' : 'درک ویدیو'}</h1></div>
      <p className="mt-1 text-sm text-muted-foreground">{mode === 'live'
        ? 'استریم را پیوسته ببینید و درباره توالی فریم‌های تازه از مدل سؤال کنید.'
        : 'ویدیو را بارگذاری و پخش کنید، سپس درباره توالی فریم‌های آن از مدل سؤال کنید.'}</p>
    </div>

    <form onSubmit={submit} className="space-y-5 rounded-xl border bg-card p-5 shadow-sm">
      {mode === 'recorded' ? <div className="space-y-2">
        <Label htmlFor="insight-video">فایل ویدیو</Label>
        <Input id="insight-video" type="file" accept="video/*,.mov,.mkv,.avi,.webm,.m4v" required onChange={event => chooseVideo(event.target.files?.[0] ?? null)} />
      </div> : <div className="space-y-2">
        <Label htmlFor="insight-camera">دوربین زنده</Label>
        <select id="insight-camera" value={cameraId} onChange={event => { setCameraId(event.target.value); setResult(null); inference.reset() }} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
          {liveCameras.map(camera => <option key={camera.id} value={camera.id}>{camera.name}</option>)}
        </select>
        {!cameras.isLoading && liveCameras.length === 0 && <p className="text-sm text-amber-700">هیچ دوربین دارای استریمی در دسترس نیست.</p>}
      </div>}

      <div className="overflow-hidden rounded-xl border bg-black">
        {mode === 'recorded' && videoUrl && <video key={videoUrl} src={videoUrl} controls autoPlay muted loop playsInline className="aspect-video size-full object-contain" />}
        {mode === 'recorded' && !videoUrl && <div className="flex aspect-video items-center justify-center text-sm text-white/60"><Upload className="ml-2 size-5" />ویدیویی انتخاب نشده است</div>}
        {mode === 'live' && playback && <CameraStreamPlayer whepSrc={playback.whep} hlsSrc={playback.hls} />}
        {mode === 'live' && !playback && <div className="flex aspect-video items-center justify-center text-sm text-white/60"><Radio className="ml-2 size-5" />استریم قابل پخش انتخاب نشده است</div>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="insight-query">پرسش از ویدیو</Label>
        <textarea id="insight-query" value={query} onChange={event => setQuery(event.target.value)} required maxLength={4000} rows={3} className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="مثلاً افراد در این توالی چه کاری انجام می‌دهند؟" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="insight-max-tokens">حداکثر تعداد توکن خروجی</Label>
          <Input id="insight-max-tokens" type="number" inputMode="numeric" min={16} max={512} step={16} value={maxTokens} onChange={event => setMaxTokens(event.target.value)} />
          <p className="text-xs text-muted-foreground">مقدار بیشتر پاسخ طولانی‌تر و زمان پردازش بیشتری ایجاد می‌کند. مقدار پیش‌فرض ۸۰ است.</p>
        </div>
        <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition ${detailed ? 'border-primary bg-primary/5' : 'bg-muted/20'}`}>
          <input type="checkbox" checked={detailed} onChange={event => setDetailed(event.target.checked)} className="mt-1 size-4 accent-primary" />
          <span><span className="block text-sm font-semibold">تحلیل با جزئیات</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">در حالت عادی پاسخ کلی است. با فعال‌سازی، مدل رویدادها، افراد، اشیا، تغییرات زمانی و موارد نامطمئن را با جزئیات بررسی می‌کند.</span></span>
        </label>
      </div>

      <Button type="submit" disabled={!query.trim() || inference.isPending || Number(maxTokens) < 16 || Number(maxTokens) > 512 || !Number.isInteger(Number(maxTokens)) || (mode === 'recorded' ? !file : !cameraId)}>
        {inference.isPending ? <Loader2 className="animate-spin" /> : <BrainCircuit />}
        {inference.isPending ? 'مدل در حال بررسی فریم‌هاست…' : 'دریافت پاسخ مدل'}
      </Button>

      <div className="space-y-2">
        <Label htmlFor="insight-output">خروجی مدل</Label>
        <div id="insight-output" role="status" aria-live="polite" className="min-h-32 whitespace-pre-wrap rounded-lg border bg-muted/30 p-4 text-sm leading-7">
          {inference.isPending ? 'در حال نمونه‌برداری و تحلیل توالی ویدیو…' : result?.text ?? 'پاسخ مدل اینجا نمایش داده می‌شود.'}
        </div>
        {result && <>
          <p className="text-xs text-muted-foreground" dir="ltr">{result.model} · {result.frame_count} frames · vision {result.inference_seconds.toFixed(2)}s · translation {result.translation_seconds.toFixed(2)}s · total {result.total_seconds.toFixed(2)}s</p>
          <details className="rounded-lg border bg-background p-3 text-sm">
            <summary className="cursor-pointer font-medium">نمایش پاسخ اصلی انگلیسی</summary>
            <p className="mt-3 whitespace-pre-wrap leading-7" dir="ltr">{result.english_text}</p>
          </details>
        </>}
        {inference.error && <p className="text-sm text-red-600">{inference.error.message}</p>}
      </div>
    </form>
  </div>
}
