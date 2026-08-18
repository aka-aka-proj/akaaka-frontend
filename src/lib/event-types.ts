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
  'Drinking',
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
  'UrgentOne',
] as const;

export const EVENT_TYPES = [...SOCIAL_TAGS, ...PRACTICE_TAGS] as const;

export type EventType = typeof EVENT_TYPES[number];

export const EVENT_TYPE_I18N_KEY_MAP: Record<string, string> = {
  'Drinking': 'drinking',
  'Dining': 'dining',
  'BBQ': 'bbq',
  'Karaoke': 'karaoke',
  'Movie': 'movie',
  'BoardGame': 'boardGame',
  'Travel': 'travel',
  'BookClub': 'bookClub',
  'Conversation': 'conversation',
  'SpeedDating': 'speedDating',
  'HangOut': 'hangOut',
  'UrgentOne': 'urgentOne',
  'Bondage': 'bondage',
  'Discipline': 'discipline',
  'Dominance / Submission': 'dominanceSubmission',
  'D/S': 'ds',
  'Sadism / Masochism': 'sadismMasochism',
  'SM': 'sm',
  'SP': 'sp',
  'Spanking': 'spanking',
  'TK': 'tk',
  'Tickling': 'tickling',
  'K9': 'k9',
  'DID': 'did',
  'CNC': 'cnc',
  'DDLG': 'ddlg',
  '4 love': 'fourLove',
  'ABDL': 'abdl',
}

export function getEventTypeI18nKey(type: string): string {
  const key = EVENT_TYPE_I18N_KEY_MAP[type]
  return key ? `eventTypes.${key}` : type
}

export function hasPracticeTag(eventType: string[]): boolean {
  return eventType.some(t => (PRACTICE_TAGS as readonly string[]).includes(t))
}

export function getEffectiveCategory(category: string, eventType: string[]): 'Social' | 'Practice' {
  if (hasPracticeTag(eventType)) return 'Practice'
  return category as 'Social' | 'Practice'
}
