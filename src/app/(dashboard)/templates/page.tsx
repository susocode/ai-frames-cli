'use client'

import { useEffect, useState } from 'react'
import { useLang } from '@/i18n/LangContext'
import FileContentModal from '@/components/FileContentModal'

interface TemplateMeta { file: string; title: string; description: string; version: string; scope: string; resources?: Record<string, string[]> }
type InstallState = 'idle' | 'installing' | 'installed'

export default function TemplatesPage() {
  const { t } = useLang()
  const [available, setAvailable] = useState<TemplateMeta[]>([])
  const [installed, setInstalled] = useState<string[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [original, setOriginal] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [installState, setInstallState] = useState<InstallState>('idle')
  const [search, setSearch] = useState('')
  const [filePreview, setFilePreview] = useState<TemplateMeta | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch('/api/marketplace/templates').then(r => r.json()).then(d => {
      setAvailable(d.available ?? [])
      setInstalled(d.selected ?? [])
      setSelected(d.selected ?? [])
      setOriginal(d.selected ?? [])
    }).finally(() => setLoading(false))
  }, [])

  function toggle(file: string) {
    setSelected(prev => prev.includes(file) ? prev.filter(i => i !== file) : [...prev, file])
  }

  function resourceCount(tmpl: TemplateMeta): number {
    if (!tmpl.resources) return 0
    return Object.values(tmpl.resources).reduce((sum, arr) => sum + (arr?.length ?? 0), 0)
  }

  function resourceSummary(tmpl: TemplateMeta): string {
    if (!tmpl.resources) return ''
    return Object.entries(tmpl.resources).filter(([, items]) => items?.length > 0).map(([type, items]) => `${items.length} ${type}`).join(' · ')
  }

  const hasChanges = [...selected].sort().join() !== [...original].sort().join()
  const filtered = available.filter(item =>
    item.title.toLowerCase().includes(search.toLowerCase()) || item.description.toLowerCase().includes(search.toLowerCase())
  )

  async function install() {
    setInstallState('installing')
    await fetch('/api/marketplace/templates', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ selected }) })
    setInstalled([...selected])
    setOriginal([...selected])
    setInstallState('installed')
    setTimeout(() => setInstallState('idle'), 2500)
  }

  if (loading) return <div className="page"><p className="text-muted">{t.workspace_loading}</p></div>

  return (
    <div className="page">
      <h2>{t.overview_templates_title}</h2>
      <p className="page-subtitle">{t.overview_templates_desc}</p>

      <input className="marketplace-search" placeholder={t.marketplace_search} value={search} onChange={e => setSearch(e.target.value)} autoFocus />

      {filtered.length === 0 ? (
        <div className="marketplace-empty">
          <p>{search ? t.marketplace_no_results : t.marketplace_empty.replace('{type}', 'templates')}</p>
        </div>
      ) : (
        <div className="templates-grid">
          {filtered.map(tmpl => {
            const isSelected = selected.includes(tmpl.file)
            const count = resourceCount(tmpl)
            return (
              <div key={tmpl.file} className={`template-card ${isSelected ? 'selected' : ''}`} onClick={() => toggle(tmpl.file)}>
                <div className={`template-card-check ${isSelected ? 'checked' : ''}`}>{isSelected && '✓'}</div>
                <div className="template-card-body">
                  <div className="template-card-header">
                    {tmpl.version && <span className="marketplace-card-version">v{tmpl.version}</span>}
                    <span style={{ flex: 1 }} />
                    <button className="template-preview-btn-corner" onClick={e => { e.stopPropagation(); setFilePreview(tmpl) }} title="View file">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                      </svg>
                    </button>
                  </div>
                  <span className="template-card-title">{tmpl.title}</span>
                  {tmpl.description && <span className="template-card-desc">{tmpl.description}</span>}
                  {count > 0 && <span className="template-card-count" style={{ marginTop: 6 }}>{resourceSummary(tmpl)}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {filePreview && <FileContentModal type="templates" file={filePreview.file} title={filePreview.title} version={filePreview.version} onClose={() => setFilePreview(null)} />}

      <div className={`marketplace-footer ${hasChanges ? 'visible' : ''}`}>
        <span className="marketplace-footer-count">{selected.length} selected</span>
        <button className={`btn-primary ${installState === 'installed' ? 'btn-saved' : ''}`} disabled={installState === 'installing' || !hasChanges} onClick={install}>
          {installState === 'installing' ? t.marketplace_saving : installState === 'installed' ? t.marketplace_saved : t.marketplace_save_sync}
        </button>
      </div>
    </div>
  )
}
