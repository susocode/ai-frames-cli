import { useEffect, useState } from 'react'
import { useLang } from '../i18n/LangContext'

const AVAILABLE = [
  { id: 'claude', label: 'Claude Code' },
  { id: 'copilot', label: 'GitHub Copilot' },
  { id: 'copilot-cli', label: 'GitHub Copilot CLI' },
  { id: 'cursor', label: 'Cursor' },
]

type RepoStatus = 'checking' | 'empty' | 'ok' | 'unknown'
type InitState = 'idle' | 'initializing' | 'done'

export default function AssistantsPage() {
  const { t } = useLang()
  const [selected, setSelected] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [repoStatus, setRepoStatus] = useState<RepoStatus>('checking')
  const [initState, setInitState] = useState<InitState>('idle')

  useEffect(() => {
    // Load manifest
    fetch('/api/resources')
      .then(r => r.json())
      .then(data => {
        if (data.manifest?.assistants) setSelected(data.manifest.assistants)
      })

    // Check repo status
    fetch('/api/repo-status')
      .then(r => r.json())
      .then(data => setRepoStatus(data.empty ? 'empty' : 'ok'))
      .catch(() => setRepoStatus('unknown'))
  }, [])

  function toggle(id: string) {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    )
  }

  async function save() {
    setSaving(true)
    const res = await fetch('/api/resources')
    const data = await res.json()
    const manifest = data.manifest ?? {}
    await fetch('/api/resources', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...manifest, assistants: selected }),
    })
    setSaving(false)
  }

  async function initRepo() {
    setInitState('initializing')
    // TODO: implement repo init endpoint — for now just mark as done
    // Will be wired up once we define the base structure
    await new Promise(r => setTimeout(r, 500))
    setInitState('done')
    setRepoStatus('ok')
  }

  return (
    <div className="page">
      <h2>{t.assistants_title}</h2>
      <p className="page-subtitle">{t.assistants_subtitle}</p>

      {/* Repo status banner */}
      {repoStatus === 'checking' && (
        <p className="text-muted" style={{ marginBottom: 20 }}>⏳ {t.assistants_repo_checking}</p>
      )}
      {repoStatus === 'empty' && (
        <div className="repo-empty-banner">
          <p>{t.assistants_repo_empty}</p>
          <button
            className={`btn-primary ${initState === 'done' ? 'btn-saved' : ''}`}
            disabled={initState === 'initializing'}
            onClick={initRepo}
          >
            {initState === 'initializing'
              ? t.assistants_repo_initializing
              : initState === 'done'
              ? t.assistants_repo_init_done
              : t.assistants_repo_init_button}
          </button>
        </div>
      )}

      <div className="assistant-grid">
        {AVAILABLE.map(a => (
          <button
            key={a.id}
            className={`assistant-card ${selected.includes(a.id) ? 'selected' : ''}`}
            onClick={() => toggle(a.id)}
          >
            {a.label}
          </button>
        ))}
      </div>
      <button className="btn-primary" style={{ marginTop: 24 }} onClick={save} disabled={saving}>
        {saving ? t.assistants_saving : t.assistants_save}
      </button>
    </div>
  )
}
