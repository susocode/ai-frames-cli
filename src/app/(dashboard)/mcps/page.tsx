'use client'

import { useLang } from '@/i18n/LangContext'

export default function McpsPage() {
  const { t } = useLang()
  return (
    <div className="page">
      <h2>{t.nav_mcps}</h2>
      <p className="page-subtitle">{t.overview_mcps_desc}</p>
      <div className="marketplace-empty"><p>{t.coming_soon}</p></div>
    </div>
  )
}
