function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function escapeIcsText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function sanitizeFilename(title: string): string {
  return title.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '_').slice(0, 60)
}

export function generateIcsFile(event: {
  id: string
  title: string
  description: string | null
  start_time: string
}): string {
  const start = new Date(event.start_time)
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000)

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AkaAka//Events//EN',
    'BEGIN:VEVENT',
    `UID:${event.id}@akaaka`,
    `DTSTART:${formatIcsDate(start)}`,
    `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
  ]

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`)
  }

  lines.push('END:VEVENT', 'END:VCALENDAR')

  return lines.join('\r\n')
}

export function downloadIcs(event: {
  id: string
  title: string
  description: string | null
  start_time: string
}): void {
  const icsContent = generateIcsFile(event)
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `akaaka-${sanitizeFilename(event.title)}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function getGoogleCalendarUrl(event: {
  title: string
  description: string | null
  start_time: string
}): string {
  const start = new Date(event.start_time)
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000)

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${formatIcsDate(start)}/${formatIcsDate(end)}`,
  })

  if (event.description) {
    params.set('details', event.description)
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
