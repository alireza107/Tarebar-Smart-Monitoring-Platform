import { Prisma } from '@prisma/client'
import { resolveLocation, type LocationRef } from '@/lib/location'
import { logger } from '@/lib/logger'
import type { Role } from '@/lib/permissions'
import { analysisRecordRepository, filterWhere, visibilityWhere, type RecordWhere } from './repository'
import type {
  CreateMeasurementRunDto,
  FruitQualityResultInput,
  IncidentResultInput,
  RecordQuery,
} from './schema'
import { gradeForScore, type QualityDetails, type QualityThumbnail } from './types'

export interface RecordActor {
  id: string
  name?: string | null
}

export interface RecordTarget extends LocationRef {
  cameraId?: string | null
}

export interface RecordQualityInput {
  actor: RecordActor
  source: 'LIVE' | 'UPLOAD'
  target: RecordTarget
  fileName?: string | null
  result: FruitQualityResultInput
}

export interface RecordIncidentInput {
  actor: RecordActor
  source: 'LIVE' | 'UPLOAD'
  target: RecordTarget
  fileName?: string | null
  windowLabel?: string | null
  windowSeconds?: number | null
  result: IncidentResultInput
}

const MAX_STORED_THUMBNAILS = 8

function splitQualityResult(result: FruitQualityResultInput): {
  details: QualityDetails
  thumbnails: QualityThumbnail[]
} {
  const frames = result.frames ?? []
  return {
    details: {
      analysisVersion: result.analysis_version ?? null,
      verdictFa: result.verdict_fa ?? null,
      fruitTypes: result.fruit_types ?? [],
      defects: result.defects ?? [],
      shelfLifeDaysEstimate: result.shelf_life_days_estimate ?? null,
      storageAdviceFa: result.storage_advice_fa ?? null,
      qualityProfile: result.quality_profile ?? [],
      frameStatistics: result.frame_statistics ?? null,
      frames: frames.map(frame => ({
        index: frame.index,
        timestamp_seconds: frame.timestamp_seconds ?? null,
        has_fruit: frame.has_fruit ?? null,
        freshness_score: frame.freshness_score ?? null,
        label: frame.label ?? null,
        note_fa: frame.note_fa ?? null,
        error: frame.error ?? null,
      })),
      totalSeconds: result.total_seconds ?? null,
    },
    thumbnails: frames
      .flatMap(frame =>
        frame.thumbnail
          ? [{ index: frame.index, timestampSeconds: frame.timestamp_seconds ?? null, dataUrl: frame.thumbnail }]
          : [],
      )
      .slice(0, MAX_STORED_THUMBNAILS),
  }
}

async function scopedWhere(userId: string, role: Role, query: RecordQuery): Promise<RecordWhere> {
  return { AND: [await visibilityWhere(userId, role), filterWhere(query)] }
}

