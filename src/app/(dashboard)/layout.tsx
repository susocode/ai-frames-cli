'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLang } from '@/i18n/LangContext'
import LangSelector from '@/components/LangSelector'
import ThemeToggle from '@/components/ThemeToggle'
import ContextSettingsModal from '@/components/ContextSettingsModal'
import ContextSelector from '@/components/ContextSelector'
import SidebarLink from '@/components/SidebarLink'

interface Context {
  id: string; name: string; provider: 'github' | 'gitlab' | 'bitbucket'; workspace: string; resources_repo: string
  auth: { type: string; token?: string; key_path?: string }
}

interface ContextsResponse { active: Context; contexts: Context[] }

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { t } = useLang()
  const router = useRouter()
  const [data, setData] = useState<ContextsResponse | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [syncState, setSyncState] = useState<'idle' | 'checking' | 'syncing' | 'up_to_date' | 'updated'>('idle')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('ai-frames_sidebar') === 'collapsed' : false
  )

  useEffect(() => {
    document.body.style.setProperty('--sidebar-w', sidebarCollapsed ? '52px' : '200px')
  }, [sidebarCollapsed])

  useEffect(() => {
    fetch('/api/contexts').then(r => r.json()).then(setData)
  }, [])

  async function switchContext(id: string) {
    await fetch('/api/contexts/active', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    window.location.reload()
  }

  async function sync() {
    setSyncState('checking')
    const status = await fetch('/api/repo-sync/status').then(r => r.json())
    setSyncState('syncing')
    const endpoint = status.needs_clone ? '/api/repo-sync/clone' : '/api/repo-sync/pull'
    await fetch(endpoint, { method: 'POST' })
    window.dispatchEvent(new CustomEvent('aiframes:synced'))
    setSyncState(status.up_to_date ? 'up_to_date' : 'updated')
    setTimeout(() => setSyncState('idle'), 2500)
  }

  function handleContextSaved(updated: Context) {
    setData(prev => {
      if (!prev) return prev
      return { active: prev.active.id === updated.id ? updated : prev.active, contexts: prev.contexts.map(c => c.id === updated.id ? updated : c) }
    })
  }

  return (
    <div className="layout">
      <header className="topbar">
        <div className="topbar-logo">
          <svg width="20" height="20" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
            <rect width="32" height="32" rx="7" fill="#1a1a1a"/>
            <path d="M5 12 L5 5 L12 5" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M20 5 L27 5 L27 12" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M5 20 L5 27 L12 27" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M20 27 L27 27 L27 20" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="16" cy="16" r="2" fill="#3b82f6"/>
            <line x1="16" y1="11" x2="16" y2="13" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="16" y1="19" x2="16" y2="21" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="11" y1="16" x2="13" y2="16" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/>
            <line x1="19" y1="16" x2="21" y2="16" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span className="logo">AI-FRAMES</span>
        </div>
        <div className="topbar-collapse">
          <button className="btn-sidebar-toggle" onClick={() => setSidebarCollapsed(v => {
            const next = !v
            localStorage.setItem('ai-frames_sidebar', next ? 'collapsed' : 'expanded')
            return next
          })} title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {sidebarCollapsed
                ? <><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></>
                : <><rect x="3" y="3" width="6" height="18" rx="1"/><line x1="13" y1="8" x2="21" y2="8"/><line x1="13" y1="12" x2="21" y2="12"/><line x1="13" y1="16" x2="21" y2="16"/></>}
            </svg>
          </button>
          <div className="topbar-divider" />
        </div>
        <div className="topbar-center">
          <ContextSelector
            contexts={data?.contexts ?? []} active={data?.active ?? null}
            onSwitch={switchContext} onSettings={() => setSettingsOpen(true)}
            onSync={sync} onNew={() => router.push('/setup')}
            syncState={syncState}
            syncTitle={syncState === 'checking' ? t.sync_checking : syncState === 'syncing' ? t.sync_syncing : syncState === 'up_to_date' ? t.sync_up_to_date : syncState === 'updated' ? t.sync_updated : t.sync_button}
          />
        </div>
        <div className="topbar-right" />
      </header>

      <div className="main">
        <nav className={`sidebar ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          <SidebarLink to="/overview" end label={t.nav_overview} collapsed={sidebarCollapsed}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            <span>{t.nav_overview}</span>
          </SidebarLink>

          <p className="nav-group">{t.nav_group_config}</p>
          <SidebarLink to="/workspace" label={t.nav_workspace} collapsed={sidebarCollapsed}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <span>{t.nav_workspace}</span>
          </SidebarLink>
          <SidebarLink to="/repositories" label={t.nav_repositories} collapsed={sidebarCollapsed} soon>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            <span>{t.nav_repositories}</span>
          </SidebarLink>

          <p className="nav-group">{t.nav_resources}</p>
          <SidebarLink to="/templates" label={t.nav_templates} collapsed={sidebarCollapsed}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
            <span>{t.nav_templates}</span>
          </SidebarLink>
          <SidebarLink to="/agents" label={t.nav_agents} collapsed={sidebarCollapsed}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>
            <span>{t.nav_agents}</span>
          </SidebarLink>
          <SidebarLink to="/skills" label={t.nav_skills} collapsed={sidebarCollapsed}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            <span>{t.nav_skills}</span>
          </SidebarLink>
          <SidebarLink to="/rules" label={t.nav_rules} collapsed={sidebarCollapsed}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            <span>{t.nav_rules}</span>
          </SidebarLink>
          <SidebarLink to="/prompts" label={t.nav_prompts} collapsed={sidebarCollapsed}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span>{t.nav_prompts}</span>
          </SidebarLink>
          <SidebarLink to="/mcps" label={t.nav_mcps} collapsed={sidebarCollapsed} soon>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            <span>{t.nav_mcps}</span>
          </SidebarLink>
          <SidebarLink to="/contexts" label={t.nav_contexts_res} collapsed={sidebarCollapsed} soon>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            <span>{t.nav_contexts_res}</span>
          </SidebarLink>

          <p className="nav-group">{t.nav_group_final}</p>
          <SidebarLink to="/summary" label={t.nav_summary} collapsed={sidebarCollapsed} soon>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            <span>{t.nav_summary}</span>
          </SidebarLink>

          <div className="sidebar-bottom">
            <ThemeToggle />
            <LangSelector />
          </div>
        </nav>

        <section className="content">
          {children}
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
