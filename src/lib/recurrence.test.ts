import { describe, expect, it } from 'vitest'
import { generateRecurringDates, validateRecurrenceRule } from './recurrence'

// Shared canonical test vectors — must stay in sync with akaaka-iac supabase/functions/_shared/recurrence_test.ts.

const iso = (dates: Date[]) => dates.map((date) => date.toISOString())

const v1BaseSunday = new Date('2026-03-15T14:00:00.000Z')

describe('generateRecurringDates', () => {
  it('V1 weekly recurrence with multi-day selection and interval 2', () => {
    const dates = generateRecurringDates(v1BaseSunday, { frequency: 'weekly', interval: 2, days: ['Mon', 'Wed'], count: 5 })
    expect(iso(dates)).toEqual([
      '2026-03-16T14:00:00.000Z',
      '2026-03-18T14:00:00.000Z',
      '2026-03-30T14:00:00.000Z',
      '2026-04-01T14:00:00.000Z',
    ])
  })

  it('V2 weekly recurrence defaults to base weekday when days omitted or empty', () => {
    const omitted = generateRecurringDates(v1BaseSunday, { frequency: 'weekly', interval: 1, count: 3 })
    const empty = generateRecurringDates(v1BaseSunday, { frequency: 'weekly', interval: 1, days: [], count: 3 })
    expect(iso(empty)).toEqual(['2026-03-22T14:00:00.000Z', '2026-03-29T14:00:00.000Z'])
    expect(iso(omitted)).toEqual(iso(empty))
  })

  it('V3 monthly by-date clamps to end of short months', () => {
    const dates = generateRecurringDates(new Date('2026-01-31T09:00:00.000Z'), { frequency: 'monthly', interval: 1, count: 4 })
    expect(iso(dates)).toEqual([
      '2026-02-28T09:00:00.000Z',
      '2026-03-31T09:00:00.000Z',
      '2026-04-30T09:00:00.000Z',
    ])
  })

  it('V4 monthly weekday mode takes the Nth occurrence of the selected weekday', () => {
    const dates = generateRecurringDates(v1BaseSunday, {
      frequency: 'monthly',
      monthly_by: 'weekday',
      week_ordinal: 3,
      days: ['Wed'],
      interval: 1,
      count: 4,
    })
    expect(iso(dates)).toEqual([
      '2026-03-18T14:00:00.000Z',
      '2026-04-15T14:00:00.000Z',
      '2026-05-20T14:00:00.000Z',
    ])
  })

  it('V5 monthly weekday mode treats ordinal 5 as the last occurrence', () => {
    const dates = generateRecurringDates(v1BaseSunday, {
      frequency: 'monthly',
      monthly_by: 'weekday',
      week_ordinal: 5,
      days: ['Fri'],
      interval: 1,
      count: 3,
    })
    expect(iso(dates)).toEqual(['2026-03-27T14:00:00.000Z', '2026-04-24T14:00:00.000Z'])
  })

  it('V6 until keeps candidates on or before the cutoff', () => {
    const dates = generateRecurringDates(new Date('2026-03-15T10:00:00.000Z'), {
      frequency: 'weekly',
      interval: 1,
      until: '2026-03-22T10:00:00.000Z',
    })
    expect(iso(dates)).toEqual(['2026-03-22T10:00:00.000Z'])
  })

  it('V8 monthly weekday skips a candidate identical to the base event', () => {
    const dates = generateRecurringDates(new Date('2026-03-18T14:00:00.000Z'), {
      frequency: 'monthly',
      monthly_by: 'weekday',
      week_ordinal: 3,
      days: ['Wed'],
      interval: 1,
      count: 2,
    })
    expect(iso(dates)).toEqual(['2026-04-15T14:00:00.000Z'])
  })

  it('V10 monthly weekday sorts same-month candidates chronologically', () => {
    const dates = generateRecurringDates(new Date('2026-02-01T08:00:00.000Z'), {
      frequency: 'monthly',
      monthly_by: 'weekday',
      week_ordinal: 5,
      days: ['Sat', 'Sun'],
      interval: 1,
      count: 4,
    })
    expect(iso(dates)).toEqual([
      '2026-02-22T08:00:00.000Z',
      '2026-02-28T08:00:00.000Z',
      '2026-03-28T08:00:00.000Z',
    ])
  })
})

describe('validateRecurrenceRule', () => {
  it('V7 count and until are mutually exclusive and at least one is required', () => {
    expect(validateRecurrenceRule({ frequency: 'weekly', interval: 1, count: 4, until: '2026-04-15T00:00:00.000Z' })).toBe(
      'provide either count or until, not both',
    )
    expect(validateRecurrenceRule({ frequency: 'weekly', interval: 1 })).toBe('provide either count or until, not both')
  })

  it('V9 rejects invalid monthly weekday rules', () => {
    expect(validateRecurrenceRule({ frequency: 'monthly', monthly_by: 'weekday', days: ['Wed'], interval: 1, count: 2 })).toBe(
      'week_ordinal must be an integer between 1 and 5',
    )
    expect(validateRecurrenceRule({ frequency: 'monthly', monthly_by: 'weekday', week_ordinal: 6, days: ['Wed'], interval: 1, count: 2 })).toBe(
      'week_ordinal must be an integer between 1 and 5',
    )
    expect(validateRecurrenceRule({ frequency: 'monthly', monthly_by: 'weekday', week_ordinal: 2, interval: 1, count: 2 })).toBe(
      'days must contain at least one weekday when monthly_by is "weekday"',
    )
    expect(validateRecurrenceRule({ frequency: 'monthly', monthly_by: 'date', week_ordinal: 2, interval: 1, count: 2 })).toBe(
      'week_ordinal is only allowed when monthly_by is "weekday"',
    )
    expect(validateRecurrenceRule({ frequency: 'weekly', monthly_by: 'weekday', week_ordinal: 2, days: ['Mon'], interval: 1, count: 2 })).toBe(
      'monthly_by and week_ordinal are only allowed for monthly frequency',
    )
    expect(validateRecurrenceRule({ frequency: 'monthly', monthly_by: 'yearly', interval: 1, count: 2 })).toBe(
      'monthly_by must be "date" or "weekday"',
    )
  })

  it('accepts valid rules from both limit modes', () => {
    expect(validateRecurrenceRule({ frequency: 'weekly', interval: 1, days: ['Mon'], count: 4 })).toBeNull()
    expect(validateRecurrenceRule({ frequency: 'monthly', interval: 2, until: '2026-12-01T00:00:00.000Z' })).toBeNull()
    expect(
      validateRecurrenceRule({ frequency: 'monthly', monthly_by: 'weekday', week_ordinal: 5, days: ['Sat', 'Sun'], interval: 1, count: 6 }),
    ).toBeNull()
  })
})
