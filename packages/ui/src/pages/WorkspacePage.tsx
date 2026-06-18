import { useEffect, useState, useCallback } from 'react'
import { useLang } from '../i18n/LangContext'
import AssistantCard from '../components/AssistantCard'

interface DirEntry { path: string; exists: boolean; synced: boolean | null }
interface AssistantDirs { aicontext: DirEntry[]; native: DirEntry[]; in_repo: boolean }
interface CustomDirEntry extends DirEntry { repo_path: string; local_path: string }
interface WorkspaceData {
  workspace: string
  base: DirEntry[]
  assistants: Record<string, AssistantDirs>
  custom: CustomDirEntry[]
}
interface DirMapping { repo_path: string; local_path: string }

type RepoStatus = 'checking' | 'empty' | 'ok' | 'unknown'
type RecreateState = 'idle' | 'recreating' | 'done' | 'error'
type InitState = 'idle' | 'initializing' | 'done'
type SaveState = 'idle' | 'saving' | 'saved'

const ASSISTANT_GROUPS: { id: string; label: string }[] = [
  { id: 'claude',   label: 'Claude Code' },
  { id: 'copilot',  label: 'GitHub Copilot' },
  { id: 'cursor',   label: 'Cursor' },
  { id: 'windsurf', label: 'Windsurf' },
]

