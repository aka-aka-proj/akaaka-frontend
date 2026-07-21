export const EVENT_TYPES = [
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

export type EventType = typeof EVENT_TYPES[number];
