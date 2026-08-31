import { describe, expect, it } from 'vitest'
import { generateRecurringDates, validateRecurrenceRule, RecurrenceSeriesTooLongError } from './recurrence'
import type { UnvalidatedRecurrenceRule } from './recurrence'
import type { RecurrenceRule } from '../types'

// Shared canonical test vectors — must stay in sync with akaaka-iac supabase/functions/_shared/recurrence_test.ts (main).

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

  it('V11 count = 1 generates no follow-up copies', () => {
    const weekly = generateRecurringDates(v1BaseSunday, { frequency: 'weekly', interval: 2, days: ['Mon'], count: 1 })
    const monthly = generateRecurringDates(new Date('2026-01-31T09:00:00.000Z'), { frequency: 'monthly', interval: 1, count: 1 })
    expect(iso(weekly)).toEqual([])
    expect(iso(monthly)).toEqual([])
  })

  it('V12b generation applies a non-string until as a real cutoff instead of ignoring it', () => {
    const dates = generateRecurringDates(v1BaseSunday, { frequency: 'weekly', interval: 1, until: 0 } as unknown as RecurrenceRule)
    expect(iso(dates)).toEqual([])
  })

  it('V13 until series exceeding 52 total events is rejected, not truncated', () => {
    let thrown: unknown
    try {
      generateRecurringDates(new Date('2026-08-10T12:00:00.000Z'), {
        frequency: 'weekly',
        interval: 1,
        until: '2030-01-01T12:00:00.000Z',
      })
    } catch (err) {
      thrown = err
    }
    expect(thrown instanceof RecurrenceSeriesTooLongError).toBe(true)
  })

  it('V14 until series of exactly 52 total events succeeds', () => {
    const dates = generateRecurringDates(new Date('2026-08-10T12:00:00.000Z'), {
      frequency: 'weekly',
      interval: 1,
      until: '2027-08-02T12:00:00.000Z',
    })
    expect(dates.length).toBe(51)
  })

  it('V15 weekly weekdays are resolved in the rule timezone, not UTC', () => {
    const base = new Date('2026-08-10T17:30:00.000Z') // Mon 16:30Z = Tue 01:30 Asia/Taipei
    const tuesdays = generateRecurringDates(base, { frequency: 'weekly', interval: 1, days: ['Tue'], count: 4, timezone: 'Asia/Taipei' })
    expect(iso(tuesdays)).toEqual([
      '2026-08-17T17:30:00.000Z',
      '2026-08-24T17:30:00.000Z',
      '2026-08-31T17:30:00.000Z',
    ])
    const mondays = generateRecurringDates(base, { frequency: 'weekly', interval: 1, days: ['Mon'], count: 3, timezone: 'Asia/Taipei' })
    expect(iso(mondays)).toEqual([
      '2026-08-16T17:30:00.000Z',
      '2026-08-23T17:30:00.000Z',
    ])
  })

  it('V16 monthly by-date clamps to the end of short months in the rule timezone', () => {
    const dates = generateRecurringDates(new Date('2026-01-31T04:00:00.000Z'), {
      frequency: 'monthly',
      interval: 1,
      count: 4,
      timezone: 'Asia/Taipei',
    })
    expect(iso(dates)).toEqual([
      '2026-02-28T04:00:00.000Z',
      '2026-03-31T04:00:00.000Z',
      '2026-04-30T04:00:00.000Z',
    ])
  })

  it('V17 monthly nth-weekday candidates strictly after the base instant across time zones', () => {
    const dates = generateRecurringDates(new Date('2026-03-15T16:30:00.000Z'), {
      frequency: 'monthly',
      monthly_by: 'weekday',
      week_ordinal: 3,
      days: ['Mon'],
      interval: 1,
      count: 4,
      timezone: 'Asia/Taipei',
    })
    expect(iso(dates)).toEqual([
      '2026-04-19T16:30:00.000Z',
      '2026-05-17T16:30:00.000Z',
      '2026-06-14T16:30:00.000Z',
    ])
  })

  it('V21 monthly by-date steps by interval months from the base event', () => {
    const dates = generateRecurringDates(new Date('2026-03-15T09:00:00.000Z'), { frequency: 'monthly', interval: 2, count: 4 })
    expect(iso(dates)).toEqual([
      '2026-05-15T09:00:00.000Z',
      '2026-07-15T09:00:00.000Z',
      '2026-09-15T09:00:00.000Z',
    ])
  })

  it('V22 DST spring-forward gap resolves to the instant after the transition', () => {
    const base = new Date('2026-03-22T01:30:00.000Z') // Berlin 02:30, one week before the gap
    const dates = generateRecurringDates(base, {
      frequency: 'weekly',
      interval: 1,
      days: ['Sun'],
      count: 3,
      timezone: 'Europe/Berlin',
    })
    expect(iso(dates)).toEqual([
      '2026-03-29T01:30:00.000Z', // requested 02:30 does not exist → lands on 03:30 local
      '2026-04-05T00:30:00.000Z',
    ])
  })
})

