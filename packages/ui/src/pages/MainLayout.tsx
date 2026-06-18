import { useEffect, useState } from 'react'
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import OverviewPage from './OverviewPage'
import AssistantsPage from './AssistantsPage'
import RepositoriesPage from './RepositoriesPage'
import SummaryPage from './SummaryPage'
import WorkspacePage from './WorkspacePage'
import MarketplacePage from './MarketplacePage'
import TemplatesPage from './TemplatesPage'
import { useLang } from '../i18n/LangContext'
import LangSelector from '../components/LangSelector'
import ThemeToggle from '../components/ThemeToggle'
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    localStorage.getItem('ai-frames_sidebar') === 'collapsed'
  )

  useEffect(() => {
    document.body.style.setProperty('--sidebar-w', sidebarCollapsed ? '52px' : '200px')
  }, [sidebarCollapsed])

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
        <button
          className="btn-sidebar-toggle"
          onClick={() => setSidebarCollapsed(v => {
            const next = !v
            localStorage.setItem('ai-frames_sidebar', next ? 'collapsed' : 'expanded')
            return next
          })}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {sidebarCollapsed
              ? <><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></>
              : <><rect x="3" y="3" width="6" height="18" rx="1"/><line x1="13" y1="8" x2="21" y2="8"/><line x1="13" y1="12" x2="21" y2="12"/><line x1="13" y1="16" x2="21" y2="16"/></>
            }
          </svg>
        </button>
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
        </div>
      </header>

      <div className="main">
        <nav className={`sidebar ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          <NavLink to="/" end>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            <span>{t.nav_overview}</span>
          </NavLink>

          <p className="nav-group">{t.nav_group_config}</p>
          <NavLink to="/workspace">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <span>{t.nav_workspace}</span>
          </NavLink>
          <NavLink to="/repositories">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            <span>{t.nav_repositories}</span>
          </NavLink>

          <p className="nav-group">{t.nav_resources}</p>
          <NavLink to="/templates">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
            <span>{t.nav_templates}</span>
          </NavLink>
          <NavLink to="/agents">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>
            <span>{t.nav_agents}</span>
          </NavLink>
          <NavLink to="/skills">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            <span>{t.nav_skills}</span>
          </NavLink>
          <NavLink to="/rules">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            <span>{t.nav_rules}</span>
          </NavLink>
          <NavLink to="/prompts">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span>{t.nav_prompts}</span>
          </NavLink>
          <NavLink to="/mcps">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            <span>{t.nav_mcps}</span>
          </NavLink>
          <NavLink to="/contexts">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            <span>{t.nav_contexts_res}</span>
          </NavLink>

          <p className="nav-group">{t.nav_group_final}</p>
          <NavLink to="/summary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            <span>{t.nav_summary}</span>
          </NavLink>

          <div className="sidebar-bottom">
            <ThemeToggle />
            <LangSelector />
          </div>
        </nav>

        <section className="content">
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/assistants" element={<WorkspacePage />} />
            <Route path="/repositories" element={<RepositoriesPage />} />
            <Route path="/workspace" element={<WorkspacePage />} />
            <Route path="/summary" element={<SummaryPage />} />
            <Route path="/templates" element={<TemplatesPage />} />
            <Route path="/rules"    element={<MarketplacePage type="rules"    title=<span>{t.nav_rules}</span>        subtitle={t.overview_rules_desc} />} />
            <Route path="/agents"   element={<MarketplacePage type="agents"   title=<span>{t.nav_agents}</span>       subtitle={t.overview_agents_desc} />} />
            <Route path="/skills"   element={<MarketplacePage type="skills"   title=<span>{t.nav_skills}</span>       subtitle={t.overview_skills_desc} />} />
            <Route path="/prompts"  element={<MarketplacePage type="prompts"  title=<span>{t.nav_prompts}</span>      subtitle={t.overview_prompts_desc} />} />
            <Route path="/mcps"     element={<MarketplacePage type="mcps"     title=<span>{t.nav_mcps}</span>         subtitle={t.overview_mcps_desc} />} />
            <Route path="/contexts" element={<MarketplacePage type="contexts" title=<span>{t.nav_contexts_res}</span> subtitle={t.overview_aicontext_desc} />} />
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
