import { useState } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
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
  const [registrationMode, setRegistrationMode] = useState<'single' | 'series'>('single')
  const [pendingEventIds, setPendingEventIds] = useState<string[] | null>(null)

  const effectiveMode = isWholeSeriesRequired ? 'series' : registrationMode

  const handleSeriesRegister = async (acknowledge = false, expectedEventIds?: string[]) => {
    setSubmitting(true)

    const { data: memberships, error: membershipError } = await supabase
      .from('event_series_membership')
      .select('event_id')
      .eq('series_id', seriesId)
    if (membershipError) {
      setSubmitting(false)
      showError(membershipError.message)
      return
    }

    const eventIds = expectedEventIds ?? (memberships ?? []).map((membership) => membership.event_id)
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

    const { error } = await supabase.functions.invoke('register-for-event-series', {
      body: {
        series_id: seriesId,
        ...(acknowledge ? { acknowledge_blocklist_conflict: true, expected_event_ids: eventIds } : {}),
      },
    })
    setSubmitting(false)
    if (error) {
      const response = error instanceof FunctionsHttpError ? error.context : undefined
      if (response?.status === 409) {
        const payload = await response.clone().json().catch(() => null) as { error?: { code?: string; details?: { expected_event_ids?: string[] } } } | null
        if (payload?.error?.code === 'blocklist_confirmation_required') {
          const snapshot = payload.error.details?.expected_event_ids
          if (Array.isArray(snapshot) && snapshot.every((id) => typeof id === 'string')) {
            setPendingEventIds(snapshot)
            return
          }
        }
      }
      showError(error.message)
      return
    }
    setPendingEventIds(null)
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

      {effectiveMode === 'series' && (
        <button
          type="button"
          className="primary-cta"
          disabled={submitting}
          onClick={() => void handleSeriesRegister()}
        >
          {submitting ? t('common.loading') : t('eventSeries.confirmRegister')}
        </button>
      )}
      {pendingEventIds ? (
        <div className="modal-overlay" role="presentation">
          <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby="series-blocklist-confirm-title">
            <h2 id="series-blocklist-confirm-title">同場安全提醒 / Safety confirmation</h2>
            <p>你封鎖的使用者可能也會參加此系列中的活動。確認後會使用原始活動清單重新驗證；清單若已變更，伺服器會拒絕。 / Someone you blocked may attend this series. Confirmation retries against the original event snapshot.</p>
            <div className="modal-actions">
              <button type="button" onClick={() => setPendingEventIds(null)} disabled={submitting}>取消 / Cancel</button>
              <button type="button" className="primary-cta" onClick={() => void handleSeriesRegister(true, pendingEventIds)} disabled={submitting}>
                {submitting ? '處理中… / Working…' : '同意並繼續 / Continue'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
