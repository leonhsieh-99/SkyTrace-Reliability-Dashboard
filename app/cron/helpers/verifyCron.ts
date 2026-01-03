import { NextRequest } from "next/server"

export function verifyCron(req: NextRequest) {
    const auth = req.headers.get('authorization')
    const expected = `Bearer ${process.env.CRON_SECRET}`

    if (!auth || auth !== expected) {
        throw new Error('Unauthorized cron request')
    }
}
