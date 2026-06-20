'use client'

import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useLang } from '@/i18n/LangContext'
import { Translations } from '@/i18n'

const TOOLTIP_W = 280
const TOOLTIP_H = 120

export default function DirHint({ dirPath }: { dirPath: string }) {
  const { t } = useLang()
  const [style, setStyle] = useState<React.CSSProperties | null>(null)
  const iconRef = useRef<HTMLSpanElement>(null)

  const key = `dir_hint:${dirPath}` as keyof Translations
  const hint = t[key] as string | undefined
  if (!hint) return null

  function handleMouseEnter() {
    if (!iconRef.current) return
    const rect = iconRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    let left = rect.right + 8
    let top = rect.top + rect.height / 2
    if (left + TOOLTIP_W > vw - 8) left = rect.left - TOOLTIP_W - 8
    if (top - TOOLTIP_H / 2 < 8) top = TOOLTIP_H / 2 + 8
    if (top + TOOLTIP_H / 2 > vh - 8) top = vh - TOOLTIP_H / 2 - 8
    setStyle({ position: 'fixed', left, top, transform: 'translateY(-50%)', width: TOOLTIP_W, zIndex: 1000 })
  }

  return (
    <span className="dir-hint-wrap">
      <span ref={iconRef} className="dir-hint-icon" onMouseEnter={handleMouseEnter} onMouseLeave={() => setStyle(null)}>?</span>
      {style && createPortal(<span className="dir-hint-tooltip" style={style}>{hint}</span>, document.body)}
    </span>
  )
}
