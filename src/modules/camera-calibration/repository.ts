import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import type { CreateCameraCalibrationDto } from './schema'

const include = { camera: { select: { id: true, name: true } } } as const

export const cameraCalibrationRepository = {
  findAll: (cameraIds: string[]) => db.cameraCalibration.findMany({
    where: { cameraId: { in: cameraIds } },
    include,
    orderBy: { createdAt: 'desc' },
  }),

  create: (data: CreateCameraCalibrationDto) => db.cameraCalibration.upsert({
    where: { serviceJobId: data.serviceJobId },
    create: { ...data, parameters: data.parameters as Prisma.InputJsonValue },
    update: {},
    include,
  }),
}
