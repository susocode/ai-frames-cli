'use client'

import { useLang } from '@/i18n/LangContext'

export default function SummaryPage() {
  const { t } = useLang()
  return (
    <div className="page">
      <h2>{t.overview_summary_title}</h2>
      <p className="page-subtitle">{t.overview_summary_desc}</p>
      <div className="marketplace-empty"><p>{t.coming_soon}</p></div>
    </div>
  )
}
