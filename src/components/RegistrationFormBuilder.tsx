import { useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useT } from '../hooks/useT'
import type { RegistrationFormField } from '../types'

const MAX_FORM_FIELDS = 10
const OPTION_FIELD_TYPES: RegistrationFormField['type'][] = ['select', 'radio', 'checkbox']
const FORM_FIELD_TYPES: RegistrationFormField['type'][] = ['text', 'textarea', 'radio', 'checkbox', 'select']

function newFormField(type: RegistrationFormField['type']): RegistrationFormField {
  return { id: crypto.randomUUID(), type, label: '', required: false, options: OPTION_FIELD_TYPES.includes(type) ? [''] : undefined }
}

interface RegistrationFormBuilderProps {
  fields: RegistrationFormField[]
  setFields: Dispatch<SetStateAction<RegistrationFormField[]>>
}

export function RegistrationFormBuilder({ fields, setFields }: RegistrationFormBuilderProps) {
  const { t } = useT()
  const [expandedFieldId, setExpandedFieldId] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [deletedField, setDeletedField] = useState<{ field: RegistrationFormField; index: number } | null>(null)
  const [draggedFieldId, setDraggedFieldId] = useState<string | null>(null)
  const undoTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updateField = (id: string, updates: Partial<RegistrationFormField>) => {
    setFields((current) => current.map((field) => field.id === id ? { ...field, ...updates } : field))
  }

  const addField = (type: RegistrationFormField['type']) => {
    if (fields.length >= MAX_FORM_FIELDS) return
    const field = newFormField(type)
    setFields((current) => [...current, field])
    setExpandedFieldId(field.id)
  }

  const removeField = (id: string) => {
    const index = fields.findIndex((field) => field.id === id)
    const field = fields[index]
    if (!field) return
    setFields((current) => current.filter((item) => item.id !== id))
    setExpandedFieldId(null)
    setDeletedField({ field, index })
    if (undoTimeout.current) clearTimeout(undoTimeout.current)
    undoTimeout.current = setTimeout(() => setDeletedField(null), 6000)
  }

  const undoRemoveField = () => {
    if (!deletedField) return
    setFields((current) => {
      const next = [...current]
      next.splice(Math.min(deletedField.index, next.length), 0, deletedField.field)
      return next
    })
    setExpandedFieldId(deletedField.field.id)
    setDeletedField(null)
    if (undoTimeout.current) clearTimeout(undoTimeout.current)
  }

  const moveField = (id: string, direction: -1 | 1) => {
    setFields((current) => {
      const index = current.findIndex((field) => field.id === id)
      const target = index + direction
      if (index < 0 || target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const dropField = (targetId: string) => {
    if (!draggedFieldId || draggedFieldId === targetId) return
    setFields((current) => {
      const sourceIndex = current.findIndex((field) => field.id === draggedFieldId)
      const targetIndex = current.findIndex((field) => field.id === targetId)
      if (sourceIndex < 0 || targetIndex < 0) return current
      const next = [...current]
      const [moved] = next.splice(sourceIndex, 1)
      next.splice(targetIndex, 0, moved)
      return next
    })
    setDraggedFieldId(null)
  }

  const fieldTypeLabel = (type: RegistrationFormField['type']) => t(`createEvent.formBuilder${type.charAt(0).toUpperCase() + type.slice(1)}`)

  return (
    <fieldset className="card form-builder">
      <div className="form-builder-heading">
        <div>
          <legend>{t('createEvent.formBuilderLabel')} ({fields.length}/{MAX_FORM_FIELDS})</legend>
          <p>{t('createEvent.formBuilderHint')}</p>
        </div>
        <button type="button" className="secondary-button" onClick={() => setShowPreview((visible) => !visible)}>
          {showPreview ? t('createEvent.formBuilderEdit') : `◉ ${t('createEvent.formBuilderPreview')}`}
        </button>
      </div>
      {!showPreview && fields.map((field, index) => {
        const expanded = expandedFieldId === field.id
        return (
          <div key={field.id} className={`form-builder-field${draggedFieldId === field.id ? ' is-dragging' : ''}`} draggable onDragStart={() => setDraggedFieldId(field.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => dropField(field.id)} onDragEnd={() => setDraggedFieldId(null)}>
            <div className="form-builder-field-header">
              <button type="button" className="drag-handle" aria-label={t('createEvent.formBuilderDrag')} title={t('createEvent.formBuilderDrag')}>⋮⋮</button>
              <button type="button" className="form-builder-expand" onClick={() => setExpandedFieldId(expanded ? null : field.id)} aria-expanded={expanded}>
                <strong>{field.label || t('createEvent.formBuilderUntitled')}</strong>
                <span>{fieldTypeLabel(field.type)}{field.required ? ` · ${t('createEvent.formBuilderFieldRequired')}` : ''}</span>
              </button>
              <div className="form-builder-actions">
                <button type="button" onClick={() => moveField(field.id, -1)} disabled={index === 0} aria-label={t('createEvent.formBuilderMoveUp')}>↑</button>
                <button type="button" onClick={() => moveField(field.id, 1)} disabled={index === fields.length - 1} aria-label={t('createEvent.formBuilderMoveDown')}>↓</button>
                <button type="button" className="danger-icon-button" onClick={() => removeField(field.id)} aria-label={t('createEvent.formBuilderDelete')} title={t('createEvent.formBuilderDelete')}>🗑</button>
              </div>
            </div>
            {expanded && <div className="form-builder-field-editor">
              <label><span>{t('createEvent.formBuilderFieldLabel')}</span><input autoFocus={!field.label} aria-label={t('createEvent.formBuilderFieldLabel')} placeholder={t('createEvent.formBuilderFieldLabelPlaceholder')} value={field.label} onChange={(event) => updateField(field.id, { label: event.target.value })} /></label>
              <label><span>{t('createEvent.formBuilderFieldType')}</span><select aria-label={t('createEvent.formBuilderFieldType')} value={field.type} onChange={(event) => { const type = event.target.value as RegistrationFormField['type']; updateField(field.id, { type, options: OPTION_FIELD_TYPES.includes(type) ? (field.options?.length ? field.options : ['']) : undefined }) }}>{FORM_FIELD_TYPES.map((type) => <option key={type} value={type}>{fieldTypeLabel(type)}</option>)}</select></label>
              <label className="form-builder-toggle"><input type="checkbox" checked={field.required} onChange={(event) => updateField(field.id, { required: event.target.checked })} /><span>{t('createEvent.formBuilderFieldRequired')}</span></label>
              {field.options && <div className="form-builder-options"><span className="form-label">{t('createEvent.formBuilderFieldOptions')}</span>{field.options.map((option, optionIndex) => <div className="form-builder-option" key={`${field.id}-${optionIndex}`}><input aria-label={`${t('createEvent.formBuilderOption')} ${optionIndex + 1}`} value={option} placeholder={`${t('createEvent.formBuilderOption')} ${optionIndex + 1}`} onChange={(event) => updateField(field.id, { options: field.options?.map((item, itemIndex) => itemIndex === optionIndex ? event.target.value : item) })} /><button type="button" onClick={() => updateField(field.id, { options: field.options?.filter((_, itemIndex) => itemIndex !== optionIndex) })} disabled={(field.options?.length ?? 0) <= 1} aria-label={t('createEvent.formBuilderDeleteOption')}>×</button></div>)}<button type="button" className="text-button" onClick={() => updateField(field.id, { options: [...(field.options ?? []), ''] })}>+ {t('createEvent.formBuilderAddOption')}</button></div>}
            </div>}
          </div>
        )
      })}
      {showPreview && <div className="form-builder-preview" aria-label={t('createEvent.formBuilderPreview')}>{fields.length === 0 ? <p>{t('createEvent.formBuilderEmpty')}</p> : fields.map((field) => <label key={field.id}><span>{field.label || t('createEvent.formBuilderUntitled')}{field.required ? ' *' : ''}</span>{field.type === 'textarea' ? <textarea disabled /> : field.type === 'select' ? <select disabled><option>{t('createEvent.formBuilderSelectPlaceholder')}</option></select> : field.type === 'radio' || field.type === 'checkbox' ? <span className="form-builder-preview-options">{field.options?.map((option, index) => <label key={index}><input type={field.type === 'radio' ? 'radio' : 'checkbox'} disabled /> {option || `${t('createEvent.formBuilderOption')} ${index + 1}`}</label>)}</span> : <input disabled />}</label>)}</div>}
      {!showPreview && <div className="form-builder-add-row"><select aria-label={t('createEvent.formBuilderAddField')} defaultValue="" onChange={(event) => { if (event.target.value) { addField(event.target.value as RegistrationFormField['type']); event.target.value = '' } }} disabled={fields.length >= MAX_FORM_FIELDS}><option value="">+ {t('createEvent.formBuilderAddField')}</option>{FORM_FIELD_TYPES.map((type) => <option key={type} value={type}>{t(`createEvent.formBuilderAdd${type.charAt(0).toUpperCase() + type.slice(1)}`)}</option>)}</select>{fields.length >= MAX_FORM_FIELDS ? <span className="form-builder-limit">{t('createEvent.formBuilderLimit')}</span> : null}</div>}
      {deletedField ? <div className="form-builder-toast" role="status">{t('createEvent.formBuilderDeleted')} <button type="button" onClick={undoRemoveField}>{t('createEvent.formBuilderUndo')}</button></div> : null}
    </fieldset>
  )
}
