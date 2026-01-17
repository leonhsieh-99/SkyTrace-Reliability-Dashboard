import { prisma } from "@/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params : Promise<{ id: string, balloonIndex: string }> }) {
    const { id, balloonIndex } = await params
    const runId = Number(id)
    const b = Number(balloonIndex)

    if (!Number.isFinite(runId) || !Number.isFinite(b)) {
        return NextResponse.json({ error: 'invalid params'}, { status: 400 })
    }

    const row = await prisma.reliability.findUnique({
        where: { runId_balloonIndex: {runId, balloonIndex: b} },
        select: {
            runId: true,
            balloonIndex: true,
            score: true,
            missingCount: true,
            teleportCount: true,
            maxGap: true,
            reasons: true,
            updatedAt: true,
        }
    })

    if (!row) {
        return NextResponse.json({ error: 'not found' }, { status: 404 } )
    }

    return NextResponse.json({ ballon: row })
}