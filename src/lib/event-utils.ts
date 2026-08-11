import type { AttendanceFeeType } from '../types'

export function parseEventTypes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [raw];
  } catch {
    return [raw];
  }
}

export function stringifyEventTypes(types: string[]): string {
  return JSON.stringify(types);
}
export function getAttendanceFeeLabel(type: AttendanceFeeType, amount: number | null, locale = 'zh-TW'): string {
  if (type === 'free') return locale === 'zh-TW' ? '免費' : 'Free'
  if (type === 'see_description') return locale === 'zh-TW' ? '依活動說明' : 'See description'
  return locale === 'zh-TW' ? `NT$ ${amount ?? 0}` : `NT$ ${amount ?? 0}`
}
