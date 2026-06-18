import { useState, useRef, useEffect } from 'react'
import { useLang } from '../i18n/LangContext'
import { languages, Lang } from '../i18n'

export default function LangSelector() {
  const { lang, setLang } = useLang()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const current = languages.find(l => l.code === lang)

  return (
    <div className="lang-dropdown" ref={ref}>
      <button className="btn-primary lang-btn" onClick={() => setOpen(o => !o)}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M2 12h20"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
        {current?.label}
      </button>
      {open && (
        <ul className="lang-menu">
          {languages.map(l => (
            <li
              key={l.code}
              className={l.code === lang ? 'active' : ''}
              onClick={() => { setLang(l.code as Lang); setOpen(false) }}
            >
              {l.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
