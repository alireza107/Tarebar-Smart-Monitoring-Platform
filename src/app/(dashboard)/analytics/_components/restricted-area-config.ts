import type { Point } from '@/modules/region/geometry'

type RestrictedAreaConfigOptions = {
  cameraId: string
  points: Point[]
  entryDwellSeconds?: number
  exitGraceSeconds?: number
  alertCooldownSeconds?: number
}

export type RestrictedZoneConfig = {
  id: string
  points: Point[]
}

function yamlPoints(points: Point[]): string {
  return points.map(point => `        - [${point.x}, ${point.y}]`).join('\n')
}

export function buildRestrictedAreaCameraYaml({
  cameraId,
  points,
  entryDwellSeconds = 1,
  exitGraceSeconds = 0.5,
  alertCooldownSeconds = 30,
}: RestrictedAreaConfigOptions): string {
  if (!/^[A-Za-z0-9_.-]{1,100}$/.test(cameraId)) {
    throw new Error('Invalid camera ID')
  }
  if (points.length < 3) {
    throw new Error('A restricted area requires at least three points')
  }

  return `camera:
  id: ${cameraId}
  name: Uploaded video
  source: uploaded-video

analytics:
  enabled:
    - restricted_area
  restricted_zones:
    - id: restricted-area
      points:
${yamlPoints(points)}
      entry_dwell_seconds: ${entryDwellSeconds}
      exit_grace_seconds: ${exitGraceSeconds}
      alert_cooldown_seconds: ${alertCooldownSeconds}
`
}

export function buildRestrictedAreasCameraYaml(
  cameraId: string,
  cameraName: string,
  zones: RestrictedZoneConfig[],
): string {
  if (!/^[A-Za-z0-9_.-]{1,100}$/.test(cameraId)) throw new Error('Invalid camera ID')
  const validZones = zones.filter(zone => zone.points.length >= 3)
  if (validZones.length === 0) throw new Error('A restricted area requires at least three points')
  const safeName = cameraName.replace(/[\r\n]/g, ' ').replace(/"/g, '\\"')
  const renderedZones = validZones.map(zone => `    - id: "${zone.id.replace(/[\r\n"]/g, '')}"
      points:
${yamlPoints(zone.points)}
      entry_dwell_seconds: 1
      exit_grace_seconds: 0.5
      alert_cooldown_seconds: 30`).join('\n')
  return `camera:
  id: ${cameraId}
  name: "${safeName}"
  source: live-stream

analytics:
  enabled:
    - restricted_area
  restricted_zones:
${renderedZones}
`
}
