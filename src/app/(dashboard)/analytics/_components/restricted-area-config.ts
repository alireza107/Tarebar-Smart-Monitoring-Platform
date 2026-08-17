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

export type QueueZoneConfig = {
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

type ConfiguredQueueConfigOptions = {
  cameraId: string
  points: Point[]
}

export function buildConfiguredQueueCameraYaml({
  cameraId,
  points,
}: ConfiguredQueueConfigOptions): string {
  if (!/^[A-Za-z0-9_.-]{1,100}$/.test(cameraId)) {
    throw new Error('Invalid camera ID')
  }
  if (points.length < 3) {
    throw new Error('A queue line requires at least three points')
  }

  return `camera:
  id: ${cameraId}
  name: Uploaded video
  source: uploaded-video

analytics:
  enabled:
    - queue
    - speed
  queues:
${renderQueueZone({ id: 'queue-line', points })}
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

/** Build the shared camera YAML used when live restricted-area and/or queue analytics run. */
export function buildCameraAnalyticsYaml(
  cameraId: string,
  cameraName: string,
  restrictedZones: RestrictedZoneConfig[],
  queueZones: QueueZoneConfig[],
): string {
  if (!/^[A-Za-z0-9_.-]{1,100}$/.test(cameraId)) throw new Error('Invalid camera ID')
  const validRestricted = restrictedZones.filter(zone => zone.points.length >= 3)
  const validQueues = queueZones.filter(zone => zone.points.length >= 3)
  if (validRestricted.length === 0 && validQueues.length === 0) {
    throw new Error('At least one analytics region requires three points')
  }

  const safeName = cameraName.replace(/[\r\n]/g, ' ').replace(/"/g, '\\"')
  const enabled = [
    ...(validRestricted.length ? ['restricted_area'] : []),
    ...(validQueues.length ? ['queue', 'speed'] : []),
  ].map(module => `    - ${module}`).join('\n')
  const restricted = validRestricted.length
    ? `  restricted_zones:\n${validRestricted.map(renderRestrictedZone).join('\n')}\n`
    : ''
  const queues = validQueues.length
    ? `  queues:\n${validQueues.map(renderQueueZone).join('\n')}\n`
    : ''

  return `camera:
  id: ${cameraId}
  name: "${safeName}"
  source: live-stream

analytics:
  enabled:
${enabled}
${restricted}${queues}`
}

function safeZoneId(id: string): string {
  return id.replace(/[\r\n"]/g, '')
}

function renderRestrictedZone(zone: RestrictedZoneConfig): string {
  return `    - id: "${safeZoneId(zone.id)}"
      points:
${yamlPoints(zone.points)}
      entry_dwell_seconds: 1
      exit_grace_seconds: 0.5
      alert_cooldown_seconds: 30`
}

function renderQueueZone(zone: QueueZoneConfig): string {
  const servicePoint = polygonCentroid(zone.points)
  return `    - id: "${safeZoneId(zone.id)}"
      polygon:
${yamlPoints(zone.points)}
      service_point:
        point: [${servicePoint.x}, ${servicePoint.y}]
        label: service
      overflow_threshold: 10
      minimum_dwell_seconds: 1
      maximum_speed_pixels_per_second: 80
      gap_tolerance_seconds: 1`
}

function polygonCentroid(points: Point[]): Point {
  const sum = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 })
  return {
    x: Number((sum.x / points.length).toFixed(6)),
    y: Number((sum.y / points.length).toFixed(6)),
  }
}
