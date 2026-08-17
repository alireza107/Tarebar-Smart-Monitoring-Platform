import { db } from '@/lib/db'
import type { CreateCameraDto, UpdateCameraDto } from './schema'

const include = {
  field:  { select: { id: true, name: true } },
  market: { select: { id: true, name: true } },
  booth:  { select: { id: true, number: true } },
  _count: { select: { regions: { where: { deletedAt: null } } } },
  regions: {
    where: { deletedAt: null, region: { deletedAt: null } },
    select: { region: { select: { type: true } } },
  },
} as const

// The snapshot is a base64 JPEG data URL and can be tens/hundreds of KB —
// keep it out of list/detail responses that don't need it.
const omitSnapshot = { snapshotDataUrl: true, snapshotUpdatedAt: true } as const

export const cameraRepository = {
  findAll: () =>
    db.camera.findMany({
      where: { deletedAt: null },
      include,
      omit: omitSnapshot,
      orderBy: { createdAt: 'desc' },
    }),

  findByFieldIds: (fieldIds: string[]) =>
    db.camera.findMany({
      where: { fieldId: { in: fieldIds }, deletedAt: null },
      include,
      omit: omitSnapshot,
      orderBy: { createdAt: 'desc' },
    }),

  findByMarketIds: (marketIds: string[]) =>
    db.camera.findMany({
      where: { marketId: { in: marketIds }, deletedAt: null },
      include,
      omit: omitSnapshot,
      orderBy: { createdAt: 'desc' },
    }),

  findById: (id: string) =>
    db.camera.findFirst({ where: { id, deletedAt: null }, include, omit: omitSnapshot }),

  getSnapshot: (id: string) =>
    db.camera.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, snapshotDataUrl: true, snapshotUpdatedAt: true },
    }),

  updateSnapshot: (id: string, dataUrl: string) =>
    db.camera.update({
      where: { id },
      data: { snapshotDataUrl: dataUrl, snapshotUpdatedAt: new Date() },
      select: { id: true, snapshotUpdatedAt: true },
    }),

  create: (data: CreateCameraDto) =>
    db.camera.create({
      data: { ...data, streamUrl: data.streamUrl || null },
      include,
    }),

  update: (id: string, data: UpdateCameraDto) =>
    db.camera.update({
      where: { id },
      data: {
        ...data,
        streamUrl: data.streamUrl === '' ? null : data.streamUrl,
      },
      include,
    }),

  softDelete: (id: string) =>
    db.camera.update({ where: { id }, data: { deletedAt: new Date() } }),

  // Sets streamUrl to the MediaMTX path the video-analytics service is
  // republishing the uploaded video to. sourceType is only ever set here (as
  // a side effect of an actual successful upload), never accepted as a
  // freeform field on the regular update() call.
  attachVideoSource: (id: string, data: { streamUrl: string; videoFileName: string }) =>
    db.camera.update({
      where: { id },
      data: {
        streamUrl: data.streamUrl,
        sourceType: 'VIDEO_FILE',
        videoFileName: data.videoFileName,
        videoUploadedAt: new Date(),
        // Let the next health-probe cycle decide; don't guess ONLINE here.
        status: 'UNKNOWN',
      },
      include,
    }),

  detachVideoSource: (id: string) =>
    db.camera.update({
      where: { id },
      data: { sourceType: 'RTSP', videoFileName: null, videoUploadedAt: null },
      include,
    }),

  getUserFieldIds: (userId: string) =>
    db.userScope
      .findMany({ where: { userId, scopeType: 'FIELD' }, select: { fieldId: true } })
      .then(scopes => scopes.map(s => s.fieldId).filter((id): id is string => id !== null)),

  getUserMarketIds: (userId: string) =>
    db.userScope
      .findMany({ where: { userId, scopeType: 'MARKET' }, select: { marketId: true } })
      .then(scopes => scopes.map(s => s.marketId).filter((id): id is string => id !== null)),
}
