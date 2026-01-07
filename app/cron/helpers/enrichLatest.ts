type TeleportEvent = { hourOffset: number; from: {lat: number; lon: number}; to: {lat: number; lon: number}; dtHours: number; speed: number }
type MissingEdge = { hourOffset: number; kind: "gap_start" | "gap_end"; lat: number; lon: number }

type EnrichOptions = {
    model?: "gfs" | "hrrr";
    varsVersion?: string; // bump when var changes
    bucketStepDeg?: number; // e.g. 1, 0.5, 0.25
    scoreThreshold?: number; // e.g. 75
    teleportSpeedMin?: number; // e.g. 350
    maxTeleportsPerBalloon?: number; // e.g. 3
    includeBaselineSample?: number;  // e.g. 50 balloons w/ score>75
    batchSize?: number; // locations per Open-Meteo call
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
    if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(`Open-Meteo error ${res.status}: ${txt.slice(0, 300)}`);
    }
    return res.json()
}