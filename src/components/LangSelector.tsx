'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useLang } from '@/i18n/LangContext'
import { languages, Lang } from '@/i18n'

export default function LangSelector() {
  const { lang, setLang } = useLang()
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
    const openDown = rect.top < window.innerHeight / 2
    setMenuStyle(openDown
      ? { position: 'fixed', top: rect.bottom + 6, right: window.innerWidth - rect.right, zIndex: 1000 }
      : { position: 'fixed', bottom: window.innerHeight - rect.top + 6, left: rect.left, zIndex: 1000 }
    )
    setOpen(o => !o)
  }

  const current = languages.find(l => l.code === lang)

  return (
    <div className="lang-dropdown" ref={wrapRef}>
      <button ref={btnRef} className="btn-theme-toggle lang-btn" onClick={handleOpen}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M2 12h20"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
        <span className="lang-btn-label">{current?.label}</span>
      </button>
      {open && createPortal(
        <ul className="lang-menu" style={menuStyle}>
          {languages.map(l => (
            <li key={l.code} className={l.code === lang ? 'active' : ''} onMouseDown={e => e.stopPropagation()}
              onClick={() => { setLang(l.code as Lang); setOpen(false) }}>
              {l.label}
            </li>
          ))}
        </ul>,
        document.body
      )}
    </div>
  )
}
