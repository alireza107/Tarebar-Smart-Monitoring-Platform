import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { forbidden, notFound, serverError, unauthorized, validationError } from '@/lib/api-responses'
import { checkPermission, PermissionError } from '@/lib/permissions'
import { assertCameraScope, ScopeError } from '@/lib/scope-guard'
import { logger } from '@/lib/logger'
import { cameraService } from '@/modules/camera/service'
import { deriveAnalyticsRtspUrl } from '@/modules/camera/stream'
import { db } from '@/lib/db'
import { buildCameraAnalyticsYaml } from '@/app/(dashboard)/analytics/_components/restricted-area-config'
import type { Point } from '@/modules/region/geometry'
import type { Role } from '@/lib/permissions'

export const runtime = 'nodejs'

const requestSchema = z.object({
  applicationId: z.string().min(1).optional(),
  applicationIds: z.array(z.enum(['people_counting', 'heatmap', 'vertical_queue', 'configured_queue', 'restricted_area']))
    .min(1)
    .max(5)
    .refine(values => new Set(values).size === values.length, 'Tasks must be unique')
    .optional(),
  maxFrames: z.number().int().positive().optional(),
  enableReid: z.boolean().default(false),
})

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'camera', 'read')

    const body = await req.json().catch(() => ({}))
    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error)

    const { id } = await params
    const camera = await cameraService.getById(id)
    if (!camera) return notFound()
    await assertCameraScope(session.user.id, session.user.role as Role, camera)
    if (!camera.streamUrl) {
      return NextResponse.json({ error: 'Camera has no RTSP stream URL' }, { status: 409 })
    }

    const restrictedRequested = parsed.data.applicationId === 'restricted_area' ||
      parsed.data.applicationIds?.includes('restricted_area')
    const queueRequested = parsed.data.applicationId === 'configured_queue' ||
      parsed.data.applicationIds?.includes('configured_queue')
    const mappings = restrictedRequested || queueRequested
      ? await db.cameraRegion.findMany({
          where: {
            cameraId: camera.id,
            deletedAt: null,
            region: {
              deletedAt: null,
              type: { in: [
                ...(restrictedRequested ? ['RESTRICTED_AREA' as const] : []),
                ...(queueRequested ? ['QUEUE' as const] : []),
              ] },
            },
          },
          select: { mainPolygon: true, region: { select: { id: true, name: true, type: true } } },
        })
      : []
    const restrictedMappings = mappings.filter(mapping => mapping.region.type === 'RESTRICTED_AREA')
    const queueMappings = mappings.filter(mapping => mapping.region.type === 'QUEUE')
    if (restrictedRequested && restrictedMappings.length === 0) {
      return NextResponse.json({ error: 'No restricted area is configured for this camera' }, { status: 409 })
    }
    if (queueRequested && queueMappings.length === 0) {
      return NextResponse.json({ error: 'No queue line is configured for this camera' }, { status: 409 })
    }
    const cameraConfigYaml = restrictedRequested || queueRequested
      ? buildCameraAnalyticsYaml(
          camera.id,
          camera.name,
          restrictedMappings.map(mapping => ({
            id: `restricted-${mapping.region.name}-${mapping.region.id.slice(-6)}`,
            points: mapping.mainPolygon as unknown as Point[],
          })),
          queueMappings.map(mapping => ({
            id: `queue-${mapping.region.name}-${mapping.region.id.slice(-6)}`,
          points: mapping.mainPolygon as unknown as Point[],
          })),
        )
      : undefined

    const analyticsBase = (
      process.env.VIDEO_ANALYTICS_API_URL ?? 'http://localhost:8000'
    ).replace(/\/+$/, '')
    const response = await fetch(`${analyticsBase}/api/v1/stream-jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stream_url: deriveAnalyticsRtspUrl(camera.streamUrl),
        application_id: parsed.data.applicationIds ? undefined : (parsed.data.applicationId ?? 'people_counting'),
        application_ids: parsed.data.applicationIds,
        camera_id: camera.id,
        max_frames: parsed.data.maxFrames,
        enable_reid: parsed.data.enableReid,
        camera_config_yaml: cameraConfigYaml,
      }),
      signal: AbortSignal.timeout(10_000),
    })
    const result: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      logger.warn({ cameraId: camera.id, status: response.status, result }, 'live analytics job rejected')
      return NextResponse.json(
        { error: 'Video analytics service rejected the live stream', detail: result },
        { status: response.status },
      )
    }
    return NextResponse.json(result, { status: 202 })
  } catch (error) {
    if (error instanceof PermissionError || error instanceof ScopeError) return forbidden()
    logger.error({ err: error }, 'failed to start live camera analytics')
    return serverError()
  }
}