export const analysisRecordService = {
  async recordQuality(input: RecordQualityInput) {
    const location = await resolveLocation(input.target)
    const { details, thumbnails } = splitQualityResult(input.result)
    const result = input.result
    return analysisRecordRepository.createQuality({
      source: input.source,
      cameraId: input.target.cameraId ?? null,
      ...location,
      fileName: input.fileName ?? null,
      hasFruit: result.has_fruit,
      label: result.label,
      grade: result.grade ?? gradeForScore(result.freshness_score, result.has_fruit),
      freshnessScore: Math.round(result.freshness_score),
      confidence: Math.round(result.confidence),
      freshPercent: Math.round(result.distribution.fresh),
      middlePercent: Math.round(result.distribution.middle),
      rottenPercent: Math.round(result.distribution.rotten),
      fruitCountEstimate: result.fruit_count_estimate,
      summaryFa: result.summary_fa,
      recommendationFa: result.recommendation_fa ?? null,
      detailLevel: result.detail_level ?? 'summary',
      details: details as unknown as Prisma.InputJsonValue,
      thumbnails: thumbnails.length ? (thumbnails as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      frameCount: result.frame_count,
      inferenceSeconds: result.inference_seconds,
      modelName: result.model ?? null,
      createdById: input.actor.id,
      createdByName: input.actor.name ?? null,
    })
  },

  /** Persisting a result must never fail the analysis response the user is waiting for. */
  async recordQualitySafely(input: RecordQualityInput) {
    try {
      return await analysisRecordService.recordQuality(input)
    } catch (err) {
      logger.error({ err }, 'failed to store fruit quality assessment')
      return null
    }
  },

  async recordIncident(input: RecordIncidentInput) {
    const location = await resolveLocation(input.target)
    const fighting = input.result.answers.fighting === 'Yes'
    const floorClean = input.result.answers.floor_clean === 'Yes'
    return analysisRecordRepository.createIncident({
      source: input.source,
      cameraId: input.target.cameraId ?? null,
      ...location,
      fileName: input.fileName ?? null,
      fighting,
      floorClean,
      windowLabel: input.windowLabel ?? null,
      windowSeconds: input.windowSeconds ?? null,
      frameCount: input.result.frame_count ?? 0,
      inferenceSeconds: input.result.inference_seconds,
      // Evidence is only worth its storage when something needs attention.
      thumbnail: fighting || !floorClean ? input.result.thumbnail ?? null : null,
      modelName: input.result.model ?? null,
      createdById: input.actor.id,
      createdByName: input.actor.name ?? null,
    })
  },

  async recordIncidentSafely(input: RecordIncidentInput) {
    try {
      return await analysisRecordService.recordIncident(input)
    } catch (err) {
      logger.error({ err }, 'failed to store incident check')
      return null
    }
  },

  async recordMeasurementRun(actor: RecordActor, target: RecordTarget, data: CreateMeasurementRunDto) {
    const location = await resolveLocation(target)
    return analysisRecordRepository.upsertMeasurementRun({
      source: data.source,
      cameraId: data.cameraId,
      ...location,
      serviceJobId: data.serviceJobId,
      processingMode: data.processingMode ?? null,
      palletType: data.palletType ?? null,
      processedFrames: data.processedFrames,
      totalFruitObservations: data.totalFruitObservations,
      lastFruitCount: data.lastFruitCount ?? null,
      avgWidthMm: data.avgWidthMm ?? null,
      avgLengthMm: data.avgLengthMm ?? null,
      avgDiameterMm: data.avgDiameterMm ?? null,
      sizeStatistics: data.sizeStatistics
        ? (data.sizeStatistics as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      createdById: actor.id,
      createdByName: actor.name ?? null,
    })
  },

  async listQuality(userId: string, role: Role, query: RecordQuery) {
    const where = await scopedWhere(userId, role, query)
    const [items, total] = await Promise.all([
      analysisRecordRepository.listQuality(where, query.limit, query.offset),
      analysisRecordRepository.countQuality(where),
    ])
    return { items, total }
  },

  /** Detail incl. evidence thumbnails, or null when the row is outside the caller's visibility. */
  async getQuality(userId: string, role: Role, id: string) {
    const record = await analysisRecordRepository.findQualityById(id)
    if (!record) return null
    return isVisible(await visibilityWhere(userId, role), record) ? record : null
  },

  async listIncidents(userId: string, role: Role, query: RecordQuery, withThumbnail = false) {
    const where = await scopedWhere(userId, role, query)
    const [items, total] = await Promise.all([
      analysisRecordRepository.listIncidents(where, query.limit, query.offset, withThumbnail),
      analysisRecordRepository.countIncidents(where),
    ])
    return { items, total }
  },

  async listMeasurementRuns(userId: string, role: Role, query: RecordQuery) {
    const where = await scopedWhere(userId, role, query)
    const [items, total] = await Promise.all([
      analysisRecordRepository.listMeasurementRuns(where, query.limit, query.offset),
      analysisRecordRepository.countMeasurementRuns(where),
    ])
    return { items, total }
  },
}

/** Evaluate a visibility filter against one already-loaded row. */
function isVisible(
  where: RecordWhere,
  row: { fieldId: string | null; marketId: string | null; createdById: string | null },
): boolean {
  if (!where.OR) return true
  return where.OR.some(clause => {
    if (clause.createdById) return clause.createdById === row.createdById
    if (clause.fieldId && typeof clause.fieldId === 'object') {
      return row.fieldId !== null && clause.fieldId.in.includes(row.fieldId)
    }
    if (clause.marketId && typeof clause.marketId === 'object') {
      return row.marketId !== null && clause.marketId.in.includes(row.marketId)
    }
    return false
  })
}
