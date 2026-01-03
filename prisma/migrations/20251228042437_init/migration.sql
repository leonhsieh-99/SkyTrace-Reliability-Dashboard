-- AlterTable
ALTER TABLE "Snapshot" ADD COLUMN     "enrichOk" BOOLEAN,
ADD COLUMN     "enrichedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "WeatherCell" (
    "id" SERIAL NOT NULL,
    "latBucket" DOUBLE PRECISION NOT NULL,
    "lonBucket" DOUBLE PRECISION NOT NULL,
    "snapshotId" INTEGER NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "temp2m" DOUBLE PRECISION,
    "windspeed10m" DOUBLE PRECISION,
    "winddir10m" DOUBLE PRECISION,
    "pressureMsl" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeatherCell_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeatherCell_snapshotId_time_idx" ON "WeatherCell"("snapshotId", "time");

-- CreateIndex
CREATE UNIQUE INDEX "WeatherCell_snapshotId_time_latBucket_lonBucket_key" ON "WeatherCell"("snapshotId", "time", "latBucket", "lonBucket");

-- CreateIndex
CREATE INDEX "Reliability_updatedAt_idx" ON "Reliability"("updatedAt");

-- CreateIndex
CREATE INDEX "Snapshot_createdAt_idx" ON "Snapshot"("createdAt");
