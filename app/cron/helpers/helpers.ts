import { JsonValue } from "@prisma/client/runtime/library";

export type TeleportEvent = { hourOffset: number; from: {lat: number; lon: number}; to: {lat: number; lon: number}; dtHours: number; speed: number }
export type MissingEdge = { hourOffset: number; kind: "gap_start" | "gap_end"; lat: number; lon: number }

export async function fetchHr(hr: string) {
  const BASE_URL = "https://a.windbornesystems.com/treasure";

  const res = await fetch(`${BASE_URL}/${hr}.json`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch hour ${hr}: ${res.status}`);
  }

  return res.json();
}

export function asArray<T = any>(v: JsonValue | undefined): T[] | null {
  return Array.isArray(v) ? (v as T[]) : null;
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function fetchWithBackoff<T>(
  fn: () => Promise<T>,
  opts?: { maxRetries?: number; baseDelayMs?: number }
) {
  const maxRetries = opts?.maxRetries ?? 5
  const baseDelayMs = opts?.baseDelayMs ?? 1200

  let attemp = 0
  while (true) {
    try {
      return await fn()
    } catch(e:any) {
      attemp++
      if (attemp > maxRetries) throw e

      const retryAfterMs = typeof e?.retryAfterMs === 'number' ? e.retryAfterMs : null
      const delay = retryAfterMs ?? Math.min(60_000, baseDelayMs * Math.pow(2, attemp - 1))

      await new Promise((r) => setTimeout(r, delay))
    }
  }
}