import { useEffect, useState } from 'react'
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import OverviewPage from './OverviewPage'
import AssistantsPage from './AssistantsPage'
import RepositoriesPage from './RepositoriesPage'
import SummaryPage from './SummaryPage'
import WorkspacePage from './WorkspacePage'
import { useLang } from '../i18n/LangContext'
import LangSelector from '../components/LangSelector'
import ContextSettingsModal from '../components/ContextSettingsModal'

interface Context {
  id: string
  name: string
  provider: 'github' | 'gitlab' | 'bitbucket'
  workspace: string
  resources_repo: string
  auth: { type: string; token?: string; key_path?: string }
}

interface ContextsResponse {
  active: Context
  contexts: Context[]
}

export default function MainLayout() {
  const { t } = useLang()
  const navigate = useNavigate()
  const [data, setData] = useState<ContextsResponse | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [syncState, setSyncState] = useState<'idle' | 'checking' | 'syncing' | 'up_to_date' | 'updated'>('idle')

  useEffect(() => {
    fetch('/api/contexts').then(r => r.json()).then(setData)
  }, [])

  async function switchContext(id: string) {
    await fetch('/api/contexts/active', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    window.location.reload()
  }

  async function sync() {
    setSyncState('checking')
    const status = await fetch('/api/repo-sync/status').then(r => r.json())
    setSyncState('syncing')
    // Always force sync to workspace — even if up_to_date, local dirs may have been deleted
    const endpoint = status.needs_clone ? '/api/repo-sync/clone' : '/api/repo-sync/pull'
    await fetch(endpoint, { method: 'POST' })
    window.dispatchEvent(new CustomEvent('aiframes:synced'))
    setSyncState(status.up_to_date ? 'up_to_date' : 'updated')
    setTimeout(() => setSyncState('idle'), 2500)
  }

  function handleContextSaved(updated: Context) {
    setData(prev => {
      if (!prev) return prev
      return {
        active: prev.active.id === updated.id ? updated : prev.active,
        contexts: prev.contexts.map(c => c.id === updated.id ? updated : c),
      }
    })
  }

  return (
    <div className="layout">
      <header className="topbar">
        <span className="logo">AI-FRAMES</span>
        <div className="context-selector">
          <select
            value={data?.active?.id ?? ''}
            onChange={e => switchContext(e.target.value)}
          >
            {data?.contexts.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {data?.active && (
            <button className="btn-context-settings" onClick={() => setSettingsOpen(true)} title="Context settings">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
          )}
          <button className="btn-context-settings" onClick={() => navigate('/setup')} title="New context">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        </div>
        <div className="topbar-right">
          <button
            className={`btn-sync ${syncState === 'updated' ? 'btn-saved' : ''}`}
            disabled={syncState === 'checking' || syncState === 'syncing'}
            onClick={sync}
            title="Sync resources"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={syncState === 'checking' || syncState === 'syncing' ? 'spin' : ''}>
              <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            {syncState === 'checking' ? t.sync_checking
              : syncState === 'syncing' ? t.sync_syncing
              : syncState === 'up_to_date' ? t.sync_up_to_date
              : syncState === 'updated' ? t.sync_updated
              : t.sync_button}
          </button>
          <LangSelector />
        </div>
      </header>

      <div className="main">
        <nav className="sidebar">
          <NavLink to="/" end>{t.nav_overview}</NavLink>
          <p className="nav-group">{t.nav_group_config}</p>
          <NavLink to="/workspace">{t.nav_workspace}</NavLink>
          <NavLink to="/repositories">{t.nav_repositories}</NavLink>
          <p className="nav-group">{t.nav_resources}</p>
          <NavLink to="/templates">{t.nav_templates}</NavLink>
          <NavLink to="/agents">{t.nav_agents}</NavLink>
          <NavLink to="/skills">{t.nav_skills}</NavLink>
          <NavLink to="/rules">{t.nav_rules}</NavLink>
          <NavLink to="/hooks">{t.nav_hooks}</NavLink>
          <NavLink to="/prompts">{t.nav_prompts}</NavLink>
          <NavLink to="/mcps">{t.nav_mcps}</NavLink>
          <NavLink to="/tools">{t.nav_tools}</NavLink>
          <p className="nav-group">{t.nav_group_final}</p>
          <NavLink to="/summary">{t.nav_summary}</NavLink>
        </nav>

        <section className="content">
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/assistants" element={<WorkspacePage />} />
            <Route path="/repositories" element={<RepositoriesPage />} />
            <Route path="/workspace" element={<WorkspacePage />} />
            <Route path="/summary" element={<SummaryPage />} />
            <Route path="/templates" element={<div className="coming-soon">{t.coming_soon}</div>} />
            <Route path="/agents" element={<div className="coming-soon">{t.coming_soon}</div>} />
            <Route path="/skills" element={<div className="coming-soon">{t.coming_soon}</div>} />
            <Route path="/rules" element={<div className="coming-soon">{t.coming_soon}</div>} />
            <Route path="/hooks" element={<div className="coming-soon">{t.coming_soon}</div>} />
            <Route path="/prompts" element={<div className="coming-soon">{t.coming_soon}</div>} />
            <Route path="/mcps" element={<div className="coming-soon">{t.coming_soon}</div>} />
            <Route path="/tools" element={<div className="coming-soon">{t.coming_soon}</div>} />
            <Route path="*" element={<div className="coming-soon">{t.coming_soon}</div>} />
          </Routes>
        </section>
      </div>

      {settingsOpen && data?.active && (
        <ContextSettingsModal
          context={data.active}
          onClose={() => setSettingsOpen(false)}
          onSaved={updated => { handleContextSaved(updated); setSettingsOpen(false) }}
        />
      )}
    </div>
  )
}
