import { describe, expect, it } from 'vitest'
import { validateSchedulingPollCandidates } from './event-scheduling-poll'

describe('validateSchedulingPollCandidates', () => {
  it('accepts mixed datetime and location candidates', () => {
    expect(() => validateSchedulingPollCandidates([
      { kind: 'datetime', startsAt: '2026-10-01T10:00:00Z' },
      { kind: 'location', locationLabel: 'Taoyuan' },
    ])).not.toThrow()
  })

  it('requires at least two candidates', () => {
    expect(() => validateSchedulingPollCandidates([
      { kind: 'datetime', startsAt: '2026-10-01T10:00:00Z' },
    ])).toThrow('at least two candidates')
  })

  it('rejects candidates with values for the wrong kind', () => {
    expect(() => validateSchedulingPollCandidates([
      { kind: 'datetime', startsAt: '2026-10-01T10:00:00Z', locationLabel: 'Taoyuan' },
      { kind: 'location', locationLabel: 'Taipei' },
    ])).toThrow('Datetime candidates')

    expect(() => validateSchedulingPollCandidates([
      { kind: 'location', locationLabel: 'Taoyuan', startsAt: '2026-10-01T10:00:00Z' },
      { kind: 'location', locationLabel: 'Taipei' },
    ])).toThrow('Location candidates')
  })

  it('rejects an empty location label', () => {
    expect(() => validateSchedulingPollCandidates([
      { kind: 'location', locationLabel: '   ' },
      { kind: 'location', locationLabel: 'Taipei' },
    ])).toThrow('Location candidates')
  })
})
