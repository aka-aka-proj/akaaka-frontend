import { Icon } from './Icon'
import { EVENT_TYPES, PRACTICE_TAGS, SOCIAL_TAGS, getEventTypeI18nKey } from '../lib/event-types'
import type { AttendanceFeeType } from '../types'

interface FeeFieldProps {
  t: (key: string) => string
  value: AttendanceFeeType
  onChange: (value: AttendanceFeeType) => void
  amount: string
  onAmountChange: (value: string) => void
}

export function FeeField({ t, value, onChange, amount, onAmountChange }: FeeFieldProps) {
  const options = [
    ['free', t('createEvent.attendanceFeeFree')],
    ['fixed', t('createEvent.attendanceFeeFixed')],
    ['see_description', t('createEvent.attendanceFeeDescription')],
  ] as const

  return (
    <label className="form-field">
      <span className="form-label-row"><Icon href="/form-icons.svg" name="form-edit" size={16} /> {t('createEvent.attendanceFeeLabel')}</span>
      <div className="segmented-control" aria-label={t('createEvent.attendanceFeeLabel')}>
        {options.map(([option, label]) => (
          <label key={option} className={value === option ? 'is-selected' : ''}>
            <input
              type="radio"
              name="attendance-fee"
              value={option}
              checked={value === option}
              onChange={() => {
                onChange(option)
                if (option !== 'fixed') onAmountChange('')
              }}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
      {value === 'fixed' ? <input aria-label={t('createEvent.attendanceFeeAmountLabel')} type="number" min="1" step="1" placeholder={t('createEvent.attendanceFeeAmountPlaceholder')} value={amount} onChange={(event) => onAmountChange(event.target.value)} /> : null}
      <small>{t('createEvent.attendanceFeeHint')}</small>
    </label>
  )
}

interface EventTypeFieldProps {
  t: (key: string) => string
  values: string[]
  onChange: (values: string[]) => void
}

export function EventTypeField({ t, values, onChange }: EventTypeFieldProps) {
  const addType = (type: string) => {
    if (type && !values.includes(type) && EVENT_TYPES.includes(type as typeof EVENT_TYPES[number])) onChange([...values, type])
  }

  return (
    <label className="form-field">
      <span className="form-label-row"><Icon href="/form-icons.svg" name="form-calendar" size={16} /> {t('createEvent.eventTypeLabel')}</span>
      <select aria-label={t('createEvent.eventTypeLabel')} onChange={(event) => addType(event.target.value)} defaultValue="">
        <option value="" disabled>{t('createEvent.selectEventType')}</option>
        <optgroup label={t('createEvent.categorySocial')}>
          {SOCIAL_TAGS.map((type) => <option key={type} value={type}>{t(getEventTypeI18nKey(type))}</option>)}
        </optgroup>
        <optgroup label={t('createEvent.categoryPractice')}>
          {PRACTICE_TAGS.map((type) => <option key={type} value={type}>{t(getEventTypeI18nKey(type))}</option>)}
        </optgroup>
      </select>
      <div className="tags-input-container">
        {values.map((type) => (
          <span className="tag" key={type}>
            {t(getEventTypeI18nKey(type))}
            <button type="button" onClick={() => onChange(values.filter((item) => item !== type))} aria-label={t('createEvent.removeType')}>×</button>
          </span>
        ))}
      </div>
    </label>
  )
}