describe('validateRecurrenceRule', () => {
  it('V7 count and until are mutually exclusive and at least one is required', () => {
    expect(
      validateRecurrenceRule({ frequency: 'weekly', interval: 1, count: 4, until: '2026-04-15T00:00:00.000Z', timezone: 'UTC' }),
    ).toBe('provide either count or until, not both')
    expect(validateRecurrenceRule({ frequency: 'weekly', interval: 1, timezone: 'UTC' })).toBe(
      'provide either count or until, not both',
    )
  })

  it('V9 rejects invalid monthly weekday rules', () => {
    expect(
      validateRecurrenceRule({ frequency: 'monthly', monthly_by: 'weekday', days: ['Wed'], interval: 1, count: 2, timezone: 'UTC' }),
    ).toBe('week_ordinal must be an integer between 1 and 5')
    expect(
      validateRecurrenceRule({ frequency: 'monthly', monthly_by: 'weekday', week_ordinal: 6, days: ['Wed'], interval: 1, count: 2, timezone: 'UTC' }),
    ).toBe('week_ordinal must be an integer between 1 and 5')
    expect(
      validateRecurrenceRule({ frequency: 'monthly', monthly_by: 'weekday', week_ordinal: 2, interval: 1, count: 2, timezone: 'UTC' }),
    ).toBe('days must contain at least one weekday when monthly_by is "weekday"')
    expect(
      validateRecurrenceRule({ frequency: 'monthly', monthly_by: 'date', week_ordinal: 2, interval: 1, count: 2, timezone: 'UTC' }),
    ).toBe('field "week_ordinal" is not allowed for monthly recurrence')
    expect(
      validateRecurrenceRule({ frequency: 'weekly', monthly_by: 'weekday', week_ordinal: 2, days: ['Mon'], interval: 1, count: 2, timezone: 'UTC' }),
    ).toBe('field "monthly_by" is not allowed for weekly recurrence')
    expect(validateRecurrenceRule({ frequency: 'monthly', monthly_by: 'yearly', interval: 1, count: 2, timezone: 'UTC' })).toBe(
      'monthly_by must be "date" or "weekday"',
    )
  })

  function ruleWithExtraFields(fields: Record<string, unknown>): UnvalidatedRecurrenceRule {
    return { ...fields } as unknown as UnvalidatedRecurrenceRule
  }

  it('V18 new-style rules reject fields outside their mode whitelist', () => {
    expect(
      validateRecurrenceRule(ruleWithExtraFields({
        frequency: 'weekly',
        interval: 1,
        monthly_by: 'weekday',
        week_ordinal: 2,
        days: ['Mon'],
        count: 2,
        timezone: 'UTC',
      })),
    ).toBe('field "monthly_by" is not allowed for weekly recurrence')
    expect(
      validateRecurrenceRule(ruleWithExtraFields({
        frequency: 'monthly',
        monthly_by: 'date',
        interval: 1,
        days: ['Mon'],
        count: 2,
        timezone: 'UTC',
      })),
    ).toBe('field "days" is not allowed for monthly recurrence')
    expect(
      validateRecurrenceRule(ruleWithExtraFields({
        frequency: 'weekly',
        intervl: 3,
        interval: 1,
        count: 2,
        timezone: 'UTC',
      })),
    ).toBe('field "intervl" is not allowed for weekly recurrence')
  })

  it('V12 rejects non-string or empty until values', () => {
    for (const until of [0, false, '', 123]) {
      expect(validateRecurrenceRule({ frequency: 'weekly', interval: 1, until } as unknown as UnvalidatedRecurrenceRule)).toBe(
        'until must be a valid timestamp',
      )
    }
  })

  it('V20 legacy payload shapes are rejected once the compat period ends', () => {
    expect(validateRecurrenceRule({ frequency: 'weekly', interval: 1, count: 4 })).toBe(
      'timezone must be a valid IANA time zone name',
    )
    expect(validateRecurrenceRule({ frequency: 'weekly', interval: 1, count: 2, until: '2026-09-30T00:00:00.000Z' })).toBe(
      'timezone must be a valid IANA time zone name',
    )
  })

  it('V19 timezone must be a valid IANA name on every payload', () => {
    expect(validateRecurrenceRule({ frequency: 'weekly', interval: 1, count: 2, timezone: 'Mars/Olympus' })).toBe(
      'timezone must be a valid IANA time zone name',
    )
    expect(
      validateRecurrenceRule(ruleWithExtraFields({ frequency: 'weekly', interval: 1, count: 2, timezone: 123 })),
    ).toBe('timezone must be a valid IANA time zone name')
  })
})