export default function WorkspacePage() {
  const { t } = useLang()

  const [repoStatus, setRepoStatus] = useState<RepoStatus>('checking')
  const [initState, setInitState] = useState<InitState>('idle')
  const [data, setData] = useState<WorkspaceData | null>(null)
  const [loadingDirs, setLoadingDirs] = useState(true)
  const [recreateState, setRecreateState] = useState<RecreateState>('idle')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [originalSelected, setOriginalSelected] = useState<Set<string>>(new Set())
  const [mappings, setMappings] = useState<DirMapping[]>([])
  const [mappingSaving, setMappingSaving] = useState(false)
  const [newRepo, setNewRepo] = useState('')
  const [newLocal, setNewLocal] = useState('')

  const loadDirs = useCallback(async () => {
    setLoadingDirs(true)
    const res = await fetch('/api/workspace-dirs')
    const d: WorkspaceData = await res.json()
    setData(d)
    const enabled = new Set<string>()
    for (const group of ASSISTANT_GROUPS) {
      const a = d.assistants[group.id]
      if (a?.aicontext.length > 0 && a.aicontext[0].exists) enabled.add(group.id)
    }
    setSelected(new Set(enabled))
    setOriginalSelected(new Set(enabled))
    setLoadingDirs(false)
  }, [])

  async function persistMappings(updated: DirMapping[]) {
    await fetch('/api/custom-dirs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
    // Refresh only the custom dir status in background (no full reload)
    const res = await fetch('/api/workspace-dirs')
    const d: WorkspaceData = await res.json()
    setData(prev => prev ? { ...prev, custom: d.custom } : d)
  }

  async function addMapping() {
    if (!newRepo.trim()) return
    setMappingSaving(true)
    const newEntry: DirMapping = { repo_path: newRepo.trim(), local_path: newLocal.trim() }
    const updated = [...mappings, newEntry]
    setMappings(updated)
    setNewRepo('')
    setNewLocal('')
    await persistMappings(updated)
    setMappingSaving(false)
  }

  async function removeMapping(i: number) {
    const updated = mappings.filter((_, j) => j !== i)
    setMappings(updated)
    await persistMappings(updated)
  }

  useEffect(() => {
    fetch('/api/custom-dirs').then(r => r.json()).then(d => setMappings(d.mappings ?? []))
  }, [])

  useEffect(() => {
    fetch('/api/repo-status')
      .then(r => r.json())
      .then(d => setRepoStatus(d.empty ? 'empty' : 'ok'))
      .catch(() => setRepoStatus('unknown'))
    loadDirs()
  }, [loadDirs])

  useEffect(() => {
    function onSync() {
      fetch('/api/repo-status')
        .then(r => r.json())
        .then(d => setRepoStatus(d.empty ? 'empty' : 'ok'))
        .catch(() => {})
      loadDirs()
    }
    window.addEventListener('aiframes:synced', onSync)
    return () => window.removeEventListener('aiframes:synced', onSync)
  }, [loadDirs])

  const baseAllOk = data?.base.every(d => d.exists) ?? false

  const normalizedNewRepo = newRepo.trim()
  const normalizedNewLocal = newLocal.trim() || (
    normalizedNewRepo.startsWith('.aicontext/')
      ? normalizedNewRepo
      : `.aicontext/${normalizedNewRepo}`
  )
  const isDuplicate = !!normalizedNewRepo && mappings.some(
    m => m.repo_path === normalizedNewRepo || m.local_path === normalizedNewLocal
  )
  const hasMissing = data?.base.some(d => !d.exists) ?? false
  const hasChanges = [...selected].sort().join() !== [...originalSelected].sort().join()

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function initRepo() {
    setInitState('initializing')
    await fetch("/api/repo-init", { method: "POST" })
    setInitState('done')
    setRepoStatus('ok')
    await loadDirs()
    setTimeout(() => setInitState('idle'), 2000)
  }

  async function saveChanges() {
    setSaveState('saving')
    for (const group of ASSISTANT_GROUPS) {
      const wasEnabled = originalSelected.has(group.id)
      const nowEnabled = selected.has(group.id)
      if (wasEnabled !== nowEnabled) {
        await fetch('/api/workspace-dirs/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assistant: group.id, enable: nowEnabled }),
        })
      }
    }
    await loadDirs()
    setSaveState('saved')
    setTimeout(() => setSaveState('idle'), 2000)
  }

  async function recreateDirs() {
    setRecreateState('recreating')
    const res = await fetch("/api/repo-init", { method: "POST" })
    if (res.ok) {
      setRecreateState('done')
      await loadDirs()
      setTimeout(() => setRecreateState('idle'), 2000)
    } else {
      setRecreateState('error')
    }
  }

  return (
    <div className="page">
      <h2>{t.workspace_page_title}</h2>
      <p className="page-subtitle">{t.workspace_page_subtitle}</p>

      {repoStatus === 'checking' && (
        <p className="text-muted">{t.assistants_repo_checking}</p>
      )}

      {repoStatus === 'empty' && (
        <div className="repo-empty-banner">
          <p>{t.assistants_repo_empty}</p>
          <button
            className={`btn-primary ${initState === 'done' ? 'btn-saved' : ''}`}
            disabled={initState === 'initializing'}
            onClick={initRepo}
          >
            {initState === 'initializing' ? t.assistants_repo_initializing
              : initState === 'done' ? t.assistants_repo_init_done
              : t.assistants_repo_init_button}
          </button>
        </div>
      )}

      {repoStatus !== 'empty' && repoStatus !== 'checking' && data?.workspace && (
        <p className="workspace-path">{data.workspace}</p>
      )}

      {repoStatus !== 'empty' && repoStatus !== 'checking' && (loadingDirs ? (
        <p className="text-muted">{t.workspace_loading}</p>
      ) : (
        <>
          {/* Base .aicontext structure */}
          <div className="workspace-group">
            <div className="workspace-group-header">
              <span className="workspace-group-label">ai-frames (.aicontext/)</span>
              <span className={`workspace-badge ${baseAllOk ? 'ok' : 'missing'}`}>
                {baseAllOk ? t.workspace_status_ok : t.workspace_status_missing}
              </span>
            </div>
            <table className="repo-table workspace-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>{t.workspace_col_path}</th>
                  <th style={{ textAlign: 'right', width: 90 }}>{t.workspace_col_status}</th>
                  <th style={{ textAlign: 'right', width: 110 }}>Sync</th>
                </tr>
              </thead>
              <tbody>
                {data?.base.map(d => (
                  <tr key={d.path}>
                    <td className="source">{d.path}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span className={`workspace-status ${d.exists ? 'ok' : 'missing'}`}>
                        {d.exists ? `✓ ${t.workspace_status_ok}` : `✕ ${t.workspace_status_missing}`}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {d.exists && d.synced !== null && (
                        <span className={`workspace-status ${d.synced ? 'ok' : 'outdated'}`}>
                          {d.synced ? `✓ ${t.workspace_status_synced}` : `⚠ ${t.workspace_status_outdated}`}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Custom directory mappings */}
          <div className="custom-dirs-section">
            <h4 className="custom-dirs-title">{t.workspace_custom_dirs_title}</h4>
            <p className="custom-dirs-subtitle">{t.workspace_custom_dirs_subtitle}</p>

            {/* Saved mappings table */}
            {(data?.custom ?? []).length > 0 && (
              <table className="repo-table workspace-table" style={{ marginBottom: 12 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>{t.workspace_custom_repo_path}</th>
                    <th style={{ textAlign: 'left' }}>{t.workspace_custom_local_path}</th>
                    <th style={{ textAlign: 'right', width: 90 }}>{t.workspace_col_status}</th>
                    <th style={{ textAlign: 'right', width: 110 }}>Sync</th>
                    <th style={{ width: 70 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.custom ?? []).map((d, i) => (
                    <tr key={d.local_path}>
                      <td className="source">{d.repo_path}</td>
                      <td className="source">{d.local_path}</td>
                      <td style={{ textAlign: 'right' }}>
                        <span className={`workspace-status ${d.exists ? 'ok' : 'missing'}`}>
                          {d.exists ? `✓ ${t.workspace_status_ok}` : `✕ ${t.workspace_status_missing}`}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {d.exists && d.synced !== null && (
                          <span className={`workspace-status ${d.synced ? 'ok' : 'outdated'}`}>
                            {d.synced ? `✓ ${t.workspace_status_synced}` : `⚠ ${t.workspace_status_outdated}`}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn-danger custom-dirs-remove" onClick={() => removeMapping(i)}>
                          {t.workspace_custom_remove}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Add new mapping */}
            <div className="custom-dirs-row">
              <input
                className="custom-dirs-input"
                placeholder={t.workspace_custom_repo_placeholder}
                value={newRepo}
                onChange={e => { setNewRepo(e.target.value) }}
              />
              <span className="custom-dirs-arrow">→</span>
              <input
                className="custom-dirs-input"
                placeholder={newRepo.trim()
                  ? newRepo.trim().startsWith('.aicontext/')
                    ? newRepo.trim()
                    : `.aicontext/${newRepo.trim()}`
                  : t.workspace_custom_local_placeholder}
                value={newLocal}
                onChange={e => setNewLocal(e.target.value)}
              />
              <button
                className="btn-primary"
                disabled={!newRepo.trim() || mappingSaving || isDuplicate}
                onClick={addMapping}
              >
                {mappingSaving ? t.workspace_custom_saving : t.workspace_custom_save}
              </button>
            </div>
            {isDuplicate && (
              <small className="hint-error" style={{ marginTop: 4 }}>✕ {t.workspace_custom_duplicate}</small>
            )}
          </div>

          {/* Assistants */}
          <div className="workspace-section-divider" />
          <h3 className="workspace-section-title">{t.assistants_title}</h3>
          <p className="page-subtitle" style={{ marginBottom: 16 }}>{t.assistants_subtitle}</p>

          <div className="assistant-select-list">
            {ASSISTANT_GROUPS.map(group => (
              <AssistantCard
                key={group.id}
                id={group.id}
                label={group.label}
                isSelected={selected.has(group.id)}
                dirs={data?.assistants[group.id]?.aicontext ?? []}
                inRepo={data?.assistants[group.id]?.in_repo ?? false}
                onToggle={() => toggle(group.id)}
                onSave={saveChanges}
                onDirsCreated={loadDirs}
              />
            ))}
          </div>

          {hasChanges && (
            <button
              className={`btn-primary ${saveState === 'saved' ? 'btn-saved' : ''}`}
              style={{ marginTop: 20 }}
              disabled={saveState === 'saving'}
              onClick={saveChanges}
            >
              {saveState === 'saving' ? t.assistant_toggling
                : saveState === 'saved' ? t.workspace_recreate_done
                : t.context_settings_save}
            </button>
          )}
        </>
      ))}
    </div>
  )
}
