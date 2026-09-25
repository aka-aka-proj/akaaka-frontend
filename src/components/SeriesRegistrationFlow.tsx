import { useBlocklistConfirmation } from '../hooks/useBlocklistConfirmation'
import { BlocklistConflictDialog } from './BlocklistConflictDialog'
import { useAuth } from '../context/AuthContext'
import { useState } from 'react'
import { useT } from '../hooks/useT'
import { supabase } from '../supabaseClient'

interface SeriesRegistrationFlowProps {
  seriesId: string
  isWholeSeriesRequired: boolean
  submitting: boolean
  setSubmitting: (v: boolean) => void
  onRegistrationChanged: () => void
  showError: (msg: string) => void
}

export function SeriesRegistrationFlow({
  seriesId,
  isWholeSeriesRequired,
  submitting,
  setSubmitting,
  onRegistrationChanged,
  showError,
}: SeriesRegistrationFlowProps) {
  const { t } = useT()
  const { user } = useAuth()
  const { run, confirmation, busy, confirm, cancel } = useBlocklistConfirmation(`${user?.id ?? ''}:${seriesId}`)
  const [registrationMode, setRegistrationMode] = useState<'single' | 'series'>('single')

  const effectiveMode = isWholeSeriesRequired ? 'series' : registrationMode

  const handleSeriesRegister = async () => {
    setSubmitting(true)

    const { data: memberships, error: membershipError } = await supabase
      .from('event_series_membership')
      .select('event_id')
      .eq('series_id', seriesId)
      .order('position', { ascending: true })
    if (membershipError) {
      setSubmitting(false)
      showError(membershipError.message)
      return
    }

    const eventIds = (memberships ?? []).map((membership) => membership.event_id)
    if (eventIds.length > 0) {
      const { data: memberEvents, error: memberEventsError } = await supabase
        .from('events')
        .select('registration_form_config')
        .in('id', eventIds)
      if (memberEventsError) {
        setSubmitting(false)
        showError(memberEventsError.message)
        return
      }
      const hasRequiredSeriesForm = (memberEvents ?? []).some((event) =>
        Array.isArray(event.registration_form_config)
        && event.registration_form_config.some((field: { required?: boolean }) => field.required === true),
      )
      if (hasRequiredSeriesForm) {
        setSubmitting(false)
        showError('This series contains required registration questions. Whole-series registration is unavailable until all required answers can be collected.')
        return
      }
    }

    await run({ name: 'register-for-event-series', kind: 'series', body: { series_id: seriesId, expected_event_ids: eventIds },
      onSuccess: onRegistrationChanged, onError: error => showError(error.message) })
    setSubmitting(false)
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

      {effectiveMode === 'series' && (
        <button
          type="button"
          className="primary-cta"
          disabled={submitting || busy}
          onClick={() => void handleSeriesRegister()}
        >
          {submitting ? t('common.loading') : t('eventSeries.confirmRegister')}
        </button>
      )}
      <BlocklistConflictDialog open={Boolean(confirmation)} kind="series" hostId={confirmation?.hostId} returnFocus={confirmation?.request.trigger}
        busy={busy} onConfirm={() => void confirm()} onCancel={cancel} />
    </div>
  )
}
