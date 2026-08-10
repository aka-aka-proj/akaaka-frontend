import { EVENT_TYPES } from './event-types'
import type { EventCategory, TaiwanRegion } from '../types'

export interface OrganizedEventIdea {
  title?: string
  description?: string
  category?: EventCategory
  eventType?: string[]
  startTime?: string
  locationRegion?: TaiwanRegion
}

/**
 * Replaceable client adapter for the first draft flow. It deliberately only
 * pre-fills fields; it never persists or publishes an event.
 */
export function organizeEventIdea(input: string): OrganizedEventIdea {
  const text = input.trim()
  if (!text) return {}

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const title = lines[0]?.replace(/^(活動名稱|標題)[:：]\s*/i, '').slice(0, 120)
  const eventType = EVENT_TYPES.filter((type) => text.toLowerCase().includes(type.toLowerCase()))
  const isPractice = /BDSM|Bondage|D\/S|SM|SP|Spanking|CNC|DDLG|ABDL/i.test(text)
  const regionMatch = text.match(/北部|中部|南部|東部|離島|線上|North|Central|South|East|Islands|Online/i)?.[0]
  const regionMap: Record<string, TaiwanRegion> = {
    北部: 'North', 中部: 'Central', 南部: 'South', 東部: 'East', 離島: 'Islands', 線上: 'Online',
    north: 'North', central: 'Central', south: 'South', east: 'East', islands: 'Islands', online: 'Online',
  }

  return {
    title,
    description: lines.slice(1).join('\n') || text,
    category: isPractice ? 'Practice' : 'Social',
    eventType,
    locationRegion: regionMatch ? regionMap[regionMatch.toLowerCase()] ?? regionMap[regionMatch] : undefined,
  }
}
