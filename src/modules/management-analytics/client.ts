import type { LocationHierarchy, ManagementFilters, ManagementOverview } from './types'

export async function fetchManagementLocations(): Promise<LocationHierarchy> {
  const response = await fetch('/api/management/locations')
  if (!response.ok) throw new Error('خطا در دریافت مکان‌ها')
  const body = await response.json() as { data: LocationHierarchy }
  return body.data
}

export async function fetchManagementOverview(filters: ManagementFilters): Promise<ManagementOverview> {
  const query = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value))
  })
  const response = await fetch(`/api/management/overview?${query}`)
  if (!response.ok) throw new Error('خطا در دریافت تحلیل مدیریتی')
  const body = await response.json() as { data: ManagementOverview }
  return body.data
}

