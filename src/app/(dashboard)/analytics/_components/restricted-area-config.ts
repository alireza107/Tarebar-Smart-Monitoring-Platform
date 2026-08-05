import type { Point } from '@/modules/region/geometry'

type RestrictedAreaConfigOptions = {
  cameraId: string
  points: Point[]
  entryDwellSeconds?: number
  exitGraceSeconds?: number
  alertCooldownSeconds?: number
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
