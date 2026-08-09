export interface CameraStatusSummary {
  online: number
  offline: number
  unknown: number
  total: number
}

export interface CamerasByFieldRow {
  fieldId: string
  fieldName: string
  total: number
  online: number
  offline: number
  unknown: number
}

export interface BoothsByMarketRow {
  marketId: string
  marketName: string
  fieldName: string
  total: number
}

export interface ReportsData {
  cameraStatus: CameraStatusSummary
  camerasByField: CamerasByFieldRow[]
  boothsByMarket: BoothsByMarketRow[]
  restrictedAreaEvents: RestrictedAreaEvent[]
}

export interface RestrictedAreaEvent {
  event_id: string
  event_type: 'restricted_area_entered' | 'restricted_area_exited'
  camera_id: string
  camera_name: string
  timestamp: number
  track_id: number | null
  zone_id: string | null
  payload: Record<string, unknown> | null
}
