import { prisma } from "@/prisma";
import { json } from "stream/consumers";

type point = { lat: number; lon: number; alt: number |null }
type Series = Array<point | null>

function computeMetrics(series: Series) {
    // computer metrics for this series of balloons
    const metrics = {
        score: 0,
        missingCount: 0,
        teleportCount: 0,
        maxGap: 0,
        reasons: {}
    }

    let maxGap = 0
    for (const balloon of series) {
        // calc missing count first
        if (balloon?.lon == null || balloon?.lat == null) {
            metrics.missingCount += 1
            maxGap += 1
            continue
        }
        
        metrics.maxGap = Math.max(metrics.maxGap, maxGap)
    }

    return (metrics)
}

export default async function calculateReliability(runId: number) {
    const run = await prisma.ingestRun.findUnique({
        where: { id: runId },
    })
    if (!run) throw new Error(`no run with id: ${runId}`)
    if (!run.ingestOk) throw new Error('run hasnt been ingested')

    const snaps = await prisma.snapshot.findMany({
        where: { runId: run.id },
        select: { id: true, hourOffset: true },
        orderBy: { hourOffset: 'asc' },
    })
    if (snaps.length === 0) throw new Error('no snaps for this run')

    const snapIdToHour = new Map<number, number>()
    const snapIds: number[] = []
    for (const s of snaps) {
        snapIdToHour.set(s.id, s.hourOffset)
        snapIds.push(s.id)
    }

    const obs = await prisma.observation.findMany({
        where: { snapshotId: { in: snapIds }},
        select: {
            snapshotId: true,
            balloonIndex: true,
            lat: true,
            lon: true,
            alt: true,
            parseOk: true
        }
    })

    const byBalloon = new Map<number, Series>()

    const ensureSeries = (balloonIndex: number) => {
        let s = byBalloon.get(balloonIndex)
        if (!s) {
            s = Array.from( {length: 24}, () => null)
            byBalloon.set(balloonIndex, s)
        }
        return s
    }

    // collapse balloons into map by id
    for (const o of obs) {
        const hr = snapIdToHour.get(o.snapshotId)
        if (hr === undefined) continue

        const ok = o.parseOk && o.lat != null && o.lon != null
        const series = ensureSeries(o.balloonIndex)

        series[hr] = ok ? { lat: o.lat!, lon: o.lon!, alt: o.alt ?? null } : null
    }

    const rows = []
    for (const [balloonIndex, balloonSeries] of byBalloon) {
        const metrics = computeMetrics(balloonSeries)
        rows.push({
            runId,
            balloonIndex,
            score: metrics.score,
            missingCount: metrics.missingCount,
            teleportCount: metrics.teleportCount,
            maxGap: metrics.maxGap,
            reasons: metrics.reasons,
        })
    }

    await prisma.$transaction([
        prisma.reliability.deleteMany({where: {runId}}),
        prisma.reliability.createMany({data: rows}),
        prisma.ingestRun.update({
            where: { id: runId },
            data: { reliabilityAt: new Date()}
        })
    ])

    return { runId, balloons: rows.length }
}