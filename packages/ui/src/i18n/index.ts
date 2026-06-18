import en from './en'
import es from './es'
import pl from './pl'

export type Lang = 'en' | 'es' | 'pl'
export type Translations = typeof en

export const languages: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'pl', label: 'Polski' },
]

const translations: Record<Lang, Translations> = { en, es, pl }

export function getTranslations(lang: Lang): Translations {
  return translations[lang] ?? translations.en
}

export function detectLang(): Lang {
  const saved = localStorage.getItem('ai-frames_lang') as Lang | null
  if (saved && saved in translations) return saved
  const browser = navigator.language.slice(0, 2) as Lang
  return browser in translations ? browser : 'en'
}

export function saveLang(lang: Lang) {
  localStorage.setItem('ai-frames_lang', lang)
}

export function errorMessage(t: Translations, code: string): string {
  const key = `err:${code}` as keyof Translations
  return (t[key] as string) ?? (t['err:unknown-error'] as string)
}
