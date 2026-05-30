export type CameraStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN'

export interface Camera {
  id: string
  name: string
  streamUrl: string | null
  status: CameraStatus
  fieldId: string | null
  marketId: string | null
  boothId: string | null
  field: { id: string; name: string } | null
  market: { id: string; name: string } | null
  booth: { id: string; number: string } | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}
