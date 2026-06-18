import { useEffect, useRef } from 'react'
import { useLang } from '../i18n/LangContext'

interface Props {
  title: string
  version?: string
  resources: Record<string, string[]>
  onClose: () => void
}

export default function TemplatePreviewModal({ title, version, resources, onClose }: Props) {
  const { t } = useLang()
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const total = Object.values(resources).reduce((s, arr) => s + (arr?.length ?? 0), 0)

  return (
    <div className="modal-backdrop" ref={backdropRef} onClick={e => { if (e.target === backdropRef.current) onClose() }}>
      <div className="modal">
        <div className="modal-body" style={{ background: 'var(--surface)' }}>
          {Object.entries(resources).filter(([, items]) => items?.length > 0).map(([type, items]) => (
            <div key={type} className="template-modal-section">
              <span className="template-preview-type-label">{type}</span>
              <ul className="template-modal-list">
                {items.map(item => (
                  <li key={item}>- {item.replace(/\.(md|yaml|json|mdc)$/, '')}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>{t.close}</button>
        </div>
      </div>
    </div>
  )
}
