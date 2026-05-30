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
}
