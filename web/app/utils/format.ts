// Fixed locale and time zone so server (build) and browser output match.
const dateFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' })

export function formatDate(value?: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : dateFormat.format(date)
}

export function isClosed(closingDate: string | null | undefined, now: Date | null): boolean {
  if (!closingDate || !now) return false
  const date = new Date(closingDate)
  return !Number.isNaN(date.getTime()) && date.getTime() < now.getTime()
}
