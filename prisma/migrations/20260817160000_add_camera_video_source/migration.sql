-- CreateEnum
CREATE TYPE "CameraSourceType" AS ENUM ('RTSP', 'VIDEO_FILE');

-- AlterTable
ALTER TABLE "Camera"
  ADD COLUMN "sourceType" "CameraSourceType" NOT NULL DEFAULT 'RTSP',
  ADD COLUMN "videoFileName" TEXT,
  ADD COLUMN "videoUploadedAt" TIMESTAMP(3);
