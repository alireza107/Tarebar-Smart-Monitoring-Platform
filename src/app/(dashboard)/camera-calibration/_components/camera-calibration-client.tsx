'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Loader2, Upload, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fruitApiJson } from '@/lib/fruit-api'
import type { Camera } from '@/modules/camera/types'

type CalibrationJob = {
  id: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  error?: string | null
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

export function CameraCalibrationClient() {
  const queryClient = useQueryClient()
  const formRef = useRef<HTMLFormElement>(null)
  const persistedJob = useRef<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [cameraId, setCameraId] = useState('')
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
    refetchInterval: query => ['queued', 'running'].includes(query.state.data?.data.status ?? '') ? 1500 : false,
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

  function submit(event: FormEvent<HTMLFormElement>) {
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
    start.mutate(data, {
      onSuccess: response => window.localStorage.setItem('pending-camera-calibration', JSON.stringify({
        jobId: response.data.id,
        submitted: values,
      })),
    })
  }

  const currentJob = job.data?.data
  const busy = start.isPending || currentJob?.status === 'queued' || currentJob?.status === 'running'

  return <div className="space-y-6">
    <div>
      <h1 className="text-xl font-bold">کالیبراسیون دوربین</h1>
      <p className="mt-1 text-sm text-muted-foreground">تصاویر یا ویدیوی صفحه شطرنجی/ChArUco را بارگذاری و پارامترهای هر دوربین را برای تحلیل میوه ذخیره کنید.</p>
    </div>

    <form ref={formRef} onSubmit={submit} className="space-y-5 rounded-xl border bg-card p-5 shadow-sm">
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
        <div className="space-y-1.5 md:col-span-2 lg:col-span-3">
          <Label htmlFor="files">تصاویر یا ویدیوی کالیبراسیون</Label>
          <Input id="files" name="files" type="file" accept="image/*,video/*,.mov,.mkv,.avi" multiple required />
          <p className="text-xs text-muted-foreground">برای تصاویر چند فایل انتخاب کنید؛ برای ویدیو فریم‌ها به‌صورت خودکار نمونه‌برداری می‌شوند.</p>
        </div>
      </div>
      {(start.error || job.error || persist.error) && <p className="text-sm text-red-600">{(start.error ?? job.error ?? persist.error)?.message}</p>}
      {currentJob && <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${currentJob.status === 'failed' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
        {['queued', 'running'].includes(currentJob.status) ? <Loader2 className="size-4 animate-spin" /> : currentJob.status === 'completed' ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
        <span>{currentJob.status === 'completed' ? `کالیبراسیون با خطای ${currentJob.calibration?.reprojection_error.toFixed(3)} پیکسل ذخیره شد.` : currentJob.status === 'failed' ? currentJob.error : 'در حال تشخیص صفحه و محاسبه پارامترهای دوربین…'}</span>
      </div>}
      <Button type="submit" disabled={busy || !cameraId}><Upload />{busy ? 'در حال کالیبراسیون…' : 'شروع کالیبراسیون'}</Button>
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
