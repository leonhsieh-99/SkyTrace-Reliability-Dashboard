import { prisma } from "@/prisma";
import { NextRequest, NextResponse } from "next/server";

function bucketCoord(x: number, step = 5) {
	return Math.round(x / step) * step
}

export async function GET(req: NextRequest) {
    // Fetch windborne data from DB
    const snapshot = await prisma.snapshot.findFirst({
        where: { hourOffset: 0 },
		orderBy: { createdAt: 'desc' },
		select: { id: true }
    })
    console.log(snapshot)

    if (!snapshot) {
        return NextResponse.json(
            { error: 'no snapshot found' },
            { status: 400 }
        )
    }

    const obs = await prisma.observation.findMany({
        where: { snapshotId: snapshot?.id, parseOk: true },
		select: { balloonIndex: true, lat: true, lon: true, alt: true }
    })

	const buckets = new Map<string, { latBucket: number; lonBucket: number; obs: typeof obs } >()

    for (const ob of obs) {
		if (ob.lat == null || ob.lon == null) continue;

		const latBucket = bucketCoord(ob.lat)
		const lonBucket = bucketCoord(ob.lon)
		const key = `${latBucket},${lonBucket}`

		const entry = buckets.get(key)
		if (entry) {
			entry.obs.push(ob)
		} else {
			buckets.set(key, { latBucket, lonBucket, obs: [ob] })
		}
	}

	const uniqueCells = [...buckets.values()].map(({ latBucket, lonBucket, obs }) => ({
		latBucket,
		lonBucket,
		count: obs.length
	}))

    // const url = new URL("https://api.open-meteo.com/v1/forecast");
    // url.searchParams.set("latitude", String(lat));
    // url.searchParams.set("longitude", String(lon));
    // url.searchParams.set("hourly", "temperature_2m,windspeed_10m,winddirection_10m,pressure_msl");
    // url.searchParams.set("timezone", "UTC");
    // url.searchParams.set("forecast_days", "2");
    // url.searchParams.set("models", "best_match");

	return NextResponse.json({
		snapshotId: snapshot.id,
		observationCount: obs.length,
		uniqueCellCount: uniqueCells.length,
		sampleCells: uniqueCells.slice(0, 10),
	});
}