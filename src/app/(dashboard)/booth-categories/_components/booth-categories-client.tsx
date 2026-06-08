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
import { toast } from 'sonner'
import { BoothCategoryForm } from './booth-category-form'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import type { BoothCategory } from '@/modules/booth-category/types'
import type { CreateBoothCategoryDto } from '@/modules/booth-category/schema'
import { usePermissions } from '@/hooks/use-permissions'

async function fetchCategories(): Promise<BoothCategory[]> {
  const res = await fetch('/api/booth-categories')
  if (!res.ok) throw new Error('خطا در دریافت دسته‌بندی‌ها')
  const json = await res.json()
  return json.data
}

async function createCategory(data: CreateBoothCategoryDto): Promise<BoothCategory> {
  const res = await fetch('/api/booth-categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('خطا در ایجاد دسته‌بندی')
  const json = await res.json()
  return json.data
}

async function updateCategory(id: string, data: CreateBoothCategoryDto): Promise<BoothCategory> {
  const res = await fetch(`/api/booth-categories/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('خطا در ویرایش دسته‌بندی')
  const json = await res.json()
  return json.data
}

async function deleteCategory(id: string): Promise<void> {
  const res = await fetch(`/api/booth-categories/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('خطا در حذف دسته‌بندی')
}

export function BoothCategoriesClient() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<BoothCategory | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BoothCategory | null>(null)
  const { can } = usePermissions()
  const canCreate = can('booth_category', 'create')
  const canEdit = can('booth_category', 'update')
  const canDelete = can('booth_category', 'delete')

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['booth-categories'],
    queryFn: fetchCategories,
  })

  const createMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['booth-categories'] }); setCreateOpen(false) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateBoothCategoryDto }) => updateCategory(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['booth-categories'] }); setEditTarget(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['booth-categories'] })
      toast.success('دسته‌بندی با موفقیت حذف شد')
    },
    onError: () => toast.error('خطا در حذف دسته‌بندی'),
  })

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">دسته‌بندی غرفه‌ها</h1>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)}>+ افزودن دسته‌بندی</Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">در حال بارگذاری...</p>
      ) : categories.length === 0 ? (
        <p className="text-sm text-gray-500">هیچ دسته‌بندی ثبت نشده است.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>نام</TableHead>
              <TableHead>تاریخ ثبت</TableHead>
              {(canEdit || canDelete) && (
                <TableHead className="w-32">عملیات</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((cat) => (
              <TableRow key={cat.id}>
                <TableCell className="font-medium">{cat.name}</TableCell>
                <TableCell>{new Date(cat.createdAt).toLocaleDateString('fa-IR')}</TableCell>
                {(canEdit || canDelete) && (
                  <TableCell>
                    <div className="flex gap-2">
                      {canEdit && (
                        <Button size="sm" variant="outline" onClick={() => setEditTarget(cat)}>
                          ویرایش
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={deleteMutation.isPending}
                          onClick={() => setDeleteTarget(cat)}
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

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        description="آیا از حذف این دسته‌بندی مطمئن هستید؟ این عملیات قابل بازگشت نیست."
        isPending={deleteMutation.isPending}
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id) }}
      />

      {/* Create dialog */}
      {canCreate && (
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>افزودن دسته‌بندی جدید</DialogTitle>
            </DialogHeader>
            <BoothCategoryForm
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
              <DialogTitle>ویرایش دسته‌بندی</DialogTitle>
            </DialogHeader>
            {editTarget && (
              <BoothCategoryForm
                defaultValues={{ name: editTarget.name }}
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
