import type { AttendanceFeeType } from '../types'

const EDIT_LOCKED_LIFECYCLE_STATUSES = ['completed', 'archived', 'cancelled'] as const

/**
 * Security note: authorization is enforced by RLS (events_update_owner);
 * this helper only drives UX and must never be treated as the boundary.
 * Rule: docs/spec/features/events/003-event-edit-spec.md
 */
export function isEventEditLocked(event: { lifecycle_status: string; start_time: string }): boolean {
  if (event.lifecycle_status === 'draft') return false
  if ((EDIT_LOCKED_LIFECYCLE_STATUSES as readonly string[]).includes(event.lifecycle_status)) return true
  return new Date(event.start_time).getTime() <= Date.now()
}

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
