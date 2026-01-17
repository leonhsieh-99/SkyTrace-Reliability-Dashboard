import { prisma } from "@/prisma";
import { JsonObject } from "@prisma/client/runtime/library";
import { asArray, fetchWithBackoff, MissingEdge, sleep, TeleportEvent } from "../../api/helpers";
import { MAX_LOCS_PER_REQ, MAX_REQUESTS_PER_RUN, MIN_DELAY_MS, THRESHOLD } from "@/lib/constants";

type CellKey = {
    time: Date
    latBucket: number
    lonBucket: number
    model: string
    varsVersion: string
}

type locDayKey = string

type locDayGroup = {
    day: string
    latBucket: number
    lonBucket: number
    cells: CellKey[]
}

type OpenMeteoLocation = {
    latitude: number
    longitude: number
    hourly: {
      time: string[]
      temperature_2m?: (number | null)[]
      windspeed_10m?: (number | null)[]
      winddirection_10m?: (number | null)[]
      pressure_msl?: (number | null)[]
      precipitation?: (number | null)[]
      windgusts_10m?: (number | null)[]
    };
};

function wrapLon(lon: number) {
    return ((lon + 180) % 360 + 360) % 360 - 180
}
  
function clampLat(lat: number) {
    return Math.max(-90, Math.min(lat, 90))
}
  
function bucketCoord(x: number, step: number) {
    return Math.round(x / step) * step
}
  
function floorToUtcHour(d: Date, hrOffset=0) {
    const ms = Date.UTC(
        d.getUTCFullYear(),
        d.getUTCMonth(),
        d.getUTCDate(),
        d.getUTCHours() - hrOffset,
        0, 0, 0
    )
    return new Date(ms)
}



function getDayUtc(d: Date) {
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

function isoHourKeyUtc(d: Date) {
    // Open-Meteo hourly.time for timezone=UTC looks like: "2026-01-12T10:00"
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    const hr = String(d.getUTCHours()).padStart(2, "0");
    return `${y}-${m}-${day}T${hr}:00`;
}

function indexHourlyTime(times: string[]) {
    const m = new Map<string, number>();
    for (let i = 0; i < times.length; i++) m.set(times[i], i);
    return m;
}

function pickAt<T>(arr: (T | null)[] | undefined, idx: number): T | null {
    if (!arr) return null;
    return (arr[idx] ?? null) as any;
}


function cellKeyString(k: CellKey) {
    return `${k.time.toISOString()}|${k.latBucket}|${k.lonBucket}|${k.model}|${k.varsVersion}`;
}

function locDayKey(day: string, lat: number, lon: number) {
    return `${day}|${lat}|${lon}`
}

function addPointToCells(args: {
    cells: Map<string, CellKey>
    t: Date
    hrOffset: number
    lat: number
    lon: number
    stepDeg: number
    model: string
    varsVersion: string
}) {
    const latBucket = bucketCoord(clampLat(args.lat), args.stepDeg)
    const lonBucket = bucketCoord(wrapLon(args.lon), args.stepDeg)
    const time = floorToUtcHour(args.t, args.hrOffset)
    const cellKey: CellKey = { time, latBucket, lonBucket, model: args.model, varsVersion: args.varsVersion }

    args.cells.set(cellKeyString(cellKey), cellKey)
}

function groupByDayAndLoc(missingCells: CellKey[]) {
    const m = new Map<locDayKey, locDayGroup>()

    for (const c of missingCells) {
        const day = getDayUtc(c.time)
        const key = locDayKey(day, c.latBucket, c.lonBucket)
        const g = m.get(key) ??
        {
            day,
            latBucket: c.latBucket,
            lonBucket: c.lonBucket,
            cells: []
        }

        g.cells.push(c)
        m.set(key, g)
    }
    return Array.from(m.values())
}

async function fetchOpenMeteoBatch(params: {
    lats: number[];
    lons: number[];
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
}) {
    const url = new URL('https://api.open-meteo.com/v1/forecast')
    url.searchParams.set('latitude', params.lats.join(','))
    url.searchParams.set('longitude', params.lons.join(','))
    url.searchParams.set('timezone', 'UTC')
    url.searchParams.set('start_date', params.startDate)
    url.searchParams.set('end_date', params.endDate)
    url.searchParams.set(
        "hourly",
        [
          "temperature_2m",
          "windspeed_10m",
          "winddirection_10m",
          "pressure_msl",
          "precipitation",
          "windgusts_10m",
        ].join(",")
    );

    const res = await fetch(url)
    if (res.status === 429) {
        const retryAfter = res.headers.get("retry-after");
        const retryAfterMs =
          retryAfter && !Number.isNaN(Number(retryAfter))
            ? Number(retryAfter) * 1000
            : 60_000;
      
        const txt = await res.text().catch(() => "");
        const err = new Error(`Open-Meteo 429: ${txt.slice(0, 200)}`) as any;
        err.retryAfterMs = retryAfterMs;
        throw err;
    }
    else if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(`Open-Meteo error ${res.status}: ${txt.slice(0, 300)}`);
    }
    return res.json()
}

