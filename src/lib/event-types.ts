export const PRACTICE_TAGS = [
  'Bondage',
  'Discipline',
  'Dominance / Submission',
  'D/S',
  'Sadism / Masochism',
  'SM',
  'SP',
  'Spanking',
  'TK',
  'Tickling',
  'K9',
  'DID',
  'CNC',
  'DDLG',
  '4 love',
  'ABDL',
] as const;

export const SOCIAL_TAGS = [
  'Dining',
  'BBQ',
  'Karaoke',
  'Movie',
  'BoardGame',
  'Travel',
  'BookClub',
  'Conversation',
  'SpeedDating',
  'HangOut',
] as const;

export const EVENT_TYPES = [...PRACTICE_TAGS, ...SOCIAL_TAGS] as const;

export type EventType = typeof EVENT_TYPES[number];

export function hasPracticeTag(eventType: string[]): boolean {
  return eventType.some(t => (PRACTICE_TAGS as readonly string[]).includes(t))
}

export function getEffectiveCategory(category: string, eventType: string[]): 'Social' | 'Practice' {
  if (hasPracticeTag(eventType)) return 'Practice'
  return category as 'Social' | 'Practice'
}
