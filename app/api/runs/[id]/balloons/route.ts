import { THRESHOLD } from "@/lib/constants";
import { prisma } from "@/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: { id: string }}) {
    const { id } = await params
    const runId = Number(id)
    console.log(runId)
    if (!Number.isFinite(runId)) {
        return NextResponse.json({ error: 'inavlid runId' }, { status: 400 })
    }

    const searchParams = req.nextUrl.searchParams
    const limit = Math.min(Number(searchParams.get('limit') ?? 50), 200)
    const threshold = Number(searchParams.get('threshold') ?? THRESHOLD)

    const rows = await prisma.reliability.findMany({
        where: {
            runId,
            ...(Number.isFinite(threshold) ? {score: { lte: threshold } } : {})
        },
        orderBy: { score: 'asc' },
        take: limit,
        select: {
            balloonIndex: true,
            score: true,
            missingCount: true,
            teleportCount: true,
            maxGap: true,
            reasons: true,
        }
    })

    const balloons = rows.map((r) => {
        const reasons: any = r.reasons ?? {}
        return {
            balloonIndex: r.balloonIndex,
            score: r.score,
            missingCount: r.missingCount,
            teleportCount: r.teleportCount,
            maxGap: r.maxGap,
            reasonsSummary: {
                maxSpeed: reasons?.maxSpeed ?? reasons?.teleports?.maxSpeed ?? null,
                teleports: reasons?.teleports ?? null,
                turns: reasons?.turns ?? null,
                alts: reasons?.alts ?? null,
            }
        }
    })

    return NextResponse.json({ runId, balloons })
}