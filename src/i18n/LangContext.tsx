'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import { Lang, Translations, detectLang, getTranslations, saveLang } from './index'

interface LangContextValue {
  lang: Lang
  t: Translations
  setLang: (lang: Lang) => void
}

const LangContext = createContext<LangContextValue | null>(null)

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang)
  const [t, setT] = useState<Translations>(() => getTranslations(detectLang()))

  function setLang(next: Lang) {
    setLangState(next)
    setT(getTranslations(next))
    saveLang(next)
  }

  return (
    <LangContext.Provider value={{ lang, t, setLang }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLang must be used inside LangProvider')
  return ctx
}
