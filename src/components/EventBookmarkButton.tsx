import { useState } from 'react'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'

interface EventBookmarkButtonProps {
  eventId: string
  isBookmarked: boolean
  onChange: (bookmarked: boolean) => void
}

export function EventBookmarkButton({ eventId, isBookmarked, onChange }: EventBookmarkButtonProps) {
  const { t } = useT()
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  const toggle = async () => {
    if (busy) return
    setBusy(true)
    setError(false)
    const nextValue = !isBookmarked
    onChange(nextValue)

    const result = nextValue
      ? user
        ? await supabase.from('event_bookmarks').upsert({ profile_id: user.id, event_id: eventId }, { onConflict: 'profile_id,event_id' })
        : { error: new Error('Authentication required') }
      : await supabase.from('event_bookmarks').delete().eq('event_id', eventId)

    if (result.error) {
      onChange(isBookmarked)
      setError(true)
    }
    setBusy(false)
  }

  return (
    <span className="event-bookmark-control">
      <button
        type="button"
        className="calendar-btn event-bookmark-button"
        aria-pressed={isBookmarked}
        aria-label={isBookmarked ? t('events.removeBookmark') : t('events.bookmark')}
        disabled={busy}
        onClick={() => void toggle()}
      >
        <span aria-hidden="true">{isBookmarked ? '♥' : '♡'}</span>
        {isBookmarked ? t('events.bookmarked') : t('events.bookmark')}
      </button>
      {error ? <span className="event-bookmark-error" role="status">{t('events.bookmarkError')}</span> : null}
    </span>
  )
}