async function writeGroupsToCache(args: {
    groups: locDayGroup[]
    meteo: OpenMeteoLocation[]
    model: string
    varsVersion: string
}) {
    const rows: any[] = []

    for (let i = 0; i < args.groups.length; i++) {
        const group = args.groups[i]
        const loc = args.meteo[i]
        if (!loc?.hourly?.time) continue

        const timeIndex = indexHourlyTime(loc.hourly.time)

        for (const cell of group.cells) {
            const tKey = isoHourKeyUtc(cell.time)
            const idx = timeIndex.get(tKey)
            if (idx === undefined) continue

            rows.push({
                time: cell.time,
                latBucket: cell.latBucket,
                lonBucket: cell.lonBucket,
                model: cell.model,
                varsVersion: cell.varsVersion,
          
                temp2m: pickAt(loc.hourly.temperature_2m, idx),
                windspeed10m: pickAt(loc.hourly.windspeed_10m, idx),
                winddir10m: pickAt(loc.hourly.winddirection_10m, idx),
                pressureMsl: pickAt(loc.hourly.pressure_msl, idx),
                precipitation: pickAt(loc.hourly.precipitation, idx),
                windgusts10m: pickAt(loc.hourly.windgusts_10m, idx),
            });
        }
    }

    if (!rows.length) return 0;
    
    await prisma.weatherCacheCell.createMany({
        data: rows,
        skipDuplicates: true,
    });

    return rows.length
}

