import { create } from 'zustand'
import { addDays, businessDate } from '@/lib/dates'
import type { ManagementFilters, ManagementLocationType, ManagementPlaceType } from '@/modules/management-analytics/types'

function initialDates() {
  // "Today" is the business day in Tehran, not the UTC date.
  const to = businessDate()
  return { from: addDays(to, -6), to }
}

interface ManagementFilterStore extends ManagementFilters {
  setLocation: (locationType: ManagementLocationType, locationId?: string) => void
  setPlaceType: (placeType: ManagementPlaceType) => void
  setDateRange: (from: string, to: string) => void
  setComparison: (comparison: ManagementFilters['comparison']) => void
  setTimeRange: (timeFrom?: string, timeTo?: string) => void
}

export const useManagementFilters = create<ManagementFilterStore>((set) => ({
  locationType: 'organization',
  placeType: 'all',
  comparison: 'previous_period',
  ...initialDates(),
  setLocation: (locationType, locationId) => set({ locationType, locationId }),
  setPlaceType: (placeType) => set({ placeType }),
  setDateRange: (from, to) => set({ from, to }),
  setComparison: (comparison) => set({ comparison }),
  setTimeRange: (timeFrom, timeTo) => set({ timeFrom, timeTo }),
}))

export function selectManagementFilters(state: ManagementFilterStore): ManagementFilters {
  return {
    locationType: state.locationType,
    locationId: state.locationId,
    placeType: state.placeType,
    from: state.from,
    to: state.to,
    comparison: state.comparison,
    timeFrom: state.timeFrom,
    timeTo: state.timeTo,
  }
}

