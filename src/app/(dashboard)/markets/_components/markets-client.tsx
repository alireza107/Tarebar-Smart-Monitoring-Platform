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
import { MarketForm } from './market-form'
import type { Market } from '@/modules/market/types'
import type { Field } from '@/modules/field/types'
import type { CreateMarketDto } from '@/modules/market/schema'
import { usePermissions } from '@/hooks/use-permissions'

async function fetchMarkets(): Promise<Market[]> {
  const res = await fetch('/api/markets')
  if (!res.ok) throw new Error('خطا در دریافت بازارها')
  const json = await res.json()
  return json.data
}

async function fetchFields(): Promise<Field[]> {
  const res = await fetch('/api/fields')
  if (!res.ok) throw new Error('خطا در دریافت میادین')
  const json = await res.json()
  return json.data
}

async function createMarket(data: CreateMarketDto): Promise<Market> {
  const res = await fetch('/api/markets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('خطا در ایجاد بازار')
  const json = await res.json()
  return json.data
}

async function updateMarket(id: string, data: CreateMarketDto): Promise<Market> {
  const res = await fetch(`/api/markets/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('خطا در ویرایش بازار')
  const json = await res.json()
  return json.data
}

async function deleteMarket(id: string): Promise<void> {
  const res = await fetch(`/api/markets/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('خطا در حذف بازار')
}

export function MarketsClient() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Market | null>(null)
  const { can } = usePermissions()
  const canCreate = can('market', 'create')
  const canEdit = can('market', 'update')
  const canDelete = can('market', 'delete')

  const { data: markets = [], isLoading } = useQuery({
    queryKey: ['markets'],
    queryFn: fetchMarkets,
  })

  const { data: fields = [] } = useQuery({
    queryKey: ['fields'],
    queryFn: fetchFields,
  })

  const createMutation = useMutation({
    mutationFn: createMarket,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['markets'] }); setCreateOpen(false) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateMarketDto }) => updateMarket(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['markets'] }); setEditTarget(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteMarket,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['markets'] }),
  })

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">بازارها</h1>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)}>+ افزودن بازار</Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">در حال بارگذاری...</p>
      ) : markets.length === 0 ? (
        <p className="text-sm text-gray-500">هیچ بازاری ثبت نشده است.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>نام</TableHead>
              <TableHead>میدان</TableHead>
              <TableHead>آدرس</TableHead>
              <TableHead>تاریخ ثبت</TableHead>
              {(canEdit || canDelete) && (
                <TableHead className="w-32">عملیات</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {markets.map((market) => (
              <TableRow key={market.id}>
                <TableCell className="font-medium">{market.name}</TableCell>
                <TableCell>{market.field.name}</TableCell>
                <TableCell>{market.address ?? '—'}</TableCell>
                <TableCell>{new Date(market.createdAt).toLocaleDateString('fa-IR')}</TableCell>
                {(canEdit || canDelete) && (
                  <TableCell>
                    <div className="flex gap-2">
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditTarget(market)}
                        >
                          ویرایش
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={deleteMutation.isPending}
                          onClick={() => {
                            if (confirm('آیا از حذف این بازار مطمئن هستید؟')) {
                              deleteMutation.mutate(market.id)
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
              <DialogTitle>افزودن بازار جدید</DialogTitle>
            </DialogHeader>
            <MarketForm
              fields={fields}
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
              <DialogTitle>ویرایش بازار</DialogTitle>
            </DialogHeader>
            {editTarget && (
              <MarketForm
                fields={fields}
                defaultValues={{ name: editTarget.name, address: editTarget.address ?? undefined, fieldId: editTarget.fieldId }}
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
