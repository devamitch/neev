/** "45 s", "12 min", "1 h 5 min" */
export function formatDuration(ms: number): string {
  if (!(ms > 0)) return "0 s"
  if (ms < 60_000) return `${Math.round(ms / 1000)} s`
  const m = Math.round(ms / 60_000)
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`
}
