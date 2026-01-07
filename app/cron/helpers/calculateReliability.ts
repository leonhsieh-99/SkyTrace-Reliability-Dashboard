import { prisma } from "@/prisma"
import { json } from "stream/consumers"

type point = { lat: number; lon: number; alt: number | null }
type Series = Array<point | null>
type TeleportEvent = { hourOffset: number; from: {lat: number; lon: number}; to: {lat: number; lon: number}; dtHours: number; speed: number }
type MissingEdge = { hourOffset: number; kind: "gap_start" | "gap_end"; lat: number; lon: number }

const radian = ([a, b, c, d]: number[]) => ([a, b, c, d]).map(x => x * Math.PI / 180)

function computeHaversine(lat1: number, lat2: number, lon1: number, lon2:number, delta_time: number) {
    [lat1, lat2, lon1, lon2] = radian([lat1, lat2, lon1, lon2])
    const delta_lat = Math.abs(lat1 - lat2)
    const delta_lon = Math.abs(lon1 - lon2)

    const a = Math.pow(Math.sin(delta_lat/2), 2) + (Math.cos(lat1)*Math.cos(lat2)*Math.pow(Math.sin(delta_lon/2), 2))
    const c = 2 * Math.atan2(Math.pow(a, 0.5), Math.pow(1 - a, 0.5))
    const R = 6371
    const distance = c * R

    const speed = distance / delta_time
    return speed
}

function bearingRad(a: point, b: point) {
    const [lat1, lat2, lon1, lon2] = radian([a.lat, b.lat, a.lon, b.lon])
    const dLon = lon2 - lon1
    const y = Math.sin(dLon) * Math.cos(lat2)
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
    let brng = Math.atan2(y, x) // [-pi, pi]
    if (brng < 0) brng += 2 * Math.PI // [0, 2pi)
    return brng
  }
  
  function angleDeltaDeg(b1: number, b2: number) {
    // smallest difference between two bearings in degrees [0, 180]
    const d = Math.abs(b2 - b1)
    const wrapped = Math.min(d, 2 * Math.PI - d)
    return (wrapped * 180) / Math.PI
  }
  
  function computeMetrics(series: Series) {
    const metrics = {
      score: 0,
      missingCount: 0,
      teleportCount: 0,
      maxGap: 0,
      reasons: {} as any,
    }
  
    let maxSpeed = 0
    const teleports = { maxSpeed: 0, gt200: 0, gt350: 0, gt600: 0 }
    let teleportEvents = Array<TeleportEvent>()
    const turns = { gt90: 0, gt135: 0 }
    const alts = { maxAlt: 0, gt5: 0, gt10: 0 }
    let missingEdges = Array<MissingEdge>()
  
    let prev: point | null = null
    let prevPrev: point | null = null
    let prevBearing: number | null = null
  
    let deltaTime = 1 // hours since last valid point
    let gap = 0
    let hr = 0

    let inGap = false
    let lastValid: point | null = null
  
    for (const cur of series) {
      if (!cur) {
        if (!inGap && lastValid) {
            missingEdges.push({ hourOffset: hr, kind: "gap_start", lat: lastValid.lat, lon: lastValid.lon })
        }
        metrics.missingCount++
        gap++
        hr++
        deltaTime++
        continue
      }

      if (inGap) {
        // first valid point after gap
        missingEdges.push({ hourOffset: hr, kind: "gap_end", lat: cur.lat, lon: cur.lon });
        inGap = false;
      }
  
      // close a gap
      metrics.maxGap = Math.max(metrics.maxGap, gap)
      gap = 0
  
      if (prev) {
        // speed (km/h)
        const speed = computeHaversine(prev.lat, cur.lat, prev.lon, cur.lon, deltaTime)
        maxSpeed = Math.max(maxSpeed, speed)
        teleports.maxSpeed = maxSpeed
  
        if (speed > 350) {
            metrics.teleportCount++
            teleportEvents.push({
                hourOffset: hr,
                from: { lat: prev.lat, lon: prev.lon },
                to: { lat: cur.lat, lon: cur.lon },
                dtHours: deltaTime,
                speed,
            })
        }
  
        if (speed > 600) teleports.gt600++
        else if (speed > 350) teleports.gt350++
        else if (speed > 200) teleports.gt200++
  
        // altitude jump
        if (prev.alt != null && cur.alt != null) {
            const dAlt = Math.abs(prev.alt - cur.alt)
            alts.maxAlt = Math.max(alts.maxAlt, dAlt)
            if (dAlt > 10) alts.gt10++
            else if (dAlt > 5) alts.gt5++
        }
  
        // turn angle
        if (prevPrev) {
          const b1 = prevBearing ?? bearingRad(prevPrev, prev)
          const b2 = bearingRad(prev, cur)
          const turnDeg = angleDeltaDeg(b1, b2)
  
          if (turnDeg > 135) turns.gt135++
          else if (turnDeg > 90) turns.gt90++
  
          prevBearing = b2
        } else {
          prevBearing = bearingRad(prev, cur)
        }
      }

      inGap = true; 
      lastValid = cur
      prevPrev = prev
      prev = cur
      deltaTime = 1
      hr++
    }
  
    metrics.maxGap = Math.max(metrics.maxGap, gap) // if series ends missing
  
    // scoring
    let score = 100
    const missingScore = metrics.missingCount * 2 + metrics.maxGap * 5

    const teleportScore = Math.min(
      45,
      6 * Math.sqrt(teleports.gt200) +
      10 * Math.sqrt(teleports.gt350) +
      14 * Math.sqrt(teleports.gt600)
    )
    
    const turnScore = 5 * turns.gt135 + 2 * turns.gt90
    const altScore = 3 * alts.gt10 + 1 * alts.gt5
    
    metrics.score = Math.max(0, 100 - missingScore - teleportScore - turnScore - altScore)    
    metrics.reasons = { maxSpeed, teleports, teleportEvents, turns, missingEdges, alts }
  
    return metrics
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

    const rows: Array<{
        runId: number
        balloonIndex: number
        score: number
        missingCount: number
        teleportCount: number
        maxGap: number
        reasons: any
    }> = []
    
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

    await prisma.reliability.deleteMany({where: {runId}}),
    await prisma.reliability.createMany({data: rows}),
    await prisma.ingestRun.update({
        where: { id: runId },
        data: { reliabilityAt: new Date()}
    })

    return { runId, balloons: rows.length }
}