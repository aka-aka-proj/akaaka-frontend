import { useMemo, useState } from 'react'
import { useT } from '../hooks/useT'
import { useIsEventInSeries } from '../hooks/useEventSeries'
import { supabase } from '../supabaseClient'
import type { EventItem } from '../types'

interface SeriesRegistrationFlowProps {
  event: EventItem
  userId: string
  eventId: string
  submitting: boolean
  setSubmitting: (v: boolean) => void
  onRegistrationChanged: () => void
  showError: (msg: string) => void
}

export function SeriesRegistrationFlow({
  event,
  userId,
  eventId,
  submitting,
  setSubmitting,
  onRegistrationChanged,
  showError,
}: SeriesRegistrationFlowProps) {
  const { t } = useT()
  const { seriesId } = useIsEventInSeries(eventId)
  const [registrationMode, setRegistrationMode] = useState<'single' | 'series'>('single')

  const isWholeSeriesRequired = false // populated from series data if needed

  if (!seriesId) return null

  const handleSeriesRegister = async () => {
    setSubmitting(true)
    const { error } = await supabase.functions.invoke('register-for-event-series', {
      body: { series_id: seriesId },
    })
    setSubmitting(false)
    if (error) {
      showError(error.message)
      return
    }
    onRegistrationChanged()
  }

  return (
    <div className="series-registration-section">
      <div className="registration-mode-toggle">
        {!isWholeSeriesRequired && (
          <>
            <label className={`radio-option${registrationMode === 'series' ? ' active' : ''}`}>
              <input
                type="radio"
                name="reg-mode"
                checked={registrationMode === 'series'}
                onChange={() => setRegistrationMode('series')}
              />
              <div>
                <strong>{t('eventSeries.modeWholeSeries')}</strong>
                <span className="option-hint">{t('eventSeries.modeWholeSeriesHint')}</span>
              </div>
            </label>
            <label className={`radio-option${registrationMode === 'single' ? ' active' : ''}`}>
              <input
                type="radio"
                name="reg-mode"
                checked={registrationMode === 'single'}
                onChange={() => setRegistrationMode('single')}
              />
              <div>
                <strong>{t('eventSeries.modeSingleSession')}</strong>
                <span className="option-hint">{t('eventSeries.modeSingleSessionHint')}</span>
              </div>
            </label>
          </>
        )}
        {isWholeSeriesRequired && (
          <p className="message">{t('eventSeries.requireAllSessions')}</p>
        )}
      </div>

      {registrationMode === 'series' && (
        <button
          type="button"
          className="primary-cta"
          disabled={submitting}
          onClick={() => void handleSeriesRegister()}
        >
          {submitting ? t('common.loading') : t('eventSeries.confirmRegister')}
        </button>
      )}
    </div>
  )
}