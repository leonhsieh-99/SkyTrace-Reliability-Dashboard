import Link from "next/link";

async function getRuns() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/runs?limit=25`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("failed to load runs");
  return res.json();
}

export default async function RunsPage() {
  const data = await getRuns();
  const runs = data.runs as any[];

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Runs</h1>
      <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
        {runs.map((r) => (
          <Link
            key={r.id}
            href={`/runs/${r.id}`}
            style={{
              border: "1px solid #ddd",
              borderRadius: 10,
              padding: 12,
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 700 }}>Run #{r.id}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  startedAt: {new Date(r.startedAt).toISOString()}
                </div>
              </div>

              <div style={{ textAlign: "right", fontSize: 12 }}>
                <div>ingest: {r.ingestOk ? "✅" : "❌"}</div>
                <div>reliability: {r.reliabilityAt ? "✅" : "—"}</div>
                <div>enrich: {r.enrichAt ? "✅" : "—"}</div>
              </div>
            </div>

            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>
              balloons: {r.balloonCount} • worstScore:{" "}
              {r.worstScore == null ? "—" : r.worstScore.toFixed(1)} • avgScore:{" "}
              {r.avgScore == null ? "—" : r.avgScore.toFixed(1)}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
