'use client'

import { useEffect, useState } from 'react'
import { useLang } from '@/i18n/LangContext'
import DirHint from './DirHint'
import CustomMappings from './CustomMappings'

interface DirEntry { path: string; exists: boolean; synced: boolean | null }
interface DirMapping { repo_path: string; local_path: string }
interface CustomEntry extends DirEntry { repo_path: string; local_path: string }

interface Props {
  id: string; label: string; prefix: string
  isSelected: boolean; dirs: DirEntry[]; inRepo: boolean
  onToggle: () => void; onSave: () => void; onDirsCreated: () => void
}

export default function AssistantCard({ id, label, prefix, isSelected, dirs, inRepo, onToggle, onSave, onDirsCreated }: Props) {
  const { t } = useLang()
  const allExist = dirs.length > 0 && dirs.every(d => d.exists)
  const [creating, setCreating] = useState(false)
  const [mappings, setMappings] = useState<DirMapping[]>([])
  const [entries, setEntries] = useState<CustomEntry[]>([])
  const [mappingSaving, setMappingSaving] = useState(false)

  async function loadMappings() {
    const d = await fetch(`/api/custom-dirs/${id}`).then(r => r.json())
    setMappings(d.mappings ?? [])
    setEntries(d.entries ?? [])
  }

  useEffect(() => { if (!isSelected) return; loadMappings() }, [id, isSelected])

  async function createDirs() {
    setCreating(true)
    await fetch(`/api/assistant-init/${id}`, { method: 'POST' })
    setCreating(false)
    onDirsCreated()
  }

  async function persistMappings(updated: DirMapping[]) {
    await fetch(`/api/custom-dirs/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) })
    await loadMappings()
  }

  return (
    <div className="assistant-select-row">
      <button className={`assistant-select-btn ${isSelected ? 'selected' : ''}`} onClick={onToggle}>
        <span className="assistant-select-check">{isSelected ? '✓' : ''}</span>
        {label}
      </button>
      {isSelected && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!inRepo && (
            <div className="assistant-dirs-warning">
              <span>⚠ {t.assistant_dirs_missing}</span>
              <button className="btn-primary" disabled={creating} onClick={createDirs}>
                {creating ? t.assistant_dirs_creating : t.assistant_dirs_create}
              </button>
            </div>
          )}
          {inRepo && dirs.length > 0 && (
            <div className="workspace-group" style={{ marginBottom: 0 }}>
              <table className="repo-table workspace-table">
                <thead><tr>
                  <th style={{ textAlign: 'left' }}>{t.workspace_col_path}</th>
                  <th style={{ textAlign: 'right', width: 90 }}>{t.workspace_col_status}</th>
                  <th style={{ textAlign: 'right', width: 110 }}>Sync</th>
                </tr></thead>
                <tbody>
                  {dirs.map(d => (
                    <tr key={d.path}>
                      <td className="source">{d.path}<DirHint dirPath={d.path} /></td>
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
          )}
          {inRepo && (
            <div className="custom-dirs-section" style={{ marginTop: 8 }}>
              <CustomMappings
                mappings={mappings} savedEntries={entries} assistantPrefix={prefix} saving={mappingSaving}
                onAdd={async (repo, local) => {
                  setMappingSaving(true)
                  await persistMappings([...mappings, { repo_path: repo, local_path: local }])
                  setMappingSaving(false)
                }}
                onRemove={async (i, localPath, exists) => {
                  if (exists) await fetch('/api/custom-dirs/local', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ local_path: localPath }) })
                  await persistMappings(mappings.filter((_, j) => j !== i))
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
