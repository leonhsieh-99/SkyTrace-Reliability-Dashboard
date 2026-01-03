/*
  Warnings:

  - A unique constraint covering the columns `[runId,hourOffset]` on the table `Snapshot` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "IngestRun" ALTER COLUMN "endedAt" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Snapshot_runId_hourOffset_key" ON "Snapshot"("runId", "hourOffset");
