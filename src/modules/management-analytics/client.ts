import type { LocationHierarchy, ManagementFilters, ManagementOverview, PeopleFlowAnalytics, QueueAnalytics, SpatialAnalytics, TimeBucket } from './types'

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

function queryFor(filters: ManagementFilters, bucket: TimeBucket) {
  const query = new URLSearchParams({ bucket })
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value))
  })
  return query
}

async function fetchModule<T>(module: 'people-flow' | 'queues' | 'spatial', filters: ManagementFilters, bucket: TimeBucket): Promise<T> {
  const response = await fetch(`/api/management/${module}?${queryFor(filters, bucket)}`)
  if (!response.ok) throw new Error('خطا در دریافت داده تحلیلی')
  const body = await response.json() as { data: T }
  return body.data
}

export const fetchPeopleFlow = (filters: ManagementFilters, bucket: TimeBucket) => fetchModule<PeopleFlowAnalytics>('people-flow', filters, bucket)
export const fetchQueueAnalytics = (filters: ManagementFilters, bucket: TimeBucket) => fetchModule<QueueAnalytics>('queues', filters, bucket)
export const fetchSpatialAnalytics = (filters: ManagementFilters, bucket: TimeBucket) => fetchModule<SpatialAnalytics>('spatial', filters, bucket)

export type FleetLiveStatus = {
  enabled: boolean
  fps: number
  cameras: number
  running: number
  lastError?: string | null
  workers: Array<{
    cameraId: string
    name: string
    marketId: string | null
    fieldId: string | null
    status: string
    processedFrames: number
    currentPeople?: number | null
    queueLength?: number | null
    lastError?: string | null
  }>
}

export async function fetchFleetLive(): Promise<FleetLiveStatus> {
  const response = await fetch('/api/management/live')
  if (!response.ok) throw new Error('خطا در دریافت وضعیت زنده')
  const body = await response.json() as { data: FleetLiveStatus }
  return body.data
}
