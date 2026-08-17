import { describe, expect, it } from 'vitest'
import {
  buildCameraAnalyticsYaml,
  buildConfiguredQueueCameraYaml,
  buildRestrictedAreaCameraYaml,
  buildRestrictedAreasCameraYaml,
} from '../restricted-area-config'

describe('buildRestrictedAreaCameraYaml', () => {
  it('converts normalized dashboard points into restricted-area YAML', () => {
    const yaml = buildRestrictedAreaCameraYaml({
      cameraId: 'camera-01',
      points: [
        { x: 0.1, y: 0.2 },
        { x: 0.8, y: 0.2 },
        { x: 0.5, y: 0.9 },
      ],
    })

    expect(yaml).toContain('id: camera-01')
    expect(yaml).toContain('    - restricted_area')
    expect(yaml).toContain('        - [0.1, 0.2]')
    expect(yaml).toContain('      entry_dwell_seconds: 1')
  })

  it('rejects an incomplete polygon', () => {
    expect(() =>
      buildRestrictedAreaCameraYaml({
        cameraId: 'camera-01',
        points: [{ x: 0.1, y: 0.2 }, { x: 0.8, y: 0.2 }],
      }),
    ).toThrow('at least three points')
  })
})

describe('buildConfiguredQueueCameraYaml', () => {
  it('converts normalized dashboard points into configured-queue YAML', () => {
    const yaml = buildConfiguredQueueCameraYaml({
      cameraId: 'camera-01',
      points: [
        { x: 0.12, y: 0.42 },
        { x: 0.54, y: 0.42 },
        { x: 0.61, y: 0.90 },
        { x: 0.08, y: 0.90 },
      ],
    })

    expect(yaml).toContain('id: camera-01')
    expect(yaml).toContain('    - queue')
    expect(yaml).toContain('    - speed')
    expect(yaml).toContain('  queues:')
    expect(yaml).toContain('    - id: "queue-line"')
    expect(yaml).toContain('      polygon:')
    expect(yaml).toContain('        - [0.12, 0.42]')
    expect(yaml).toContain('        point: [0.3375, 0.66]')
    expect(yaml).toContain('      overflow_threshold: 10')
  })

  it('rejects an incomplete queue polygon', () => {
    expect(() =>
      buildConfiguredQueueCameraYaml({
        cameraId: 'camera-01',
        points: [{ x: 0.1, y: 0.2 }, { x: 0.8, y: 0.2 }],
      }),
    ).toThrow('at least three points')
  })
})

describe('buildCameraAnalyticsYaml', () => {
  it('serializes restricted and configured queue regions into one live config', () => {
    const triangle = [{ x: 0.1, y: 0.1 }, { x: 0.7, y: 0.1 }, { x: 0.4, y: 0.7 }]
    const yaml = buildCameraAnalyticsYaml(
      'camera-01',
      'Entrance',
      [{ id: 'restricted-1', points: triangle }],
      [{ id: 'queue-1', points: triangle }],
    )

    expect(yaml).toContain('    - restricted_area')
    expect(yaml).toContain('    - queue')
    expect(yaml).toContain('    - speed')
    expect(yaml).toContain('  restricted_zones:')
    expect(yaml).toContain('  queues:')
    expect(yaml).toContain('      overflow_threshold: 10')
    expect(yaml).toContain('        point: [0.4, 0.3]')
  })
})

describe('buildRestrictedAreasCameraYaml', () => {
  it('serializes every saved camera region for live restricted-area analytics', () => {
    const yaml = buildRestrictedAreasCameraYaml('camera-01', 'Entrance camera', [
      { id: 'Loading zone', points: [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.1 }, { x: 0.3, y: 0.5 }] },
      { id: 'Back room', points: [{ x: 0.6, y: 0.4 }, { x: 0.9, y: 0.4 }, { x: 0.8, y: 0.8 }] },
    ])

    expect(yaml).toContain('id: "Loading zone"')
    expect(yaml).toContain('id: "Back room"')
    expect(yaml.match(/entry_dwell_seconds/g)).toHaveLength(2)
  })
})
