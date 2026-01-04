import { prisma } from "@/prisma";
import { Prisma } from "@prisma/client";
import fetchHr from "./fetchHr";

function parsePoint(x: any): {lat: number; lon: number; alt: number} | null {
    if (!Array.isArray(x) || x.length < 3) return null
    const [lat, lon, alt] = x
    if (![lat, lon, alt].every((n) => typeof n === 'number' && Number.isFinite(n))) return null
    if (lat < -90 || lat > 90) return null
    if (lon < -180 || lon > 180) return null
    return {lat, lon, alt}
}

export async function ingestWindborne(results: any[]) {
    const KEEP_RUNS = 24;

    return await prisma.$transaction(async (tx: any) => {
        const run = await tx.ingestRun.create({
            data: { ingestOk: false },
            select: { id: true }
        })

        let totalObs = 0

        for (let i = 0; i < results.length; i++) {
            const snap = results[i]
            const dataArr = Array.isArray(snap) ? (snap as any[]) : []

            const createdSnap = await tx.snapshot.create({
                data: {
                    runId: run.id,
                    hourOffset: i,
                    count: dataArr.length,
                    parseOk: Array.isArray(snap),
                    error: Array.isArray(snap) ? Prisma.DbNull : { message: 'snap is not an array' }
                },
                select: {id : true}
            })

            const obsData = dataArr.map((row, balloonIndex) => {
                const p = parsePoint(row)
                if (!p) {
                    return {
                        snapshotId: createdSnap.id,
                        balloonIndex,
                        lat: null,
                        lon: null,
                        alt: null,
                        parseOk: false,
                        raw: row as any,
                        errors: { messages: ['invalid_point']}
                    }
                }
                return {
                    snapshotId: createdSnap.id,
                    balloonIndex,
                    lat: p.lat,
                    lon: p.lon,
                    alt: p.alt,
                    parseOk: true,
                    raw: row as any,
                }
            })

            const res = await tx.observation.createMany({
                data: obsData,
                skipDuplicates: true,
            })

            totalObs += res.count
        }

        await tx.ingestRun.update({
            where: { id: run.id },
            data: {
                endedAt: new Date(),
                ingestOk: true,
            }
        })

        // prune old runs
        const cutoff = await tx.ingestRun.findFirst({
            orderBy: { id: 'desc' },
            skip: KEEP_RUNS,
            select: { id: true }
        })

        if (cutoff?.id) {
            await tx.ingestRun.deleteMany({
                where: { id: {lt: cutoff.id}},
            })
        }

        return { runId: run.id, snapshots: results.length, observations: totalObs }
    })
}