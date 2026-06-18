import { useEffect, useState } from 'react'
import { useLang } from '../i18n/LangContext'
import FileContentModal from '../components/FileContentModal'

interface ItemMeta {
  file: string
  title: string
  description: string
  version: string
  scope: string
}

interface Props {
  type: string
  title: string
  subtitle: string
}

type InstallState = 'idle' | 'saving' | 'saved'

export default function MarketplacePage({ type, title, subtitle }: Props) {
  const { t } = useLang()
  const [available, setAvailable] = useState<ItemMeta[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [original, setOriginal] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [installState, setInstallState] = useState<InstallState>('idle')
  const [search, setSearch] = useState('')
  const [filePreview, setFilePreview] = useState<ItemMeta | null>(null)

  useEffect(() => {
    setLoading(true)
    setSearch('')
    fetch(`/api/marketplace/${type}`)
      .then(r => r.json())
      .then(d => {
        setAvailable(d.available ?? [])
        setSelected(d.selected ?? [])
        setOriginal(d.selected ?? [])
      })
      .finally(() => setLoading(false))
  }, [type])

  function toggle(file: string) {
    setSelected(prev =>
      prev.includes(file) ? prev.filter(i => i !== file) : [...prev, file]
    )
  }

  const hasChanges = [...selected].sort().join() !== [...original].sort().join()

  const filtered = available.filter(item =>
    item.title.toLowerCase().includes(search.toLowerCase()) ||
    item.description.toLowerCase().includes(search.toLowerCase())
  )

  async function save() {
    setInstallState('saving')
    await fetch(`/api/marketplace/${type}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selected }),
    })
    setOriginal([...selected])
    setInstallState('saved')
    setTimeout(() => setInstallState('idle'), 2000)
  }

  if (loading) return <div className="page"><p className="text-muted">{t.workspace_loading}</p></div>

  return (
    <div className="page">
      <h2>{title}</h2>
      <p className="page-subtitle">{subtitle}</p>

      <input
        className="marketplace-search"
        placeholder={t.marketplace_search}
        value={search}
        onChange={e => setSearch(e.target.value)}
        autoFocus
      />

      {filtered.length === 0 ? (
        <div className="marketplace-empty">
          <p>{search
            ? t.marketplace_no_results
            : t.marketplace_empty.replace('{type}', type)
          }</p>
        </div>
      ) : (
        <div className="marketplace-grid">
          {filtered.map(item => {
            const isSelected = selected.includes(item.file)
            return (
              <div
                key={item.file}
                className={`template-card ${isSelected ? 'selected' : ''}`}
                onClick={() => toggle(item.file)}
              >
                <div className={`template-card-check ${isSelected ? 'checked' : ''}`}>
                  {isSelected && '✓'}
                </div>
                <div className="template-card-body">
                  <div className="template-card-header">
                    {item.version && <span className="marketplace-card-version">v{item.version}</span>}
                    <span className={`marketplace-card-scope ${item.scope === 'shared' ? 'scope-shared' : 'scope-agent'}`}>
                      {item.scope === 'shared' ? 'shared' : item.scope}
                    </span>
                    <span style={{ flex: 1 }} />
                    <button
                      className="template-preview-btn-corner"
                      onClick={e => { e.stopPropagation(); setFilePreview(item) }}
                      title="View content"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                      </svg>
                    </button>
                  </div>
                  <span className="template-card-title">{item.title}</span>
                  {item.description && (
                    <span className="template-card-desc">{item.description}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Sticky footer */}
      {filePreview && (
        <FileContentModal
          type={type}
          file={filePreview.file}
          title={filePreview.title}
          version={filePreview.version}
          onClose={() => setFilePreview(null)}
        />
      )}

      <div className="marketplace-footer visible">
        <span className="marketplace-footer-count">
          {selected.length} selected
        </span>
        <button
          className={`btn-primary ${installState === 'saved' ? 'btn-saved' : ''}`}
          disabled={installState === 'saving' || !hasChanges}
          onClick={save}
        >
          {installState === 'saving' ? t.marketplace_saving
            : installState === 'saved' ? t.marketplace_saved
            : t.marketplace_save_sync}
        </button>
      </div>
    </div>
  )
}
