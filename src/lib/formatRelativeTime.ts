export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const t = d.getTime()
  if (Number.isNaN(t)) return ''
  const diff = Date.now() - t
  if (diff < 45_000) return 'now'
  const min = Math.floor(diff / 60_000)
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
