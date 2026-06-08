'use client'

import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { RegionForm, type RegionFormValues } from './region-form'
import { RegionDetailDialog } from './region-detail-dialog'
import { usePermissions } from '@/hooks/use-permissions'
import { Search, Download, Upload, Settings2 } from 'lucide-react'
import type { RegionSummary } from '@/modules/region/types'

async function fetchRegions(q: string): Promise<RegionSummary[]> {
  const url = q ? `/api/regions?q=${encodeURIComponent(q)}` : '/api/regions'
  const res = await fetch(url)
  if (!res.ok) throw new Error('خطا در دریافت مناطق')
  return res.json().then(j => j.data)
}

async function send(url: string, method: string, body?: unknown): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  return res
}

export function RegionsClient() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<RegionSummary | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RegionSummary | null>(null)
  const [manageId, setManageId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const importRef = useRef<HTMLInputElement>(null)

  const { can } = usePermissions()
  const canCreate = can('region', 'create')
  const canEdit = can('region', 'update')
  const canDelete = can('region', 'delete')

  const { data: regions = [], isLoading } = useQuery({
    queryKey: ['regions', search],
    queryFn: () => fetchRegions(search),
    placeholderData: keepPreviousData,
  })

  const createMutation = useMutation({
    mutationFn: async (data: RegionFormValues) => {
      const res = await send('/api/regions', 'POST', normalize(data))
      if (!res.ok) throw new Error(await msg(res, 'خطا در ایجاد منطقه'))
      return res.json()
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['regions'] }); setCreateOpen(false); setFormError(null) },
    onError: (e: Error) => setFormError(e.message),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: RegionFormValues }) => {
      const res = await send(`/api/regions/${id}`, 'PATCH', { name: data.name, description: data.description || null, color: data.color || null })
      if (!res.ok) throw new Error(await msg(res, 'خطا در ویرایش منطقه'))
      return res.json()
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['regions'] }); setEditTarget(null); setFormError(null) },
    onError: (e: Error) => setFormError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await send(`/api/regions/${id}`, 'DELETE')
      if (!res.ok) throw new Error('خطا در حذف منطقه')
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['regions'] }); toast.success('منطقه حذف شد') },
    onError: () => toast.error('خطا در حذف منطقه'),
  })

  const importMutation = useMutation({
    mutationFn: async (payload: unknown) => {
      const res = await send('/api/regions/import', 'POST', payload)
      if (!res.ok) throw new Error(await msg(res, 'خطا در ورود داده‌ها'))
      return res.json()
    },
    onSuccess: (j) => { qc.invalidateQueries({ queryKey: ['regions'] }); toast.success(`${j.data?.length ?? 0} منطقه وارد شد`) },
    onError: (e: Error) => toast.error(e.message),
  })

  function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    file.text().then(text => {
      try {
        const parsed = JSON.parse(text)
        // accept either an export envelope { regions: [...] } or a bare array
        const regions = Array.isArray(parsed) ? parsed : parsed.regions
        importMutation.mutate({ regions })
      } catch {
        toast.error('فایل JSON نامعتبر است')
      }
    })
    e.target.value = ''
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">مناطق</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="جستجوی منطقه..."
              className="w-48 pr-8"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => window.open('/api/regions/export', '_blank')}>
            <Download /> خروجی
          </Button>
          {canCreate && (
            <>
              <input ref={importRef} type="file" accept="application/json" hidden onChange={onImportFile} />
              <Button variant="outline" size="sm" onClick={() => importRef.current?.click()} disabled={importMutation.isPending}>
                <Upload /> ورود
              </Button>
              <Button size="sm" onClick={() => { setCreateOpen(true); setFormError(null) }}>
                + افزودن منطقه
              </Button>
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">در حال بارگذاری...</p>
      ) : regions.length === 0 ? (
        <p className="text-sm text-muted-foreground">هیچ منطقه‌ای ثبت نشده است.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>نام منطقه</TableHead>
              <TableHead>بازار</TableHead>
              <TableHead>دوربین‌ها</TableHead>
              <TableHead>غرفه‌ها</TableHead>
              <TableHead>تاریخ ثبت</TableHead>
              <TableHead className="w-44">عملیات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {regions.map(region => (
              <TableRow key={region.id}>
                <TableCell className="font-medium">
                  <span className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: region.color ?? '#94a3b8' }} />
                    {region.name}
                  </span>
                </TableCell>
                <TableCell>{region.market?.name ?? '—'}</TableCell>
                <TableCell>{region.cameraCount}</TableCell>
                <TableCell>{region.boothCount}</TableCell>
                <TableCell>{new Date(region.createdAt).toLocaleDateString('fa-IR')}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setManageId(region.id)}>
                      <Settings2 /> مدیریت
                    </Button>
                    {canEdit && (
                      <Button size="sm" variant="outline" onClick={() => { setEditTarget(region); setFormError(null) }}>
                        ویرایش
                      </Button>
                    )}
                    {canDelete && (
                      <Button size="sm" variant="destructive" onClick={() => setDeleteTarget(region)}>
                        حذف
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Manage (cameras + stalls) */}
      <RegionDetailDialog regionId={manageId} canEdit={canEdit} onClose={() => setManageId(null)} />

      {/* Delete */}
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={open => { if (!open) setDeleteTarget(null) }}
        description="آیا از حذف این منطقه مطمئن هستید؟ نگاشت‌های دوربین و غرفه نیز حذف می‌شوند. این عملیات قابل بازگشت نیست."
        isPending={deleteMutation.isPending}
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id) }}
      />

      {/* Create */}
      {canCreate && (
        <Dialog open={createOpen} onOpenChange={open => { setCreateOpen(open); if (!open) setFormError(null) }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>افزودن منطقه جدید</DialogTitle>
            </DialogHeader>
            {formError && createOpen && <p className="text-sm text-red-500">{formError}</p>}
            <RegionForm
              onSubmit={data => createMutation.mutate(data)}
              onCancel={() => setCreateOpen(false)}
              isPending={createMutation.isPending}
              submitLabel="ایجاد"
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Edit */}
      {canEdit && (
        <Dialog open={!!editTarget} onOpenChange={open => { if (!open) { setEditTarget(null); setFormError(null) } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>ویرایش منطقه</DialogTitle>
            </DialogHeader>
            {formError && !!editTarget && <p className="text-sm text-red-500">{formError}</p>}
            {editTarget && (
              <RegionForm
                lockMarket
                defaultValues={{
                  name: editTarget.name,
                  description: editTarget.description ?? '',
                  marketId: editTarget.marketId,
                  color: editTarget.color ?? '#10b981',
                }}
                onSubmit={data => updateMutation.mutate({ id: editTarget.id, data })}
                onCancel={() => setEditTarget(null)}
                isPending={updateMutation.isPending}
                submitLabel="ذخیره تغییرات"
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function normalize(data: RegionFormValues) {
  return {
    name: data.name,
    description: data.description || undefined,
    marketId: data.marketId,
    color: data.color || undefined,
  }
}

async function msg(res: Response, fallback: string): Promise<string> {
  try {
    const j = await res.json()
    if (typeof j.error === 'string') return j.error
  } catch {}
  return fallback
}
