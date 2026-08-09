import { describe, expect, it } from 'vitest'
import { buildRestrictedAreaCameraYaml, buildRestrictedAreasCameraYaml } from '../restricted-area-config'

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
