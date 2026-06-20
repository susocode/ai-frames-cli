'use client'

import { useLang } from '@/i18n/LangContext'

export default function ContextsPage() {
  const { t } = useLang()
  return (
    <div className="page">
      <h2>{t.nav_contexts_res}</h2>
      <p className="page-subtitle">{t.overview_aicontext_desc}</p>
      <div className="marketplace-empty"><p>{t.coming_soon}</p></div>
    </div>
  )
}
