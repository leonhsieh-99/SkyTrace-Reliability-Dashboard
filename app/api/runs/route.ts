import { prisma } from "@/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const url = req.nextUrl
    const searchParams = url.searchParams
    const limit = Math.min(Number(searchParams.get('limit') ?? 20), 100)

    const runs = await prisma.ingestRun.findMany({
        orderBy: { startedAt: "desc" },
            take: limit,
            select: {
            id: true,
            startedAt: true,
            endedAt: true,
            ingestOk: true,
            reliabilityAt: true,
            enrichAt: true,
        },
    });

    const runIds = runs.map((r) => r.id)
    if (runIds.length === 0) return NextResponse.json({ runs: [] })
    
    const agg = await prisma.reliability.groupBy({
        by: ['runId'],
        where: { runId: { in: runIds }},
        _count: { _all: true },
        _min: { score: true },
        _avg: { score: true }
    })

    const statsByRun = new Map(
        agg.map((a) => [
            a.runId,
            {
                balloonCount: a._count._all,
                worstScore: a._min.score,
                avgScore: a._avg.score
            }
        ])
    )

    const out = runs.map((r) => {
        const s = statsByRun.get(r.id)
        return {
            ...r,
            balloonCount: s?.balloonCount ?? 0,
            worstScore: s?.worstScore ?? null,
            avgScore: s?.avgScore ?? null
        }
    })

    return NextResponse.json({ runs: out })
}