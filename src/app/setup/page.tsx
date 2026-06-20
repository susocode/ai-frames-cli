'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useLang } from '@/i18n/LangContext'
import LangSelector from '@/components/LangSelector'
import ThemeToggle from '@/components/ThemeToggle'
import { isAbsolutePath } from '@/utils/path'
import { isValidRepoFormat, isValidCreateName } from '@/utils/repo'
import { errorMessage } from '@/i18n'

type VerifyStatus = 'idle' | 'checking' | 'ok' | 'not_found' | 'auth_error' | 'error'
type Provider = '' | 'github' | 'gitlab' | 'bitbucket'

interface FormState {
  name: string; provider: Provider; resources_repo: string; token: string; ssh_key: string; workspace: string
}

export default function SetupPage() {
  const { t } = useLang()
  const router = useRouter()
  const [canGoBack, setCanGoBack] = useState(false)

  useEffect(() => {
    fetch('/api/contexts').then(r => r.json()).then(d => setCanGoBack(!d.setup_required))
  }, [])

  const STEPS = [t.wizard_step_context, t.wizard_step_provider, t.wizard_step_resources, t.wizard_step_workspace]
  const [step, setStep] = useState(0)
  const [authOpen, setAuthOpen] = useState(false)
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>('idle')
  const [resourcesMode, setResourcesMode] = useState<'existing' | 'create'>('existing')
  const [createName, setCreateName] = useState('')
  const [createStatus, setCreateStatus] = useState<'idle' | 'creating' | 'created' | 'error'>('idle')
  const [createErrorCode, setCreateErrorCode] = useState('')
  const [workspaceStatus, setWorkspaceStatus] = useState<'idle' | 'checking' | 'ok' | 'not_found'>('idle')
  const [form, setForm] = useState<FormState>({ name: '', provider: 'github', resources_repo: '', token: '', ssh_key: '', workspace: '' })
  const [errorCode, setErrorCode] = useState('')
  const [loading, setLoading] = useState(false)

  function update(field: keyof FormState, value: string, skipVerifyReset = false) {
    if (field === 'name') value = value.replace(/[^a-zA-Z0-9_-]/g, '')
    setForm(f => ({ ...f, [field]: value }))
    setErrorCode('')
    if (field === 'resources_repo' && !skipVerifyReset) setVerifyStatus('idle')
  }

  useEffect(() => {
    const path = form.workspace.trim()
    if (!path || !isAbsolutePath(path)) { setWorkspaceStatus('idle'); return }
    setWorkspaceStatus('checking')
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/workspace-check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path }) })
        const data = await res.json()
        setWorkspaceStatus(data.exists ? 'ok' : 'not_found')
      } catch { setWorkspaceStatus('idle') }
    }, 500)
    return () => clearTimeout(timer)
  }, [form.workspace])

  const stateRef = useRef({ step, form, verifyStatus, workspaceStatus })
  stateRef.current = { step, form, verifyStatus, workspaceStatus }

  function canNext(s = stateRef.current.step, f = stateRef.current.form, v = stateRef.current.verifyStatus, w = stateRef.current.workspaceStatus): boolean {
    if (s === 0) return f.name.trim().length > 0
    if (s === 1) return f.provider !== ''
    if (s === 2) {
      if (resourcesMode === 'create') return createStatus === 'created' && isValidCreateName(createName)
      return v === 'ok' && isValidRepoFormat(f.resources_repo)
    }
    if (s === 3) return f.workspace.trim().length > 0 && isAbsolutePath(f.workspace) && w === 'ok'
    return false
  }

  function advance() {
    const { step: s } = stateRef.current
    if (!canNext()) return
    if (s < STEPS.length - 1) { setStep(s + 1) } else { submit() }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter' && !(e.target instanceof HTMLSelectElement)) advance()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  async function createRepo() {
    setCreateStatus('creating'); setCreateErrorCode('')
    try {
      const res = await fetch('/api/repo-create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: form.provider, name: createName.trim(), auth: form.token.trim() ? { type: 'pat', token: form.token.trim() } : { type: 'none' } }),
      })
      const data = await res.json()
      if (!res.ok) { setCreateStatus('error'); setCreateErrorCode(data.code ?? 'unknown-error') }
      else { update('resources_repo', data.full_name); setCreateStatus('created') }
    } catch { setCreateStatus('error'); setCreateErrorCode('unknown-error') }
  }

  async function verify() {
    setVerifyStatus('checking')
    try {
      const res = await fetch('/api/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: form.provider, resources_repo: form.resources_repo,
          auth: form.token.trim() ? { type: 'pat', token: form.token.trim() } : form.ssh_key.trim() ? { type: 'ssh', key_path: form.ssh_key.trim() } : { type: 'none' } }),
      })
      const data = await res.json()
      if (!res.ok) { setVerifyStatus(data.code === 'auth-failed' ? 'auth_error' : 'error') }
      else { if (data.exists) { setVerifyStatus('ok'); if (data.repo) update('resources_repo', data.repo, true) } else { setVerifyStatus('not_found') } }
    } catch { setVerifyStatus('error') }
  }

  async function submit() {
    setLoading(true)
    try {
      const auth = form.token.trim() ? { type: 'pat', token: form.token.trim() }
        : form.ssh_key.trim() ? { type: 'ssh', key_path: form.ssh_key.trim() } : { type: 'none' }
      const res = await fetch('/api/contexts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.replace(/-/g, '_'), provider: form.provider, resources_repo: form.resources_repo, auth, workspace: form.workspace }),
      })
      if (!res.ok) throw new Error(await res.text())
      router.replace('/overview')
    } catch (e) {
      const data = e instanceof Error ? null : e as any
      setErrorCode(data?.code ?? 'unknown-error')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ position: 'relative' }}>
      <div className="lang-fixed">
        <ThemeToggle />
        <LangSelector />
      </div>
      <div className="wizard">
        <header className="wizard-header">
          {canGoBack && <button className="wizard-back-btn" onClick={() => router.replace('/overview')}>← {t.wizard_back}</button>}
          <h1>{t.wizard_title}</h1>
          <p>{t.wizard_subtitle}</p>
        </header>
        <div className="wizard-steps">
          {STEPS.map((s, i) => (
            <span key={s} className={`wizard-step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}>{s}</span>
          ))}
        </div>
        <div className="wizard-body">
          {step === 0 && (
            <div className="wizard-field">
              <label>{t.context_name_label}</label>
              <input autoFocus placeholder={t.context_name_placeholder} value={form.name} onChange={e => update('name', e.target.value)} />
              <small>{t.context_name_hint}</small>
            </div>
          )}
          {step === 1 && (
            <div className="wizard-field">
              <label>{t.provider_label}</label>
              <select autoFocus value={form.provider} onChange={e => update('provider', e.target.value as Provider)}>
                <option value="" disabled>{t.provider_placeholder}</option>
                <option value="github">GitHub</option>
                <option value="gitlab">GitLab</option>
                <option value="bitbucket">Bitbucket</option>
              </select>
              <div className={`wizard-auth-optional ${!form.provider ? 'disabled' : ''}`}>
                <button type="button" className="wizard-auth-toggle" disabled={!form.provider} onClick={() => setAuthOpen(o => !o)}>
                  <span className={`wizard-auth-chevron ${authOpen ? 'open' : ''}`}>›</span>
                  {t.auth_optional_label}<span className="wizard-auth-opt-hint">{t.auth_optional_hint}</span>
                </button>
                {authOpen && form.provider && (
                  <div className="wizard-auth-body">
                    <div className="wizard-subfield">
                      <label>{t.auth_token_label}</label>
                      <input type="password" placeholder={t.auth_token_placeholder} value={form.token} onChange={e => update('token', e.target.value)} />
                    </div>
                    <div className="wizard-subfield">
                      <label>{t.auth_ssh_label}</label>
                      <input placeholder={t.auth_ssh_placeholder} value={form.ssh_key} onChange={e => update('ssh_key', e.target.value)} />
                      {form.ssh_key.trim() && !isAbsolutePath(form.ssh_key) && <small className="hint-error">✕ {t.auth_ssh_invalid}</small>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="wizard-field">
              <label>{t.resources_repo_label}</label>
              <div className="resources-mode-toggle">
                <button type="button" className={`resources-mode-btn ${resourcesMode === 'existing' ? 'active' : ''}`}
                  onClick={() => { setResourcesMode('existing'); setCreateStatus('idle'); setCreateErrorCode('') }}>
                  {t.resources_mode_existing}
                </button>
                <button type="button" className={`resources-mode-btn ${resourcesMode === 'create' ? 'active' : ''}`}
                  onClick={() => { setResourcesMode('create'); setVerifyStatus('idle') }}>
                  {t.resources_mode_create}
                </button>
              </div>
              {resourcesMode === 'existing' && (
                <>
                  <div className="verify-row">
                    <input autoFocus placeholder={t.resources_repo_placeholder} value={form.resources_repo} onChange={e => update('resources_repo', e.target.value)} />
                    <button type="button" className={`btn-verify ${verifyStatus}`}
                      disabled={!form.resources_repo.trim() || !isValidRepoFormat(form.resources_repo) || verifyStatus === 'checking'} onClick={verify}>
                      {verifyStatus === 'checking' ? t.verify_checking : verifyStatus === 'ok' ? t.verify_verified : t.verify_button}
                    </button>
                  </div>
                  {form.resources_repo.trim() && !isValidRepoFormat(form.resources_repo) && <small className="hint-error">✕ {t.resources_repo_invalid}</small>}
                  {verifyStatus !== 'idle' && verifyStatus !== 'checking' && (
                    <p className={`verify-msg ${verifyStatus}`}>
                      {verifyStatus === 'ok' && '✓ ' + t.verify_ok}
                      {verifyStatus === 'not_found' && '✗ ' + t.verify_not_found}
                      {verifyStatus === 'auth_error' && '✗ ' + t.verify_auth_error}
                      {verifyStatus === 'error' && '✗ ' + t.verify_error}
                    </p>
                  )}
                  {form.provider && (() => {
                    const formats = form.provider === 'github' ? t.resources_repo_hint_github : form.provider === 'gitlab' ? t.resources_repo_hint_gitlab : t.resources_repo_hint_bitbucket
                    return <div className="hint-provider"><span className="hint-provider-label">{t.resources_repo_hint_label}</span><ul className="hint-provider-list">{formats.map((f: string) => <li key={f}>{f}</li>)}</ul></div>
                  })()}
                </>
              )}
              {resourcesMode === 'create' && (
                <>
                  <div className="verify-row">
                    <input autoFocus placeholder={t.resources_create_name_placeholder} value={createName} disabled={createStatus === 'created'}
                      onChange={e => { setCreateName(e.target.value.replace(/[^a-zA-Z0-9_\-/]/g, '')); setCreateStatus('idle'); setCreateErrorCode('') }} />
                    <button type="button" className={`btn-verify ${createStatus === 'created' ? 'ok' : createStatus === 'error' ? 'error' : ''}`}
                      disabled={!createName.trim() || !isValidCreateName(createName) || createStatus === 'creating' || createStatus === 'created' || !form.token.trim()} onClick={createRepo}>
                      {createStatus === 'creating' ? t.resources_creating : createStatus === 'created' ? t.resources_created : t.resources_create_button}
                    </button>
                  </div>
                  {createName.trim() && !isValidCreateName(createName) && <small className="hint-error">✕ {t.resources_create_invalid}</small>}
                  {createStatus === 'created' && <p className="verify-msg ok">✓ {form.resources_repo}</p>}
                  {createErrorCode && <p className="verify-msg not_found">✗ {errorMessage(t, createErrorCode)}</p>}
                  {!form.token.trim() && <small className="hint-error">✕ {t.auth_token_label} required to create a repository</small>}
                </>
              )}
            </div>
          )}
          {step === 3 && (
            <div className="wizard-field">
              <label>{t.workspace_label}</label>
              <input autoFocus placeholder={t.workspace_placeholder} value={form.workspace} onChange={e => update('workspace', e.target.value)} />
              {form.workspace.trim() && !isAbsolutePath(form.workspace) && <small className="hint-error">✕ {t.workspace_absolute_hint}</small>}
              {form.workspace.trim() && isAbsolutePath(form.workspace) && workspaceStatus === 'checking' && <small style={{ color: 'var(--text-muted)' }}>⏳ {t.workspace_checking}</small>}
              {workspaceStatus === 'not_found' && <small className="hint-error">✕ {t.workspace_not_found}</small>}
              {workspaceStatus === 'ok' && <small style={{ color: 'var(--success)' }}>✓ {form.workspace}</small>}
              <small>{t.workspace_hint}</small>
            </div>
          )}
          {errorCode && <p className="wizard-error">{errorMessage(t, errorCode)}</p>}
        </div>
        <div className="wizard-actions">
          {step > 0 && <button className="btn-secondary" onClick={() => setStep(s => s - 1)}>{t.wizard_back}</button>}
          {step < STEPS.length - 1 && (
            <button className="btn-primary" disabled={!canNext(step, form, verifyStatus, workspaceStatus)} onClick={advance}>{t.wizard_next}</button>
          )}
          {step === STEPS.length - 1 && (
            <button className="btn-primary" disabled={!canNext(step, form, verifyStatus) || loading} onClick={advance}>
              {loading ? t.wizard_saving : t.wizard_finish}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
