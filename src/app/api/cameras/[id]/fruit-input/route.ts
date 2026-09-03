import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { forbidden, notFound, serverError, unauthorized, validationError } from '@/lib/api-responses'
import { checkPermission, PermissionError } from '@/lib/permissions'
import { assertCameraScope, ScopeError } from '@/lib/scope-guard'
import { logger } from '@/lib/logger'
import { cameraService } from '@/modules/camera/service'
import { deriveAnalyticsRtspUrl } from '@/modules/camera/stream'
import type { Role } from '@/lib/permissions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const requestSchema = z.object({
  allowUnsafeResize: z.boolean().default(false),
})

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'camera', 'read')

    const parsed = requestSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return validationError(parsed.error)

    const { id } = await params
    const camera = await cameraService.getById(id)
    if (!camera) return notFound()
    await assertCameraScope(session.user.id, session.user.role as Role, camera)
    if (!camera.streamUrl) {
      return NextResponse.json({ error: 'برای این دوربین آدرس استریم تنظیم نشده است' }, { status: 409 })
    }

    const fruitBase = (
      process.env.FRUIT_PIPELINE_API_URL ?? 'http://localhost:8010'
    ).replace(/\/+$/, '')
    const response = await fetch(`${fruitBase}/api/v1/stream-inputs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        camera_id: camera.id,
        stream_url: deriveAnalyticsRtspUrl(camera.streamUrl),
        allow_unsafe_resize: parsed.data.allowUnsafeResize,
      }),
      signal: AbortSignal.timeout(20_000),
    })
    const result: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      logger.warn({ cameraId: camera.id, status: response.status, result }, 'fruit live input rejected')
      return NextResponse.json(
        { error: 'دریافت فریم زنده برای تحلیل میوه ممکن نشد', detail: result },
        { status: response.status },
      )
    }
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof PermissionError || error instanceof ScopeError) return forbidden()
    logger.error({ err: error }, 'failed to prepare live fruit input')
    return serverError('دریافت فریم زنده برای تحلیل میوه ممکن نشد')
  }
}
