import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const hourParam = searchParams.get('hour')

    if (!hourParam) {
        return NextResponse.json(
            { error: 'Missing hourParam param' },
            { status: 400 }
        )
    }

    const hour = Number(hourParam)
    if (Number.isNaN(hour) || hour < 0 || hour > 23) {
        return NextResponse.json(
            { error: 'Hour must be between 0 and 23' },
            { status: 400 }
        )
    }

    const BASE_URL = 'https://a.windbornesystems.com/treasure'
    const hour_str = hour.toString().padStart(2, '0')

    const url = `${BASE_URL}/${hour_str}.json`

    try {
        const res = await fetch(url, { cache: 'no-store' })

        if (!res.ok) {
            return NextResponse.json(
                { error: 'Failed to fetch API' },
                { status: res.status }
            )
        }

        const data = await res.json()
        console.log(data.length)
        console.log(data[0], data[12], data[50], data[100], data[360], data[700], data[1000])
        return NextResponse.json({
            hour,
            source: url,
            data,
        })
    } catch (err) {
        return NextResponse.json(
            { error: 'Error contacting external API' },
            { status: 500 }
        )
    }
}