-- CreateTable
CREATE TABLE "Snapshot" (
    "id" SERIAL NOT NULL,
    "hourOffset" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceUrl" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "parseOk" BOOLEAN NOT NULL DEFAULT true,
    "error" JSONB,

    CONSTRAINT "Snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Observation" (
    "snapshotId" INTEGER NOT NULL,
    "balloonIndex" INTEGER NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "parseOk" BOOLEAN NOT NULL DEFAULT true,
    "raw" JSONB,
    "errors" JSONB,

    CONSTRAINT "Observation_pkey" PRIMARY KEY ("snapshotId","balloonIndex")
);

-- CreateTable
CREATE TABLE "Reliability" (
    "balloonIndex" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "missingCount" INTEGER NOT NULL,
    "teleportCount" INTEGER NOT NULL,
    "maxGap" INTEGER NOT NULL,
    "reasons" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reliability_pkey" PRIMARY KEY ("balloonIndex")
);

-- CreateIndex
CREATE INDEX "Snapshot_hourOffset_createdAt_idx" ON "Snapshot"("hourOffset", "createdAt");

-- CreateIndex
CREATE INDEX "Observation_balloonIndex_idx" ON "Observation"("balloonIndex");

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "Snapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
