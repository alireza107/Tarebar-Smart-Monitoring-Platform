-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'IMPORT', 'EXPORT');

-- CreateTable
CREATE TABLE "Region" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "marketId" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CameraRegion" (
    "id" TEXT NOT NULL,
    "cameraId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "mainPolygon" JSONB NOT NULL,
    "exclusionPolygons" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CameraRegion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegionBooth" (
    "id" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "boothId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "RegionBooth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "marketId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Region_marketId_idx" ON "Region"("marketId");

-- CreateIndex
CREATE UNIQUE INDEX "Region_marketId_name_key" ON "Region"("marketId", "name");

-- CreateIndex
CREATE INDEX "CameraRegion_regionId_idx" ON "CameraRegion"("regionId");

-- CreateIndex
CREATE INDEX "CameraRegion_cameraId_idx" ON "CameraRegion"("cameraId");

-- CreateIndex
CREATE UNIQUE INDEX "CameraRegion_cameraId_regionId_key" ON "CameraRegion"("cameraId", "regionId");

-- CreateIndex
CREATE INDEX "RegionBooth_regionId_idx" ON "RegionBooth"("regionId");

-- CreateIndex
CREATE INDEX "RegionBooth_boothId_idx" ON "RegionBooth"("boothId");

-- CreateIndex
CREATE UNIQUE INDEX "RegionBooth_regionId_boothId_key" ON "RegionBooth"("regionId", "boothId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_marketId_idx" ON "AuditLog"("marketId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Region" ADD CONSTRAINT "Region_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CameraRegion" ADD CONSTRAINT "CameraRegion_cameraId_fkey" FOREIGN KEY ("cameraId") REFERENCES "Camera"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CameraRegion" ADD CONSTRAINT "CameraRegion_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegionBooth" ADD CONSTRAINT "RegionBooth_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegionBooth" ADD CONSTRAINT "RegionBooth_boothId_fkey" FOREIGN KEY ("boothId") REFERENCES "Booth"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
