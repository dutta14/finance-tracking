export const COLOR_PALETTES = [
  { id: 'blue',   label: 'Blue',   color: '#3b82f6' },
  { id: 'green',  label: 'Green',  color: '#22c55e' },
  { id: 'red',    label: 'Red',    color: '#ef4444' },
  { id: 'amber',  label: 'Amber',  color: '#f59e0b' },
  { id: 'purple', label: 'Purple', color: '#a855f7' },
  { id: 'orange', label: 'Orange', color: '#f97316' },
  { id: 'teal',   label: 'Teal',   color: '#14b8a6' },
  { id: 'rose',   label: 'Rose',   color: '#f43f5e' },
  { id: 'slate',  label: 'Slate',  color: '#64748b' },
]

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
