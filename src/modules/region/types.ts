import type { Point } from './geometry'

export interface CameraRegionMapping {
  id: string
  cameraId: string
  regionId: string
  mainPolygon: Point[]
  exclusionPolygons: Point[][]
  camera: { id: string; name: string; status: string } | null
  createdAt: Date
  updatedAt: Date
}

export interface RegionBoothLink {
  id: string
  boothId: string
  booth: { id: string; number: string; market: { id: string; name: string } } | null
}

export interface RegionSummary {
  id: string
  name: string
  description: string | null
  color: string | null
  marketId: string
  market: { id: string; name: string; fieldId: string } | null
  cameraCount: number
  boothCount: number
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export interface RegionDetail extends RegionSummary {
  cameraRegions: CameraRegionMapping[]
  booths: RegionBoothLink[]
}
