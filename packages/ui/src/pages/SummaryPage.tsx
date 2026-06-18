import { useEffect, useState } from 'react'
import { useLang } from '../i18n/LangContext'

interface Context {
  id: string
  name: string
  provider: string
  resources_repo: string
  workspace: string
}

interface Manifest {
  assistants?: string[]
  repos?: { name: string; source: string }[]
}

type SyncState = 'idle' | 'syncing' | 'done' | 'error'

export default function SummaryPage() {
  const { t } = useLang()
  const [context, setContext] = useState<Context | null>(null)
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [syncState, setSyncState] = useState<SyncState>('idle')

  useEffect(() => {
    fetch('/api/contexts')
      .then(r => r.json())
      .then(d => setContext(d.active ?? null))
    fetch('/api/resources')
      .then(r => r.json())
      .then(d => setManifest(d.manifest ?? null))
  }, [])

  async function sync() {
    setSyncState('syncing')
    const res = await fetch('/api/install', { method: 'POST' })
    setSyncState(res.ok ? 'done' : 'error')
    if (res.ok) setTimeout(() => setSyncState('idle'), 2000)
  }

  return (
    <div className="page">
      <h2>{t.summary_title}</h2>
      <p className="page-subtitle">{t.summary_subtitle}</p>

      <div className="summary-grid">
        {context && (
          <>
            <div className="summary-row">
              <span className="summary-label">{t.summary_context}</span>
              <span className="summary-value">{context.name}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">{t.summary_provider}</span>
              <span className="summary-value">{context.provider}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">{t.summary_resources}</span>
              <span className="summary-value">{context.resources_repo}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">{t.summary_workspace}</span>
              <span className="summary-value summary-mono">{context.workspace}</span>
            </div>
          </>
        )}

        {manifest && (
          <>
            <div className="summary-row">
              <span className="summary-label">{t.summary_assistants}</span>
              <span className="summary-value">
                {manifest.assistants?.join(', ') ?? '—'}
              </span>
            </div>
            <div className="summary-row summary-row-top">
              <span className="summary-label">{t.summary_repositories}</span>
              <span className="summary-value">
                {manifest.repos && manifest.repos.length > 0
                  ? <ul className="summary-repo-list">
                      {manifest.repos.map(r => (
                        <li key={r.name}>
                          <strong>{r.name}</strong>
                          <span className="summary-mono"> {r.source}</span>
                        </li>
                      ))}
                    </ul>
                  : <span className="summary-empty">{t.summary_no_repos}</span>
                }
              </span>
            </div>
          </>
        )}
      </div>

      <button
        className={`btn-primary summary-sync-btn ${syncState === 'done' ? 'btn-saved' : ''}`}
        disabled={syncState === 'syncing'}
        onClick={sync}
      >
        {syncState === 'syncing' ? t.summary_syncing : t.summary_sync_button}
      </button>
    </div>
  )
}
