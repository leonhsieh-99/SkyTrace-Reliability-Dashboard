import { THRESHOLD } from "@/lib/constants";
import { prisma } from "@/prisma";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
    const url = req.nextUrl
    const searchParams = url.searchParams
    const limit = Math.min(Number(searchParams.get('limit') ?? 20), 100)

    
}