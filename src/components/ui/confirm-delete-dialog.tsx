'use client'

import { AlertTriangleIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog'

interface ConfirmDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  isPending?: boolean
  onConfirm: () => void
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title = 'تأیید حذف',
  description = 'آیا از حذف این مورد مطمئن هستید؟ این عملیات قابل بازگشت نیست.',
  isPending = false,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangleIcon className="size-5" />
            </span>
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription className="pt-1">{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="destructive"
            disabled={isPending}
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            {isPending ? 'در حال حذف...' : 'بله، حذف کن'}
          </Button>
          <DialogClose render={<Button variant="outline" disabled={isPending} />}>
            انصراف
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
