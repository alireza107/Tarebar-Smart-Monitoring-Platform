import { afterEach, describe, expect, it } from 'vitest'
import { deriveAnalyticsRtspUrl, deriveHlsUrl, derivePlaybackUrls, streamPath } from '../stream'

const ORIGINAL_WEBRTC = process.env.NEXT_PUBLIC_MEDIAMTX_WEBRTC_URL
const ORIGINAL_HLS = process.env.NEXT_PUBLIC_MEDIAMTX_HLS_URL
const ORIGINAL_RTSP = process.env.MEDIAMTX_RTSP_URL

afterEach(() => {
  process.env.NEXT_PUBLIC_MEDIAMTX_WEBRTC_URL = ORIGINAL_WEBRTC
  process.env.NEXT_PUBLIC_MEDIAMTX_HLS_URL = ORIGINAL_HLS
  process.env.MEDIAMTX_RTSP_URL = ORIGINAL_RTSP
})

describe('MediaMTX stream URL mapping', () => {
  it('uses public browser bases while preserving the RTSP path', () => {
    process.env.NEXT_PUBLIC_MEDIAMTX_WEBRTC_URL = 'https://media.example.test/webrtc/'
    process.env.NEXT_PUBLIC_MEDIAMTX_HLS_URL = 'https://media.example.test/hls/'

    expect(derivePlaybackUrls('rtsp://mediamtx:8554/mobile-1')).toEqual({
      whep: 'https://media.example.test/webrtc/mobile-1/whep',
      hls: 'https://media.example.test/hls/mobile-1/index.m3u8',
    })
  })

  it('supports nested paths and existing HLS URLs', () => {
    expect(streamPath('rtsp://localhost:8554/market/entrance')).toBe('market/entrance')
    expect(deriveHlsUrl('https://media.example.test/live/index.m3u8')).toBe(
      'https://media.example.test/live/index.m3u8',
    )
  })

  it('rejects missing and non-RTSP playback sources', () => {
    expect(derivePlaybackUrls(null)).toBeNull()
    expect(derivePlaybackUrls('https://example.test/video.mp4')).toBeNull()
  })

  it('translates only local MediaMTX URLs for the analytics container', () => {
    process.env.MEDIAMTX_RTSP_URL = 'rtsp://mediamtx:8554'

    expect(deriveAnalyticsRtspUrl('rtsp://localhost:8554/mobile-1')).toBe(
      'rtsp://mediamtx:8554/mobile-1',
    )
    expect(deriveAnalyticsRtspUrl('rtsp://10.0.0.50/live')).toBe(
      'rtsp://10.0.0.50/live',
    )
  })
})
