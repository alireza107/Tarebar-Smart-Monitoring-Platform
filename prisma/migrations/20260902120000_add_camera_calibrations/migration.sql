CREATE TABLE "CameraCalibration" (
    "id" TEXT NOT NULL,
    "cameraId" TEXT NOT NULL,
    "serviceJobId" TEXT NOT NULL,
    "cameraGroup" TEXT,
    "boardType" TEXT NOT NULL,
    "columns" INTEGER NOT NULL,
    "rows" INTEGER NOT NULL,
    "squareSizeMm" DOUBLE PRECISION NOT NULL,
    "markerSizeMm" DOUBLE PRECISION,
    "dictionary" TEXT,
    "resolutionWidth" INTEGER NOT NULL,
    "resolutionHeight" INTEGER NOT NULL,
    "reprojectionError" DOUBLE PRECISION NOT NULL,
    "maxReprojectionError" DOUBLE PRECISION NOT NULL,
    "calibrationPath" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CameraCalibration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CameraCalibration_serviceJobId_key" ON "CameraCalibration"("serviceJobId");
CREATE INDEX "CameraCalibration_cameraId_createdAt_idx" ON "CameraCalibration"("cameraId", "createdAt");
ALTER TABLE "CameraCalibration" ADD CONSTRAINT "CameraCalibration_cameraId_fkey"
    FOREIGN KEY ("cameraId") REFERENCES "Camera"("id") ON DELETE CASCADE ON UPDATE CASCADE;
