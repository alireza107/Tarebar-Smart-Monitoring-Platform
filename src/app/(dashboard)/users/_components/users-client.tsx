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
import { UserForm, type UserFormValues } from './user-form'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import type { User } from '@/modules/user/types'
import { usePermissions } from '@/hooks/use-permissions'

const roleLabels: Record<string, string> = {
  ORG_ADMIN: 'مدیر سازمان',
  FIELD_MANAGER: 'مدیر میدان',
  MARKET_MANAGER: 'مدیر بازار',
}

function scopeLabel(user: User): string {
  if (user.scopes.length === 0) return 'کل سازمان'
  const scope = user.scopes[0]
  if (scope.scopeType === 'FIELD') return `میدان: ${scope.field?.name ?? '—'}`
  return `بازار: ${scope.market?.name ?? '—'}`
}

async function fetchUsers(): Promise<User[]> {
  const res = await fetch('/api/users')
  if (!res.ok) throw new Error('خطا در دریافت کاربران')
  const json = await res.json()
  return json.data
}

async function createUser(data: UserFormValues): Promise<User> {
  const payload = {
    ...data,
    email: data.email || undefined,
    password: data.password || '',
    fieldId: data.fieldId || undefined,
    marketId: data.marketId || undefined,
  }
  const res = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new Error(json.error ?? 'خطا در ایجاد کاربر')
  }
  const json = await res.json()
  return json.data
}

async function updateUser(id: string, data: UserFormValues): Promise<User> {
  const payload: Record<string, unknown> = {
    name: data.name,
    email: data.email || undefined,
    role: data.role,
    isActive: data.isActive,
    fieldId: data.fieldId || undefined,
    marketId: data.marketId || undefined,
  }
  if (data.password) payload.password = data.password
  const res = await fetch(`/api/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('خطا در ویرایش کاربر')
  const json = await res.json()
  return json.data
}

async function deleteUser(id: string): Promise<void> {
  const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('خطا در حذف کاربر')
}

export function UsersClient() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<User | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const { can } = usePermissions()
  const canCreate = can('user', 'create')
  const canEdit = can('user', 'update')
  const canDelete = can('user', 'delete')

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
  })

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setCreateOpen(false)
      setMutationError(null)
    },
    onError: (e: Error) => setMutationError(e.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UserFormValues }) => updateUser(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setEditTarget(null)
      setMutationError(null)
    },
    onError: (e: Error) => setMutationError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success('کاربر با موفقیت حذف شد')
    },
    onError: () => toast.error('خطا در حذف کاربر'),
  })

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">کاربران</h1>
        {canCreate && (
          <Button onClick={() => { setCreateOpen(true); setMutationError(null) }}>+ افزودن کاربر</Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">در حال بارگذاری...</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-gray-500">هیچ کاربری ثبت نشده است.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>نام کاربری</TableHead>
              <TableHead>نام</TableHead>
              <TableHead>نقش</TableHead>
              <TableHead>محدوده دسترسی</TableHead>
              <TableHead>وضعیت</TableHead>
              <TableHead>تاریخ ثبت</TableHead>
              {(canEdit || canDelete) && (
                <TableHead className="w-36">عملیات</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.username}</TableCell>
                <TableCell>{user.name}</TableCell>
                <TableCell>{roleLabels[user.role] ?? user.role}</TableCell>
                <TableCell className="text-sm text-gray-600">{scopeLabel(user)}</TableCell>
                <TableCell>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${user.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {user.isActive ? 'فعال' : 'غیرفعال'}
                  </span>
                </TableCell>
                <TableCell>{new Date(user.createdAt).toLocaleDateString('fa-IR')}</TableCell>
                {(canEdit || canDelete) && (
                  <TableCell>
                    <div className="flex gap-2">
                      {canEdit && (
                        <Button size="sm" variant="outline" onClick={() => { setEditTarget(user); setMutationError(null) }}>
                          ویرایش
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={deleteMutation.isPending}
                          onClick={() => setDeleteTarget(user)}
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
        description="آیا از حذف این کاربر مطمئن هستید؟ این عملیات قابل بازگشت نیست."
        isPending={deleteMutation.isPending}
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id) }}
      />

      {/* Create dialog */}
      {canCreate && (
        <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) setMutationError(null) }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>افزودن کاربر جدید</DialogTitle>
            </DialogHeader>
            {mutationError && createOpen && (
              <p className="text-sm text-red-500">{mutationError}</p>
            )}
            <UserForm
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
        <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) { setEditTarget(null); setMutationError(null) } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>ویرایش کاربر</DialogTitle>
            </DialogHeader>
            {mutationError && !!editTarget && (
              <p className="text-sm text-red-500">{mutationError}</p>
            )}
            {editTarget && (
              <UserForm
                isEdit
                defaultValues={{
                  username: editTarget.username,
                  name: editTarget.name,
                  email: editTarget.email ?? '',
                  role: editTarget.role,
                  isActive: editTarget.isActive,
                  fieldId: editTarget.scopes.find(s => s.scopeType === 'FIELD')?.fieldId ?? '',
                  marketId: editTarget.scopes.find(s => s.scopeType === 'MARKET')?.marketId ?? '',
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
