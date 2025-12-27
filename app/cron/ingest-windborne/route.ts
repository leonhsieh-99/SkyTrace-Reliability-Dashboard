import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/prisma";
import { cache } from "react";

function verifyCron(req: NextRequest) {
    const auth = req.headers.get('authorization')
    const expected = `Bearer ${process.env.CRON_SECRET}`

    if (!auth || auth !== expected) {
        throw new Error('Unauthorized cron request')
    }
}

async function fetchHr(hr: string) {
    const BASE_URL = "https://a.windbornesystems.com/treasure";
  
    const res = await fetch(`${BASE_URL}/${hr}.json`, {
      cache: "no-store",
    });
  
    if (!res.ok) {
      throw new Error(`Failed to fetch hour ${hr}: ${res.status}`);
    }
  
    return res.json();
}

function parsePoint(x: any): {lat: number; lon: number; alt: number} | null {
    if (!Array.isArray(x) || x.length < 3) return null
    const [lat, lon, alt] = x
    if (![lat, lon, alt].every((n) => typeof n === 'number' && Number.isFinite(n))) return null
    if (lat < -90 || lat > 90) return null
    if (lon < -180 || lon > 180) return null
    return {lat, lon, alt}
}

export async function GET(req: NextRequest) {
    // Cron check
    try {
        verifyCron(req)
    } catch (err) {
        return NextResponse.json(
            { error: 'Unauthorized or failed cron'},
            { status: 401 }
        )
    }

    const hours = []
    for (let i = 0; i < 24; i++) {
        hours.push(i.toString().padStart(2, '0'))
    }

    try { // ingest snapshots and observations
        const results = await Promise.all(
            hours.map(hr => fetchHr(hr))
        )

        const ingested = await prisma.$transaction(async (tx: any) => {
            await tx.snapshot.deleteMany()
            let totalObs = 0

            for (let i = 0; i < results.length; i++) {
                const snap = results[i]
                console.log(snap)
                const dataArr = Array.isArray(snap) ? (snap as any[]) : []

                const createdSnap = await tx.snapshot.create({
                    data: {
                        hourOffset: i,
                        count: dataArr.length,
                        parseOk: Array.isArray(snap),
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

            return { snapshots: results.length, observations: totalObs }
        })

        return NextResponse.json({
            success: true,
            ...ingested
        })
    } catch (err) {
        console.log(err)
        return NextResponse.json(
            { error: 'Failed to ingest'}, 
            { status: 500 }
        )
    }
}