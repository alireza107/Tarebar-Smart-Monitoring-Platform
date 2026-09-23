-- CreateEnum
CREATE TYPE "AnalysisSource" AS ENUM ('LIVE', 'UPLOAD');

-- CreateTable
CREATE TABLE "FruitQualityAssessment" (
    "id" TEXT NOT NULL,
    "source" "AnalysisSource" NOT NULL,
    "cameraId" TEXT,
    "fieldId" TEXT,
    "marketId" TEXT,
    "boothId" TEXT,
    "fileName" TEXT,
    "hasFruit" BOOLEAN NOT NULL,
    "label" TEXT NOT NULL,
    "grade" TEXT,
    "freshnessScore" INTEGER NOT NULL,
    "confidence" INTEGER NOT NULL,
    "freshPercent" INTEGER NOT NULL,
    "middlePercent" INTEGER NOT NULL,
    "rottenPercent" INTEGER NOT NULL,
    "fruitCountEstimate" INTEGER,
    "summaryFa" TEXT NOT NULL,
    "recommendationFa" TEXT,
    "detailLevel" TEXT NOT NULL DEFAULT 'summary',
    "details" JSONB NOT NULL,
    "thumbnails" JSONB,
    "frameCount" INTEGER NOT NULL,
    "inferenceSeconds" DOUBLE PRECISION NOT NULL,
    "modelName" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FruitQualityAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentCheck" (
    "id" TEXT NOT NULL,
    "source" "AnalysisSource" NOT NULL,
    "cameraId" TEXT,
    "fieldId" TEXT,
    "marketId" TEXT,
    "boothId" TEXT,
    "fileName" TEXT,
    "fighting" BOOLEAN NOT NULL,
    "floorClean" BOOLEAN NOT NULL,
    "windowLabel" TEXT,
    "windowSeconds" DOUBLE PRECISION,
    "frameCount" INTEGER NOT NULL,
    "inferenceSeconds" DOUBLE PRECISION NOT NULL,
    "thumbnail" TEXT,
    "modelName" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FruitMeasurementRun" (
    "id" TEXT NOT NULL,
    "source" "AnalysisSource" NOT NULL,
    "cameraId" TEXT,
    "fieldId" TEXT,
    "marketId" TEXT,
    "boothId" TEXT,
    "serviceJobId" TEXT NOT NULL,
    "processingMode" TEXT,
    "palletType" TEXT,
    "processedFrames" INTEGER NOT NULL,
    "totalFruitObservations" INTEGER NOT NULL,
    "lastFruitCount" INTEGER,
    "avgWidthMm" DOUBLE PRECISION,
    "avgLengthMm" DOUBLE PRECISION,
    "avgDiameterMm" DOUBLE PRECISION,
    "sizeStatistics" JSONB,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FruitMeasurementRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FruitQualityAssessment_fieldId_createdAt_idx" ON "FruitQualityAssessment"("fieldId", "createdAt");

-- CreateIndex
CREATE INDEX "FruitQualityAssessment_marketId_createdAt_idx" ON "FruitQualityAssessment"("marketId", "createdAt");

-- CreateIndex
CREATE INDEX "FruitQualityAssessment_boothId_createdAt_idx" ON "FruitQualityAssessment"("boothId", "createdAt");

-- CreateIndex
CREATE INDEX "FruitQualityAssessment_cameraId_createdAt_idx" ON "FruitQualityAssessment"("cameraId", "createdAt");

-- CreateIndex
CREATE INDEX "FruitQualityAssessment_createdAt_idx" ON "FruitQualityAssessment"("createdAt");

-- CreateIndex
CREATE INDEX "IncidentCheck_fieldId_createdAt_idx" ON "IncidentCheck"("fieldId", "createdAt");

-- CreateIndex
CREATE INDEX "IncidentCheck_marketId_createdAt_idx" ON "IncidentCheck"("marketId", "createdAt");

-- CreateIndex
CREATE INDEX "IncidentCheck_boothId_createdAt_idx" ON "IncidentCheck"("boothId", "createdAt");

-- CreateIndex
CREATE INDEX "IncidentCheck_cameraId_createdAt_idx" ON "IncidentCheck"("cameraId", "createdAt");

-- CreateIndex
CREATE INDEX "IncidentCheck_createdAt_idx" ON "IncidentCheck"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FruitMeasurementRun_serviceJobId_key" ON "FruitMeasurementRun"("serviceJobId");

-- CreateIndex
CREATE INDEX "FruitMeasurementRun_fieldId_createdAt_idx" ON "FruitMeasurementRun"("fieldId", "createdAt");

-- CreateIndex
CREATE INDEX "FruitMeasurementRun_marketId_createdAt_idx" ON "FruitMeasurementRun"("marketId", "createdAt");

-- CreateIndex
CREATE INDEX "FruitMeasurementRun_boothId_createdAt_idx" ON "FruitMeasurementRun"("boothId", "createdAt");

-- CreateIndex
CREATE INDEX "FruitMeasurementRun_cameraId_createdAt_idx" ON "FruitMeasurementRun"("cameraId", "createdAt");

-- CreateIndex
CREATE INDEX "FruitMeasurementRun_createdAt_idx" ON "FruitMeasurementRun"("createdAt");

-- AddForeignKey
ALTER TABLE "FruitQualityAssessment" ADD CONSTRAINT "FruitQualityAssessment_cameraId_fkey" FOREIGN KEY ("cameraId") REFERENCES "Camera"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FruitQualityAssessment" ADD CONSTRAINT "FruitQualityAssessment_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "Field"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FruitQualityAssessment" ADD CONSTRAINT "FruitQualityAssessment_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FruitQualityAssessment" ADD CONSTRAINT "FruitQualityAssessment_boothId_fkey" FOREIGN KEY ("boothId") REFERENCES "Booth"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentCheck" ADD CONSTRAINT "IncidentCheck_cameraId_fkey" FOREIGN KEY ("cameraId") REFERENCES "Camera"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentCheck" ADD CONSTRAINT "IncidentCheck_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "Field"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentCheck" ADD CONSTRAINT "IncidentCheck_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentCheck" ADD CONSTRAINT "IncidentCheck_boothId_fkey" FOREIGN KEY ("boothId") REFERENCES "Booth"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FruitMeasurementRun" ADD CONSTRAINT "FruitMeasurementRun_cameraId_fkey" FOREIGN KEY ("cameraId") REFERENCES "Camera"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FruitMeasurementRun" ADD CONSTRAINT "FruitMeasurementRun_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "Field"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FruitMeasurementRun" ADD CONSTRAINT "FruitMeasurementRun_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FruitMeasurementRun" ADD CONSTRAINT "FruitMeasurementRun_boothId_fkey" FOREIGN KEY ("boothId") REFERENCES "Booth"("id") ON DELETE SET NULL ON UPDATE CASCADE;

