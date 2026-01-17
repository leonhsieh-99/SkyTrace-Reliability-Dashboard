import { NextRequest, NextResponse } from "next/server";
import { verifyCron } from "../helpers/verifyCron";
import { ingestWindborne } from "../helpers/ingestWindborne";
import calculateReliability from "../helpers/calculateReliability";
import enrichLatest from "../helpers/enrichLatest";
import { fetchHr } from "../../api/helpers";

export async function POST(req: NextRequest) {
    try {
        verifyCron(req) // throws error if req is unauthorized
        const hours = Array.from({ length: 24 }, (_,i) => String(i).padStart(2, '0'))
        const results = await Promise.all(hours.map(fetchHr))

        const ingestion = await ingestWindborne(results)
        const reliability = await calculateReliability(ingestion.runId)
        const enrich = await enrichLatest(reliability.runId)

        return NextResponse.json({ ok: true, ingestion, reliability, enrich })
    } catch (err: any) {
        console.log(err)
        return NextResponse.json(
            { ok: false, error: err?.message ?? 'unknown error' },
            { status: 500 }
        )
    }
}