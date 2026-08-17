'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, ChevronDown, Clock3, MapPin, SlidersHorizontal } from 'lucide-react'
import { fetchManagementLocations } from '@/modules/management-analytics/client'
import type { ManagementLocationType } from '@/modules/management-analytics/types'
import { useManagementFilters } from '@/stores/management-filters'

const fieldClass = 'h-9 rounded-lg border border-input bg-background px-3 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring/30'

export function GlobalFilterBar({
  locationOverride,
  onLocationChange,
}: {
  locationOverride?: { type: ManagementLocationType; id?: string }
  onLocationChange?: (type: ManagementLocationType, id?: string) => void
} = {}) {
  const [showTime, setShowTime] = useState(false)
  const filters = useManagementFilters()
  const { data, isLoading } = useQuery({
    queryKey: ['management-locations'],
    queryFn: fetchManagementLocations,
    staleTime: 5 * 60_000,
  })

  const options = data
    ? [data.organization, ...data.fields, ...data.markets, ...data.booths]
    : []
  const effectiveLocation = locationOverride ?? { type: filters.locationType, id: filters.locationId }
  const selectedLocation = effectiveLocation.type === 'organization'
    ? 'organization'
    : `${effectiveLocation.type}:${effectiveLocation.id}`

  return (
    <section aria-label="فیلترهای سراسری" className="rounded-xl border bg-card p-3 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        <FilterField label="مکان" icon={MapPin} className="min-w-52 flex-1">
          <div className="relative">
            <select
              aria-label="مکان"
              disabled={isLoading}
              value={selectedLocation}
              onChange={(event) => {
                const value = event.target.value
                const separatorIndex = value.indexOf(':')
                const type = (separatorIndex === -1 ? value : value.slice(0, separatorIndex)) as ManagementLocationType
                const id = separatorIndex === -1 ? undefined : value.slice(separatorIndex + 1)
                if (onLocationChange) onLocationChange(type, id)
                else filters.setLocation(type, id)
              }}
              className={`${fieldClass} w-full appearance-none pl-8`}
            >
              {options.map((location) => (
                <option key={`${location.type}:${location.id}`} value={location.type === 'organization' ? 'organization' : `${location.type}:${location.id}`}>
                  {location.type === 'organization' ? location.name : `${location.name}${location.parentName ? ` · ${location.parentName}` : ''}`}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          </div>
        </FilterField>

        <FilterField label="نوع مکان" icon={SlidersHorizontal}>
          <select aria-label="نوع مکان" value={filters.placeType} onChange={(event) => filters.setPlaceType(event.target.value as typeof filters.placeType)} className={`${fieldClass} min-w-32`}>
            <option value="all">همه سطوح</option>
            <option value="field">میدان</option>
            <option value="market">بازار</option>
            <option value="booth">غرفه</option>
          </select>
        </FilterField>

        <FilterField label="بازه تاریخ" icon={CalendarDays}>
          <div className="flex items-center gap-1.5" dir="ltr">
            <input aria-label="از تاریخ" type="date" value={filters.from} max={filters.to} onChange={(event) => filters.setDateRange(event.target.value, filters.to)} className={`${fieldClass} w-32`} />
            <span className="text-xs text-muted-foreground">—</span>
            <input aria-label="تا تاریخ" type="date" value={filters.to} min={filters.from} onChange={(event) => filters.setDateRange(filters.from, event.target.value)} className={`${fieldClass} w-32`} />
          </div>
        </FilterField>

        <FilterField label="مقایسه با">
          <select aria-label="دوره مقایسه" value={filters.comparison} onChange={(event) => filters.setComparison(event.target.value as typeof filters.comparison)} className={`${fieldClass} min-w-36`}>
            <option value="previous_period">دوره قبل</option>
            <option value="previous_week">هفته قبل</option>
            <option value="previous_month">ماه قبل</option>
            <option value="none">بدون مقایسه</option>
          </select>
        </FilterField>

        <button type="button" onClick={() => { setShowTime((value) => !value); if (showTime) filters.setTimeRange() }} className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-xs transition ${showTime ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent'}`}>
          <Clock3 className="size-4" /> ساعت روز
        </button>

        {showTime && (
          <div className="flex items-center gap-1.5" dir="ltr">
            <input aria-label="از ساعت" type="time" value={filters.timeFrom ?? '06:00'} onChange={(event) => filters.setTimeRange(event.target.value, filters.timeTo ?? '22:00')} className={`${fieldClass} w-28`} />
            <span className="text-xs text-muted-foreground">—</span>
            <input aria-label="تا ساعت" type="time" value={filters.timeTo ?? '22:00'} onChange={(event) => filters.setTimeRange(filters.timeFrom ?? '06:00', event.target.value)} className={`${fieldClass} w-28`} />
          </div>
        )}
      </div>
    </section>
  )
}

function FilterField({ label, icon: Icon, className = '', children }: { label: string; icon?: React.ComponentType<{ className?: string }>; className?: string; children: React.ReactNode }) {
  return (
    <label className={`space-y-1.5 ${className}`}>
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        {Icon && <Icon className="size-3.5" />}{label}
      </span>
      {children}
    </label>
  )
}
