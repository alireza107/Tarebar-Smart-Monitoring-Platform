'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Store, Check } from 'lucide-react'
import type { RegionDetail } from '@/modules/region/types'

interface Booth {
  id: string
  number: string
  market: { id: string; name: string }
}

interface Props {
  region: RegionDetail
  canEdit: boolean
}

export function StallMappingPanel({ region, canEdit }: Props) {
  const qc = useQueryClient()
  const initial = useMemo(() => new Set(region.booths.map(b => b.boothId)), [region.booths])
  const [selected, setSelected] = useState<Set<string>>(initial)
  const [query, setQuery] = useState('')
  const [sameMarketOnly, setSameMarketOnly] = useState(true)

  const { data: booths = [], isLoading } = useQuery<Booth[]>({
    queryKey: ['booths-select'],
    queryFn: () => fetch('/api/booths').then(r => r.json()).then(j => j.data),
  })

  const saveMutation = useMutation({
    mutationFn: (boothIds: string[]) =>
      fetch(`/api/regions/${region.id}/stalls`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boothIds }),
      }).then(r => { if (!r.ok) throw new Error('خطا در ذخیره غرفه‌ها') }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['region', region.id] })
      qc.invalidateQueries({ queryKey: ['regions'] })
      toast.success('غرفه‌های منطقه ذخیره شد')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const visible = booths
    .filter(b => (sameMarketOnly ? b.market.id === region.marketId : true))
    .filter(b => {
      if (!query) return true
      const q = query.toLowerCase()
      return b.number.toLowerCase().includes(q) || b.market.name.toLowerCase().includes(q)
    })

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const dirty =
    selected.size !== initial.size || [...selected].some(id => !initial.has(id))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="جستجوی غرفه..."
          className="max-w-48"
        />
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={sameMarketOnly} onChange={e => setSameMarketOnly(e.target.checked)} />
          فقط غرفه‌های همین بازار
        </label>
        <span className="mr-auto text-xs text-muted-foreground">{selected.size} غرفه انتخاب شده</span>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">در حال بارگذاری...</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">غرفه‌ای یافت نشد.</p>
      ) : (
        <ul className="grid max-h-72 grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-input p-1 sm:grid-cols-2">
          {visible.map(b => {
            const on = selected.has(b.id)
            return (
              <li key={b.id}>
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => toggle(b.id)}
                  className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-right text-sm transition-colors disabled:cursor-not-allowed ${
                    on ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'hover:bg-muted'
                  }`}
                >
                  <span className={`flex size-4 shrink-0 items-center justify-center rounded border ${on ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-input'}`}>
                    {on && <Check className="size-3" />}
                  </span>
                  <Store className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">غرفه {b.number}</span>
                  <span className="text-xs text-muted-foreground">{b.market.name}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {canEdit && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" disabled={!dirty || saveMutation.isPending} onClick={() => setSelected(new Set(initial))}>
            بازنشانی
          </Button>
          <Button size="sm" disabled={!dirty || saveMutation.isPending} onClick={() => saveMutation.mutate([...selected])}>
            {saveMutation.isPending ? 'در حال ذخیره...' : 'ذخیره غرفه‌ها'}
          </Button>
        </div>
      )}
    </div>
  )
}
