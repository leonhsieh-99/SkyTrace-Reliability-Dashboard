import { prisma } from "@/prisma";
import { Prisma } from "@prisma/client";
import { fetchHr } from "../../api/helpers";

function parsePoint(x: any): {lat: number; lon: number; alt: number} | null {
    if (!Array.isArray(x) || x.length < 3) return null
    const [lat, lon, alt] = x
    if (![lat, lon, alt].every((n) => typeof n === 'number' && Number.isFinite(n))) return null
    if (lat < -90 || lat > 90) return null
    if (lon < -180 || lon > 180) return null
    return {lat, lon, alt}
}

export async function ingestWindborne(results: any[]) {
    const run = await prisma.ingestRun.create({
        data: { ingestOk: false },
        select: { id: true }
    })

    let totalObs = 0

    for (let i = 0; i < results.length; i++) {
        const snap = results[i]
        const dataArr = Array.isArray(snap) ? (snap as any[]) : []

        const createdSnap = await prisma.snapshot.create({
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
                    raw: p ? Prisma.DbNull : (row as any),
                    errors: p ? Prisma.DbNull : { messages: ['invalid_point'] },
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

        const res = await prisma.observation.createMany({
            data: obsData,
            skipDuplicates: true,
        })

        totalObs += res.count
    }

    await prisma.ingestRun.update({
        where: { id: run.id },
        data: {
            endedAt: new Date(),
            ingestOk: true,
        }
    })

    // prune old runs
    const KEEP_HOURS = 48;

    await prisma.ingestRun.deleteMany({
        where: {
            startedAt: { lt: new Date(Date.now() - KEEP_HOURS * 60 * 60 * 1000) },
        },
    });

    return { runId: run.id, snapshots: results.length, observations: totalObs }
}