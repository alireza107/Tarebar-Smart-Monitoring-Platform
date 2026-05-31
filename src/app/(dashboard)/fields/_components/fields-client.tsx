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
import { FieldForm } from './field-form'
import type { Field } from '@/modules/field/types'
import type { CreateFieldDto } from '@/modules/field/schema'
import { usePermissions } from '@/hooks/use-permissions'

async function fetchFields(): Promise<Field[]> {
  const res = await fetch('/api/fields')
  if (!res.ok) throw new Error('خطا در دریافت میادین')
  const json = await res.json()
  return json.data
}

async function createField(data: CreateFieldDto): Promise<Field> {
  const res = await fetch('/api/fields', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('خطا در ایجاد میدان')
  const json = await res.json()
  return json.data
}

async function updateField(id: string, data: CreateFieldDto): Promise<Field> {
  const res = await fetch(`/api/fields/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('خطا در ویرایش میدان')
  const json = await res.json()
  return json.data
}

async function deleteField(id: string): Promise<void> {
  const res = await fetch(`/api/fields/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('خطا در حذف میدان')
}

export function FieldsClient() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Field | null>(null)
  const { can } = usePermissions()
  const canCreate = can('field', 'create')
  const canEdit = can('field', 'update')
  const canDelete = can('field', 'delete')

  const { data: fields = [], isLoading } = useQuery({
    queryKey: ['fields'],
    queryFn: fetchFields,
  })

  const createMutation = useMutation({
    mutationFn: createField,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fields'] }); setCreateOpen(false) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateFieldDto }) => updateField(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fields'] }); setEditTarget(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteField,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fields'] }),
  })

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">میادین</h1>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)}>+ افزودن میدان</Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">در حال بارگذاری...</p>
      ) : fields.length === 0 ? (
        <p className="text-sm text-gray-500">هیچ میدانی ثبت نشده است.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>نام</TableHead>
              <TableHead>آدرس</TableHead>
              <TableHead>تاریخ ثبت</TableHead>
              {(canEdit || canDelete) && (
                <TableHead className="w-32">عملیات</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field) => (
              <TableRow key={field.id}>
                <TableCell className="font-medium">{field.name}</TableCell>
                <TableCell>{field.address}</TableCell>
                <TableCell>{new Date(field.createdAt).toLocaleDateString('fa-IR')}</TableCell>
                {(canEdit || canDelete) && (
                  <TableCell>
                    <div className="flex gap-2">
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditTarget(field)}
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
                            if (confirm('آیا از حذف این میدان مطمئن هستید؟')) {
                              deleteMutation.mutate(field.id)
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
              <DialogTitle>افزودن میدان جدید</DialogTitle>
            </DialogHeader>
            <FieldForm
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
              <DialogTitle>ویرایش میدان</DialogTitle>
            </DialogHeader>
            {editTarget && (
              <FieldForm
                defaultValues={{ name: editTarget.name, address: editTarget.address }}
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
