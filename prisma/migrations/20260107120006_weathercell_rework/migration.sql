/*
  Warnings:

  - You are about to drop the `WeatherCell` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "WeatherCell" DROP CONSTRAINT "WeatherCell_runId_fkey";

-- DropTable
DROP TABLE "WeatherCell";

-- CreateTable
CREATE TABLE "WeatherCacheCell" (
    "id" SERIAL NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "latBucket" DECIMAL(6,3) NOT NULL,
    "lonBucket" DECIMAL(6,3) NOT NULL,
    "model" TEXT NOT NULL,
    "varsVersion" TEXT NOT NULL DEFAULT 'v1',
    "temp2m" DOUBLE PRECISION,
    "windspeed10m" DOUBLE PRECISION,
    "winddir10m" DOUBLE PRECISION,
    "pressureMsl" DOUBLE PRECISION,
    "precipitation" DOUBLE PRECISION,
    "windgusts10m" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeatherCacheCell_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeatherCacheCell_model_varsVersion_time_idx" ON "WeatherCacheCell"("model", "varsVersion", "time");

-- CreateIndex
CREATE INDEX "WeatherCacheCell_time_idx" ON "WeatherCacheCell"("time");

-- CreateIndex
CREATE UNIQUE INDEX "WeatherCacheCell_time_latBucket_lonBucket_model_varsVersion_key" ON "WeatherCacheCell"("time", "latBucket", "lonBucket", "model", "varsVersion");
