import { useEffect, type ReactNode } from 'react'
import { Icon } from './Icon'

interface Props {
  title?: string
  onClose: () => void
  children: ReactNode
  /** 'sheet' slides up from the bottom; 'center' is a small dialog. */
  variant?: 'sheet' | 'center'
}

/** Bottom sheet / dialog with backdrop; closes on backdrop tap or Escape. */
export function Modal({ title, onClose, children, variant = 'sheet' }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={`modal modal-${variant}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        {variant === 'sheet' ? <div className="modal-grip" /> : null}
        {title ? (
          <div className="modal-head">
            <h2>{title}</h2>
            <button className="icon-btn ghost" onClick={onClose} type="button" aria-label="Cerrar">
              <Icon name="x" />
            </button>
          </div>
        ) : null}
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
