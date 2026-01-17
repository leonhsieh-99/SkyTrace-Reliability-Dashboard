import Link from "next/link";

async function getBalloons(id: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/runs/${id}/balloons?limit=80&maxScore=80`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("failed to load balloons");
  return res.json();
}

export default async function RunDetailPage({ params }: { params: { id: string } }) {
  const { id } = await params
  const data = await getBalloons(id);
  const balloons = data.balloons as any[];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Run #{id}</h1>
        <Link href="/runs">← back</Link>
      </div>

      <div style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>Worst balloons</h2>

        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          {balloons.map((b) => (
            <Link
              key={b.balloonIndex}
              href={`/runs/${id}?balloon=${b.balloonIndex}`}
              style={{
                border: "1px solid #ddd",
                borderRadius: 10,
                padding: 12,
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontWeight: 700 }}>Balloon {b.balloonIndex}</div>
                <div style={{ fontWeight: 700 }}>score {b.score.toFixed(1)}</div>
              </div>

              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
                missing={b.missingCount} • maxGap={b.maxGap} • teleports={b.teleportCount} •
                gt350={b.reasonsSummary?.teleports?.gt350 ?? 0} • gt600={b.reasonsSummary?.teleports?.gt600 ?? 0}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
