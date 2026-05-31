'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { BoothForm } from './booth-form'
import type { Booth } from '@/modules/booth/types'
import type { Market } from '@/modules/market/types'
import type { BoothCategory } from '@/modules/booth-category/types'
import type { CreateBoothDto } from '@/modules/booth/schema'
import { usePermissions } from '@/hooks/use-permissions'

async function fetchBooths(): Promise<Booth[]> {
  const res = await fetch('/api/booths')
  if (!res.ok) throw new Error('خطا در دریافت غرفه‌ها')
  const json = await res.json()
  return json.data
}

async function fetchMarkets(): Promise<Market[]> {
  const res = await fetch('/api/markets')
  if (!res.ok) throw new Error('خطا در دریافت بازارها')
  const json = await res.json()
  return json.data
}

async function fetchCategories(): Promise<BoothCategory[]> {
  const res = await fetch('/api/booth-categories')
  if (!res.ok) throw new Error('خطا در دریافت دسته‌بندی‌ها')
  const json = await res.json()
  return json.data
}

async function createBooth(data: CreateBoothDto): Promise<Booth> {
  const res = await fetch('/api/booths', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('خطا در ایجاد غرفه')
  const json = await res.json()
  return json.data
}

async function updateBooth(id: string, data: CreateBoothDto): Promise<Booth> {
  const res = await fetch(`/api/booths/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('خطا در ویرایش غرفه')
  const json = await res.json()
  return json.data
}

async function deleteBooth(id: string): Promise<void> {
  const res = await fetch(`/api/booths/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('خطا در حذف غرفه')
}

export function BoothsClient() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Booth | null>(null)
  const { can } = usePermissions()
  const canCreate = can('booth', 'create')
  const canEdit = can('booth', 'update')
  const canDelete = can('booth', 'delete')

  const { data: booths = [], isLoading } = useQuery({
    queryKey: ['booths'],
    queryFn: fetchBooths,
  })

  const { data: markets = [] } = useQuery({
    queryKey: ['markets'],
    queryFn: fetchMarkets,
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['booth-categories'],
    queryFn: fetchCategories,
  })

  const createMutation = useMutation({
    mutationFn: createBooth,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['booths'] }); setCreateOpen(false) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateBoothDto }) => updateBooth(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['booths'] }); setEditTarget(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteBooth,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['booths'] }),
  })

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">غرفه‌ها</h1>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)}>+ افزودن غرفه</Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">در حال بارگذاری...</p>
      ) : booths.length === 0 ? (
        <p className="text-sm text-gray-500">هیچ غرفه‌ای ثبت نشده است.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>شماره</TableHead>
              <TableHead>بازار</TableHead>
              <TableHead>دسته‌بندی</TableHead>
              <TableHead>تاریخ ثبت</TableHead>
              {(canEdit || canDelete) && (
                <TableHead className="w-32">عملیات</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {booths.map((booth) => (
              <TableRow key={booth.id}>
                <TableCell className="font-medium">{booth.number}</TableCell>
                <TableCell>{booth.market.name}</TableCell>
                <TableCell>{booth.category.name}</TableCell>
                <TableCell>{new Date(booth.createdAt).toLocaleDateString('fa-IR')}</TableCell>
                {(canEdit || canDelete) && (
                  <TableCell>
                    <div className="flex gap-2">
                      {canEdit && (
                        <Button size="sm" variant="outline" onClick={() => setEditTarget(booth)}>
                          ویرایش
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={deleteMutation.isPending}
                          onClick={() => {
                            if (confirm('آیا از حذف این غرفه مطمئن هستید؟')) {
                              deleteMutation.mutate(booth.id)
                            }
                          }}
                        >
                          حذف
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Create dialog */}
      {canCreate && (
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>افزودن غرفه جدید</DialogTitle>
            </DialogHeader>
            <BoothForm
              markets={markets}
              categories={categories}
              onSubmit={(data) => createMutation.mutate(data)}
              onCancel={() => setCreateOpen(false)}
              isPending={createMutation.isPending}
              submitLabel="ایجاد"
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Edit dialog */}
      {canEdit && (
        <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null) }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>ویرایش غرفه</DialogTitle>
            </DialogHeader>
            {editTarget && (
              <BoothForm
                markets={markets}
                categories={categories}
                defaultValues={{
                  number: editTarget.number,
                  marketId: editTarget.marketId,
                  categoryId: editTarget.categoryId,
                  ownerId: editTarget.ownerId ?? undefined,
                }}
                onSubmit={(data) => updateMutation.mutate({ id: editTarget.id, data })}
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
