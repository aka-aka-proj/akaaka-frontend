import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { SeriesCard } from './SeriesCard'
import type { EventSeriesWithMembers } from '../hooks/useEventSeries'
import type { EventItem } from '../types'

function event(id: string, title: string): EventItem {
  return {
    id,
    creator_id: 'creator-1',
    title,
    description: null,
    category: 'Social',
    lifecycle_status: 'published',
    publication_status: 'published',
    publish_at: null,
    unpublish_at: null,
    event_type: 'social',
    is_venue_hosted: false,
    attendance_fee_type: 'free',
    attendance_fee_amount: null,
    visibility_settings: { type: 'public' },
    registration_form_config: null,
    recurrence_rule: null,
    series_id: 'series-1',
    start_time: '2026-08-27T10:00:00Z',
    location_region: null,
    location_detail: null,
    max_capacity: null,
    registration_deadline: null,
    external_registration_url: null,
    source_url: null,
    creator_display_name: null,
    creator_avatar_path: null,
    created_at: '2026-08-01T00:00:00Z',
  }
}

const series: EventSeriesWithMembers = {
  id: 'series-1',
  creator_id: 'creator-1',
  title: 'A four-session series',
  description: null,
  is_whole_series_required: false,
  display_order: 0,
  lifecycle_status: 'published',
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
  members: [
    { event_id: 'event-1', position: 1 },
    { event_id: 'event-2', position: 2 },
    { event_id: 'event-3', position: 3 },
    { event_id: 'event-4', position: 4 },
  ],
}

describe('SeriesCard', () => {
  it('keeps the full series count when filters leave only one loaded event', () => {
    render(
      <BrowserRouter>
        <SeriesCard series={series} memberEvents={[event('event-2', 'Visible session')]} />
      </BrowserRouter>,
    )

    expect(screen.getByText((content) => content.includes('+3'))).toBeTruthy()
  })
})
