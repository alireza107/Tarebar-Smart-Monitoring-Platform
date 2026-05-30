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
import { BoothCategoryForm } from './booth-category-form'
import type { BoothCategory } from '@/modules/booth-category/types'
import type { CreateBoothCategoryDto } from '@/modules/booth-category/schema'

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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['booth-categories'] }),
  })

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">دسته‌بندی غرفه‌ها</h1>
        <Button onClick={() => setCreateOpen(true)}>+ افزودن دسته‌بندی</Button>
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
              <TableHead className="w-32">عملیات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((cat) => (
              <TableRow key={cat.id}>
                <TableCell className="font-medium">{cat.name}</TableCell>
                <TableCell>{new Date(cat.createdAt).toLocaleDateString('fa-IR')}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditTarget(cat)}>
                      ویرایش
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (confirm('آیا از حذف این دسته‌بندی مطمئن هستید؟')) {
                          deleteMutation.mutate(cat.id)
                        }
                      }}
                    >
                      حذف
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

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
    </div>
  )
}