export default async function enrichLatest(runId: number) {
    const run = await prisma.ingestRun.findUnique({where: { id: runId }})
    if (!run) throw new Error(`Error retrieving run Id: ${runId}`)
    if (!run.ingestOk) throw new Error(`Run ${runId} ingestion failed. Aborting`)
    if (run.reliabilityAt === null) throw new Error(`Run ${runId} calc reliability failed. Aborting`)
    if (run.enrichAt !== null) throw new Error(`Run ${runId} already enriched. Aborting`)

    // Look for suspicious events
    const reliabilities = await prisma.reliability.findMany({
        where: { runId: runId, score: { lte: THRESHOLD }},
        orderBy: { score: 'asc' },
        take: 50
    })

    // base time: use latest snap and fallback to time of ingestion
    const baseSnap = await prisma.snapshot.findFirst({
        where: { runId: runId },
        orderBy: { createdAt: 'desc' }
    })

    const baseTime = baseSnap?.createdAt ?? run.startedAt

    // build cell candidates
    const model = "best_match"
    const varsVersion = 'v1'
    const stepDeg = 1;

    const cells = new Map<string, CellKey>()
    for (const r of reliabilities) {
        const reasons = (r.reasons as JsonObject | null) ?? null
        if (!reasons) continue

        const teleportEvents = asArray<TeleportEvent>(reasons['teleportEvents'])
        const missingEdges = asArray<MissingEdge>(reasons['missingEdges'])

        if (teleportEvents) {
            for (const e of teleportEvents) {
                addPointToCells({
                    cells,
                    t: baseTime,
                    hrOffset: e.hourOffset,
                    lat: e.from.lat,
                    lon: e.from.lon,
                    stepDeg,
                    model,
                    varsVersion
                })

                addPointToCells({
                    cells,
                    t: baseTime,
                    hrOffset: e.hourOffset,
                    lat: e.to.lat,
                    lon: e.to.lon,
                    stepDeg,
                    model,
                    varsVersion
                })
            }
        }

        if (missingEdges) {
            for (const m of missingEdges) {
                addPointToCells({
                    cells,
                    t: baseTime,
                    hrOffset: m.hourOffset,
                    lat: m.lat,
                    lon: m.lon,
                    stepDeg,
                    model,
                    varsVersion
                })
            }
        }
    }

    const allCandidates = Array.from(cells.values())
    if (!allCandidates.length) {
        await prisma.ingestRun.update({ where: { id: runId }, data: { enrichAt: new Date() } });
        return;
    }

    // filter out cells in cache
    const minTime = new Date(Math.min(...allCandidates.map(c => c.time.getTime())))
    const maxTime = new Date(Math.max(...allCandidates.map(c => c.time.getTime())))

    const existing = await prisma.weatherCacheCell.findMany({
        where: {
            model,
            varsVersion,
            time: { gte: minTime, lte: maxTime }
        },
        select : { time: true, latBucket: true, lonBucket: true, model: true, varsVersion: true }
    })

    const existingSet = new Set(
        existing.map((r) => 
            cellKeyString({
                time: r.time,
                latBucket: Number(r.latBucket),
                lonBucket: Number(r.lonBucket),
                model: r.model,
                varsVersion: r.varsVersion
            })
        )
    )

    const missingCells = allCandidates.filter((c) => !existingSet.has(cellKeyString(c)))
    if (!missingCells.length) {
        await prisma.ingestRun.update({ where: {id: runId}, data: {enrichAt: new Date()}})
        return
    }

    // batch to avoid 414
    let requestsMade = 0;

    const groups = groupByDayAndLoc(missingCells);

    // group by day
    const byDay = new Map<string, locDayGroup[]>();
    for (const g of groups) {
        if (!byDay.has(g.day)) byDay.set(g.day, []);
        byDay.get(g.day)!.push(g);
    }

    let rowsEnriched = 0
    for (const [day, dayGroups] of byDay) {
        for (let i = 0; i < dayGroups.length; i += MAX_LOCS_PER_REQ) {
            if (requestsMade >= MAX_REQUESTS_PER_RUN) {
                const remaining = missingCells.length - rowsEnriched
                return { rowsEnriched, done: false, remaining, requestsMade };
              }
        
            const batchGroups = dayGroups.slice(i, i + MAX_LOCS_PER_REQ);
            const lats = batchGroups.map((g) => g.latBucket);
            const lons = batchGroups.map((g) => g.lonBucket);
        
            const meteo = await fetchWithBackoff(
              () => fetchOpenMeteoBatch({ lats, lons, startDate: day, endDate: day }),
              { maxRetries: 5, baseDelayMs: 1500 }
            );
        
            rowsEnriched += await writeGroupsToCache({
              groups: batchGroups,
              meteo,
              model,
              varsVersion,
            });
        
            requestsMade++;
            await new Promise((r) => setTimeout(r, MIN_DELAY_MS));
          }
    }

    await prisma.ingestRun.update({
        where: { id: runId },
        data: { enrichAt: new Date() }
    })

    return { rowsEnriched }
}