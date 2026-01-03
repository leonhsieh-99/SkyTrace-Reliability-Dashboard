/*
  Warnings:

  - The primary key for the `Reliability` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `enrichOk` on the `Snapshot` table. All the data in the column will be lost.
  - You are about to drop the column `enrichedAt` on the `Snapshot` table. All the data in the column will be lost.
  - Added the required column `runId` to the `Reliability` table without a default value. This is not possible if the table is not empty.
  - Added the required column `runId` to the `Snapshot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `runId` to the `WeatherCell` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Reliability" DROP CONSTRAINT "Reliability_pkey",
ADD COLUMN     "runId" INTEGER NOT NULL,
ADD CONSTRAINT "Reliability_pkey" PRIMARY KEY ("runId", "balloonIndex");

-- AlterTable
ALTER TABLE "Snapshot" DROP COLUMN "enrichOk",
DROP COLUMN "enrichedAt",
ADD COLUMN     "runId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "WeatherCell" ADD COLUMN     "runId" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "IngestRun" (
    "id" SERIAL NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "ingestOk" BOOLEAN NOT NULL DEFAULT false,
    "reliabilityAt" TIMESTAMP(3),
    "enrichAt" TIMESTAMP(3),

    CONSTRAINT "IngestRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IngestRun_startedAt_idx" ON "IngestRun"("startedAt");

-- CreateIndex
CREATE INDEX "Reliability_runId_score_idx" ON "Reliability"("runId", "score");

-- AddForeignKey
ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_runId_fkey" FOREIGN KEY ("runId") REFERENCES "IngestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reliability" ADD CONSTRAINT "Reliability_runId_fkey" FOREIGN KEY ("runId") REFERENCES "IngestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeatherCell" ADD CONSTRAINT "WeatherCell_runId_fkey" FOREIGN KEY ("runId") REFERENCES "IngestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
