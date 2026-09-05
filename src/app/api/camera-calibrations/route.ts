import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { forbidden, unauthorized, validationError, serverError, notFound } from '@/lib/api-responses'
import { checkPermission, PermissionError, type Role } from '@/lib/permissions'
import { assertCameraScope, ScopeError } from '@/lib/scope-guard'
import { cameraService } from '@/modules/camera/service'
import { cameraCalibrationRepository } from '@/modules/camera-calibration/repository'
import { createCameraCalibrationSchema } from '@/modules/camera-calibration/schema'

export async function GET() {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'camera', 'read')
    const cameras = await cameraService.getAll(session.user.id, session.user.role as Role)
    const calibrations = await cameraCalibrationRepository.findAll(cameras.map(camera => camera.id))
    return NextResponse.json({ data: calibrations })
  } catch (error) {
    if (error instanceof PermissionError) return forbidden()
    return serverError()
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) return unauthorized()
    checkPermission(session, 'camera', 'update')
    const parsed = createCameraCalibrationSchema.safeParse(await request.json())
    if (!parsed.success) return validationError(parsed.error)
    const camera = await cameraService.getById(parsed.data.cameraId)
    if (!camera) return notFound('Camera not found')
    await assertCameraScope(session.user.id, session.user.role as Role, camera)
    const calibration = await cameraCalibrationRepository.create(parsed.data)
    return NextResponse.json({ data: calibration }, { status: 201 })
  } catch (error) {
    if (error instanceof PermissionError || error instanceof ScopeError) return forbidden()
    return serverError()
  }
}
