'use client'

import { useState } from 'react'
import { useLang } from '@/i18n/LangContext'

interface DirEntry { path: string; exists: boolean; synced: boolean | null }
interface DirMapping { repo_path: string; local_path: string }
interface CustomEntry extends DirEntry { repo_path: string; local_path: string }

interface Props {
  mappings: DirMapping[]
  savedEntries?: CustomEntry[]
  saving?: boolean
  assistantPrefix?: string
  onAdd: (repo_path: string, local_path: string) => Promise<void>
  onRemove: (index: number, local_path: string, exists: boolean) => Promise<void>
}

export default function CustomMappings({ mappings, savedEntries = [], saving = false, assistantPrefix, onAdd, onRemove }: Props) {
  const { t } = useLang()
  const [newRepo, setNewRepo] = useState('')
  const [newLocal, setNewLocal] = useState('')

  function defaultLocalPath(repo: string): string {
    const r = repo.trim()
    if (!r) return ''
    if (r.startsWith('.aicontext/')) return r
    if (assistantPrefix) return `.aicontext/${assistantPrefix}/${r}`
    return `.aicontext/${r}`
  }

  const isDuplicate = !!newRepo.trim() && mappings.some(
    m => m.repo_path === newRepo.trim() || m.local_path === (newLocal.trim() || defaultLocalPath(newRepo.trim()))
  )

  async function handleAdd() {
    if (!newRepo.trim() || isDuplicate) return
    const r = newRepo.trim(); const l = newLocal.trim()
    setNewRepo(''); setNewLocal('')
    await onAdd(r, l)
  }

  async function handleRemove(i: number) {
    const entry = savedEntries[i]
    const localPath = entry?.local_path ?? mappings[i]?.local_path ?? ''
    const exists = entry?.exists ?? false
    if (exists && !window.confirm(t.workspace_custom_remove_dir_confirm)) return
    await onRemove(i, localPath, exists)
  }

  return (
    <div className="custom-mappings">
      <p className="custom-mappings-title">{t.workspace_custom_dirs_title}</p>
      <p className="custom-mappings-subtitle">{t.workspace_custom_dirs_subtitle}</p>
      {savedEntries.length > 0 && (
        <table className="repo-table workspace-table custom-mappings-table">
          <thead><tr>
            <th style={{ textAlign: 'left' }}>{t.workspace_custom_repo_path}</th>
            <th style={{ textAlign: 'left' }}>{t.workspace_custom_local_path}</th>
            <th style={{ textAlign: 'right', width: 80 }}>{t.workspace_col_status}</th>
            <th style={{ textAlign: 'right', width: 90 }}>Sync</th>
            <th style={{ width: 70 }}></th>
          </tr></thead>
          <tbody>
            {savedEntries.map((d, i) => (
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
                  <button className="btn-danger custom-dirs-remove" onClick={() => handleRemove(i)}>{t.workspace_custom_remove}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="custom-dirs-row">
        <input className="custom-dirs-input" placeholder={t.workspace_custom_repo_placeholder} value={newRepo} onChange={e => setNewRepo(e.target.value)} />
        <span className="custom-dirs-arrow">→</span>
        <input className="custom-dirs-input" placeholder={newRepo.trim() ? defaultLocalPath(newRepo.trim()) : t.workspace_custom_local_placeholder} value={newLocal} onChange={e => setNewLocal(e.target.value)} />
        <button className="btn-primary" disabled={!newRepo.trim() || saving || isDuplicate} onClick={handleAdd}>
          {saving ? t.workspace_custom_saving : t.workspace_custom_save}
        </button>
      </div>
      {isDuplicate && <small className="hint-error" style={{ marginTop: 4 }}>✕ {t.workspace_custom_duplicate}</small>}
    </div>
  )
}
