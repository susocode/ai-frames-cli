import { useEffect, useState, useRef } from 'react'
import { marked } from 'marked'
import { useLang } from '../i18n/LangContext'

interface Props {
  type: string
  file: string
  title: string
  version?: string
  onClose: () => void
}

export default function FileContentModal({ type, file, title, version, onClose }: Props) {
  const { t } = useLang()
  const [content, setContent] = useState('')
  const [isYaml, setIsYaml] = useState(false)
  const [loading, setLoading] = useState(true)
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/marketplace/${type}/file?path=${encodeURIComponent(file)}`)
      .then(r => r.json())
      .then(d => { setContent(d.content ?? ''); setIsYaml(d.isYaml ?? false) })
      .finally(() => setLoading(false))
  }, [type, file])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" ref={backdropRef} onClick={e => { if (e.target === backdropRef.current) onClose() }}>
      <div className="modal file-content-modal">
        <div className="modal-body">
          <div className="file-content-wrapped">
            {loading
              ? <p className="text-muted" style={{ padding: 16 }}>{t.workspace_loading}</p>
              : isYaml
              ? <pre className="file-content-yaml">{content}</pre>
              : <div
                  className="file-content-md"
                  dangerouslySetInnerHTML={{ __html: marked(content) as string }}
                />
            }
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>{t.close}</button>
        </div>
      </div>
    </div>
  )
}
