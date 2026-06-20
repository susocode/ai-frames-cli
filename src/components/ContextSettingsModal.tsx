'use client'

import { useState, useEffect, useRef } from 'react'
import { useLang } from '@/i18n/LangContext'
import { isAbsolutePath } from '@/utils/path'
import { errorMessage } from '@/i18n'

type Provider = 'github' | 'gitlab' | 'bitbucket'
type SaveState = 'idle' | 'saving' | 'saved'

interface Context {
  id: string; name: string; provider: Provider; resources_repo: string; workspace: string
  auth: { type: string; token?: string; key_path?: string }
}

interface Props { context: Context; onClose: () => void; onSaved: (updated: Context) => void }

export default function ContextSettingsModal({ context, onClose, onSaved }: Props) {
  const { t } = useLang()
  const backdropRef = useRef<HTMLDivElement>(null)
  const [form, setForm] = useState({
    name: context.name, provider: context.provider, resources_repo: context.resources_repo,
    workspace: context.workspace, token: context.auth?.token ?? '', ssh_key: context.auth?.key_path ?? '',
  })
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveErrorCode, setSaveErrorCode] = useState('')
  const [authOpen, setAuthOpen] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function update(field: keyof typeof form, value: string) {
    if (field === 'name') value = value.replace(/[^a-zA-Z0-9_-]/g, '')
    setForm(f => ({ ...f, [field]: value }))
    setSaveState('idle'); setSaveErrorCode('')
  }

  async function save() {
    setSaveState('saving')
    const auth = form.token.trim() ? { type: 'pat', token: form.token.trim() }
      : form.ssh_key.trim() ? { type: 'ssh', key_path: form.ssh_key.trim() } : { type: 'none' }
    const res = await fetch(`/api/contexts/${context.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, provider: form.provider, resources_repo: form.resources_repo, workspace: form.workspace, auth }),
    })
    if (res.ok) {
      const updated = await res.json()
      setSaveErrorCode(''); setSaveState('saved')
      onSaved(updated)
      setTimeout(() => setSaveState('idle'), 1500)
    } else {
      const data = await res.json().catch(() => ({}))
      setSaveErrorCode(data.code ?? 'unknown-error'); setSaveState('idle')
    }
  }

  return (
    <div className="modal-backdrop" ref={backdropRef} onClick={e => { if (e.target === backdropRef.current) onClose() }}>
      <div className="modal">
        <div className="modal-header">
          <h2>{t.context_settings_title}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="modal-field"><label>ID</label><input value={context.id} readOnly className="input-readonly" /></div>
          <div className="modal-field">
            <label>{t.context_settings_name}</label>
            <input value={form.name} onChange={e => update('name', e.target.value)} />
            {form.name !== context.name && <p className="modal-warning"><span className="modal-warning-icon">⚠</span>{t.context_settings_name_warning}</p>}
          </div>
          <div className="modal-field">
            <label>{t.context_settings_workspace}</label>
            <input value={form.workspace} placeholder={t.workspace_placeholder} onChange={e => update('workspace', e.target.value)} />
            {form.workspace.trim() && !isAbsolutePath(form.workspace) && <small className="hint-error">✕ {t.workspace_absolute_hint}</small>}
            {form.workspace !== context.workspace && isAbsolutePath(form.workspace) && <p className="modal-warning"><span className="modal-warning-icon">⚠</span>{t.context_settings_repo_warning}</p>}
          </div>
          <div className="modal-field">
            <label>{t.context_settings_repo}</label>
            <input value={form.resources_repo} onChange={e => update('resources_repo', e.target.value)} />
            {form.resources_repo !== context.resources_repo && <p className="modal-warning"><span className="modal-warning-icon">⚠</span>{t.context_settings_resources_warning}</p>}
          </div>
          <div className="modal-divider" />
          <p className="modal-section-label">{t.context_settings_provider}</p>
          <div className="modal-provider-group">
            <div className="modal-field">
              <select value={form.provider} onChange={e => update('provider', e.target.value)}>
                <option value="github">GitHub</option>
                <option value="gitlab">GitLab</option>
                <option value="bitbucket">Bitbucket</option>
              </select>
              {form.provider !== context.provider && <p className="modal-warning"><span className="modal-warning-icon">⚠</span>{t.context_settings_provider_warning}</p>}
            </div>
            <div className="wizard-auth-optional modal-auth-collapse">
              <button type="button" className="wizard-auth-toggle" onClick={() => setAuthOpen(o => !o)}>
                <span className={`wizard-auth-chevron ${authOpen ? 'open' : ''}`}>›</span>
                {t.auth_optional_label}<span className="wizard-auth-opt-hint">{t.auth_optional_hint}</span>
              </button>
              {authOpen && (
                <div className="wizard-auth-body modal-provider-auth">
                  <div className="modal-field">
                    <label>{t.context_settings_token}</label>
                    <input type="password" value={form.token} onChange={e => update('token', e.target.value)} placeholder={t.auth_token_placeholder} />
                  </div>
                  <div className="modal-field">
                    <label>{t.context_settings_ssh}</label>
                    <input value={form.ssh_key} onChange={e => update('ssh_key', e.target.value)} placeholder={t.auth_ssh_placeholder} />
                    {form.ssh_key.trim() && !isAbsolutePath(form.ssh_key) && <small className="hint-error">✕ {t.auth_ssh_invalid}</small>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          {saveErrorCode && <p className="modal-footer-error">✕ {errorMessage(t, saveErrorCode)}</p>}
          <button className="btn-secondary" onClick={onClose}>{t.context_settings_cancel}</button>
          <button
            className={`btn-primary ${saveState === 'saved' ? 'btn-saved' : ''}`}
            disabled={saveState === 'saving' || !form.workspace.trim() || !isAbsolutePath(form.workspace) || !!(form.ssh_key.trim() && !isAbsolutePath(form.ssh_key))}
            onClick={save}
          >
            {saveState === 'saving' ? t.context_settings_saving : saveState === 'saved' ? t.context_settings_saved : t.context_settings_save}
          </button>
        </div>
      </div>
    </div>
  )
}
