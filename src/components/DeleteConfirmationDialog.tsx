import { useEffect, useRef } from 'react'

interface DeleteConfirmationDialogProps {
  isOpen: boolean
  title: string
  description: string
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteConfirmationDialog({
  isOpen,
  title,
  description,
  onConfirm,
  onCancel,
}: DeleteConfirmationDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return

    if (isOpen && !el.open) {
      if (typeof el.showModal === 'function') {
        el.showModal()
        // Set focus to cancel button for safety
        // Use setTimeout to ensure it runs after the dialog is fully rendered and shown
        setTimeout(() => {
          cancelBtnRef.current?.focus()
        }, 0)
      }
    } else if (!isOpen && el.open) {
      el.close()
    }
  }, [isOpen])

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return

    const handleCancel = (e: Event) => {
      e.preventDefault()
      onCancel()
    }

    el.addEventListener('cancel', handleCancel)
    return () => el.removeEventListener('cancel', handleCancel)
  }, [onCancel])

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      role="alertdialog"
      aria-labelledby="delete-dialog-title"
      aria-describedby="delete-dialog-description"
    >
      <div className="modal-content">
        <h2 id="delete-dialog-title">{title}</h2>
        <div className="modal-body">
          <p id="delete-dialog-description">{description}</p>
        </div>
        <div className="modal-actions">
          <button
            type="button"
            ref={cancelBtnRef}
            onClick={onCancel}
          >
            取消
          </button>
          <button
            type="button"
            className="danger"
            onClick={onConfirm}
          >
            刪除
          </button>
        </div>
      </div>
    </dialog>
  )
}
