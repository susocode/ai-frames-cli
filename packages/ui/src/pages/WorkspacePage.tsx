import { useEffect, useState, useCallback } from 'react'
import { useLang } from '../i18n/LangContext'
import AssistantCard from '../components/AssistantCard'
import DirHint from '../components/DirHint'
import CustomMappings from '../components/CustomMappings'

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

interface AssistantGroup { id: string; label: string; prefix: string; enabled: boolean }

export default function WorkspacePage() {
  const { t } = useLang()

  const [repoStatus, setRepoStatus] = useState<RepoStatus>('checking')
  const [initState, setInitState] = useState<InitState>('idle')
  const [data, setData] = useState<WorkspaceData | null>(null)
  const [loadingDirs, setLoadingDirs] = useState(true)
  const [recreateState, setRecreateState] = useState<RecreateState>('idle')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [assistantGroups, setAssistantGroups] = useState<AssistantGroup[]>([])
  const [assistantSelections, setAssistantSelections] = useState<Record<string, boolean>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [originalSelected, setOriginalSelected] = useState<Set<string>>(new Set())
  const [mappings, setMappings] = useState<DirMapping[]>([])
  const [mappingSaving, setMappingSaving] = useState(false)

  const loadDirs = useCallback(async () => {
    setLoadingDirs(true)
    const [dirsRes, assistRes, selRes] = await Promise.all([
      fetch('/api/workspace-dirs').then(r => r.json()),
      fetch('/api/assistants').then(r => r.json()),
      fetch('/api/assistants/selections').then(r => r.json()),
    ])
    setAssistantSelections(selRes.selections ?? {})
    const d: WorkspaceData = dirsRes
    const groups: AssistantGroup[] = assistRes.assistants ?? []
    setData(d)
    setAssistantGroups(groups)
    // Enabled = persisted in assistants.yaml OR dirs exist in workspace
    const enabled = new Set<string>(
      groups.filter(g => g.enabled || (d.assistants[g.id]?.aicontext[0]?.exists ?? false)).map(g => g.id)
    )
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

  const hasMissing = data?.base.some(d => !d.exists) ?? false
  const hasChanges = [...selected].sort().join() !== [...originalSelected].sort().join()

  function toggle(id: string) {
    const isCurrentlySelected = selected.has(id)
    if (isCurrentlySelected && assistantSelections[id] === true) {
      const confirmed = window.confirm(t.assistant_has_selections)
      if (!confirmed) return
    }
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
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
    for (const group of assistantGroups) {
      const wasEnabled = originalSelected.has(group.id)
      const nowEnabled = selected.has(group.id)
      if (wasEnabled !== nowEnabled) {
        await fetch('/api/workspace-dirs/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assistant: group.id, prefix: group.prefix, enable: nowEnabled }),
        })
      }
    }
    // Persist enabled state to assistants.yaml
    const updated = assistantGroups.map(g => ({ ...g, enabled: selected.has(g.id) }))
    await fetch('/api/assistants', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
    setAssistantGroups(updated)
    setOriginalSelected(new Set(selected))
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
              <span className="workspace-group-label">.aicontext/</span>
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
                    <td className="source">
                      {d.path}
                      <DirHint dirPath={d.path} />
                    </td>
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

          {/* Custom mappings */}
          <div className="custom-dirs-section">
            <CustomMappings
              mappings={mappings}
              savedEntries={data?.custom ?? []}
              saving={mappingSaving}
              onAdd={async (repo, local) => {
                setMappingSaving(true)
                const updated = [...mappings, { repo_path: repo, local_path: local }]
                await persistMappings(updated)
                setMappingSaving(false)
              }}
              onRemove={async (i, localPath, exists) => {
                if (exists) {
                  await fetch('/api/custom-dirs/local', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ local_path: localPath }),
                  })
                }
                await removeMapping(i)
              }}
            />
          </div>

          {/* Assistants */}
          <div className="workspace-section-divider" />
          <h3 className="workspace-section-title">{t.assistants_title}</h3>
          <p className="page-subtitle">{t.assistants_subtitle}</p>
          <div className="assistants-info-banner">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>{t.assistants_section_info}</span>
          </div>

          <div className="assistant-select-list">
            {assistantGroups.map(group => (
              <AssistantCard
                key={group.id}
                id={group.id}
                label={group.label}
                prefix={group.prefix}
                isSelected={selected.has(group.id)}
                dirs={data?.assistants[group.id]?.aicontext ?? []}
                inRepo={data?.assistants[group.id]?.in_repo ?? false}
                onToggle={() => toggle(group.id)}
                onSave={saveChanges}
                onDirsCreated={loadDirs}
              />
            ))}
          </div>

          <div className="marketplace-footer visible">
            <span className="marketplace-footer-count">
              {selected.size} {t.assistants_title.toLowerCase()}
            </span>
            <button
              className={`btn-primary ${saveState === 'saved' ? 'btn-saved' : ''}`}
              disabled={saveState === 'saving' || !hasChanges}
              onClick={saveChanges}
            >
              {saveState === 'saving' ? t.assistant_toggling
                : saveState === 'saved' ? t.workspace_recreate_done
                : t.context_settings_save}
            </button>
          </div>
        </>
      ))}
    </div>
  )
}
