import { useEffect, useState } from 'react'
import { useLang } from '../i18n/LangContext'

interface DirEntry { path: string; exists: boolean; synced: boolean | null }
interface DirMapping { repo_path: string; local_path: string }

interface Props {
  id: string
  label: string
  isSelected: boolean
  dirs: DirEntry[]
  inRepo: boolean
  onToggle: () => void
  onSave: () => void
  onDirsCreated: () => void
}

export default function AssistantCard({ id, label, isSelected, dirs, inRepo, onToggle, onSave, onDirsCreated }: Props) {
  const { t } = useLang()

  const allExist = dirs.length > 0 && dirs.every(d => d.exists)
  const [creating, setCreating] = useState(false)

  // Custom mappings for this assistant
  const [mappings, setMappings] = useState<DirMapping[]>([])
  const [newRepo, setNewRepo] = useState('')
  const [newLocal, setNewLocal] = useState('')
  const [mappingSaving, setMappingSaving] = useState(false)

  useEffect(() => {
    if (!isSelected) return
    fetch(`/api/custom-dirs/${id}`).then(r => r.json()).then(d => setMappings(d.mappings ?? []))
  }, [id, isSelected])

  async function createDirs() {
    setCreating(true)
    // Create dirs in remote repo + pull + sync to workspace
    await fetch(`/api/assistant-init/${id}`, { method: 'POST' })
    setCreating(false)
    onDirsCreated()
  }

  async function persistMappings(updated: DirMapping[]) {
    await fetch(`/api/custom-dirs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
    setMappings(updated)
  }

  async function addMapping() {
    if (!newRepo.trim()) return
    setMappingSaving(true)
    const updated = [...mappings, { repo_path: newRepo.trim(), local_path: newLocal.trim() }]
    setNewRepo('')
    setNewLocal('')
    await persistMappings(updated)
    setMappingSaving(false)
  }

  async function removeMapping(i: number) {
    await persistMappings(mappings.filter((_, j) => j !== i))
  }

  const isDuplicate = !!newRepo.trim() && mappings.some(
    m => m.repo_path === newRepo.trim() ||
    m.local_path === (newLocal.trim() || (newRepo.trim().startsWith('.aicontext/') ? newRepo.trim() : `.aicontext/${newRepo.trim()}`))
  )

  return (
    <div className="assistant-select-row">
      {/* Toggle button */}
      <button
        className={`assistant-select-btn ${isSelected ? 'selected' : ''}`}
        onClick={onToggle}
      >
        <span className="assistant-select-check">{isSelected ? '✓' : ''}</span>
        {label}
      </button>

      {/* Dirs panel — only when selected */}
      {isSelected && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* Missing dirs warning — shown when not yet in the repo */}
          {!inRepo && (
            <div className="assistant-dirs-warning">
              <span>⚠ {t.assistant_dirs_missing}</span>
              <button
                className="btn-primary"
                disabled={creating}
                onClick={createDirs}
              >
                {creating ? t.assistant_dirs_creating : t.assistant_dirs_create}
              </button>
            </div>
          )}

          {/* Dirs table — shown when repo has them */}
          {inRepo && dirs.length > 0 && (
            <div className="assistant-select-dirs">
              {dirs.map(d => (
                <div key={d.path} className="assistant-select-dir">
                  <span className="assistant-select-dir-path">{d.path}</span>
                  <span className={`workspace-status ${d.exists ? 'ok' : 'missing'}`}>
                    {d.exists ? `✓ ${t.workspace_status_ok}` : `✕ ${t.workspace_status_missing}`}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Custom mappings — shown when in repo */}
          {inRepo && (
            <div className="assistant-custom-section">
              <span className="assistant-custom-label">{t.assistant_custom_mappings}</span>

              {mappings.length > 0 && (
                <table className="repo-table workspace-table" style={{ marginBottom: 8 }}>
                  <tbody>
                    {mappings.map((m, i) => (
                      <tr key={i}>
                        <td className="source">{m.repo_path}</td>
                        <td className="source">{m.local_path || `(same as repo)`}</td>
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

              <div className="custom-dirs-row">
                <input
                  className="custom-dirs-input"
                  placeholder={t.workspace_custom_repo_placeholder}
                  value={newRepo}
                  onChange={e => setNewRepo(e.target.value)}
                />
                <span className="custom-dirs-arrow">→</span>
                <input
                  className="custom-dirs-input"
                  placeholder={newRepo.trim()
                    ? newRepo.trim().startsWith('.aicontext/') ? newRepo.trim() : `.aicontext/${newRepo.trim()}`
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
          )}
        </div>
      )}
    </div>
  )
}
