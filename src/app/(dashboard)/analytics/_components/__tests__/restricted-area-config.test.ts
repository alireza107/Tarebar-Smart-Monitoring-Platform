import { describe, expect, it } from 'vitest'
import { buildRestrictedAreaCameraYaml } from '../restricted-area-config'

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
