'use client'

import { useLang } from '@/i18n/LangContext'

export default function RepositoriesPage() {
  const { t } = useLang()
  return (
    <div className="page">
      <h2>{t.nav_repositories}</h2>
      <p className="page-subtitle">{t.overview_repositories_desc}</p>
      <div className="marketplace-empty"><p>{t.coming_soon}</p></div>
    </div>
  )
}
