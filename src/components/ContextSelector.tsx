'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface Context { id: string; name: string; provider: string }

interface Props {
  contexts: Context[]
  active: Context | null
  onSwitch: (id: string) => void
  onSettings: () => void
  onSync: () => void
  onNew: () => void
  syncState: string
  syncTitle: string
}

export default function ContextSelector({ contexts, active, onSwitch, onSettings, onSync, onNew, syncState, syncTitle }: Props) {
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({})
  const btnRef = useRef<HTMLButtonElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function handleOpen() {
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    setMenuStyle({ position: 'fixed', top: rect.bottom + 4, left: rect.left, minWidth: rect.width, zIndex: 1000 })
    setOpen(o => !o)
  }

  return (
    <div className="ctx-selector" ref={wrapRef}>
      <button className="ctx-new-btn" onClick={onNew} title="New context">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
      <button ref={btnRef} className="ctx-btn" onClick={handleOpen}>
        <span className="ctx-provider-dot" data-provider={active?.provider ?? ''} />
        <span className="ctx-name">{active?.name ?? '—'}</span>
        <svg className="ctx-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {active && (
        <>
          <button className="ctx-icon-btn" onClick={onSettings} title="Context settings">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
          <button className={`ctx-icon-btn ${syncState === 'updated' ? 'ctx-synced' : ''}`} onClick={onSync}
            disabled={syncState === 'checking' || syncState === 'syncing'} title={syncTitle}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={syncState === 'checking' || syncState === 'syncing' ? 'spin' : ''}>
              <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
        </>
      )}
      {open && createPortal(
        <div className="ctx-dropdown" style={menuStyle}>
          <div className="ctx-dropdown-header">Contexts</div>
          {contexts.map(c => (
            <button key={c.id} className={`ctx-dropdown-item ${c.id === active?.id ? 'active' : ''}`}
              onMouseDown={e => e.stopPropagation()} onClick={() => { onSwitch(c.id); setOpen(false) }}>
              <span className="ctx-provider-dot" data-provider={c.provider} />
              <span>{c.name}</span>
              {c.id === active?.id && (
                <svg className="ctx-check" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              )}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}
