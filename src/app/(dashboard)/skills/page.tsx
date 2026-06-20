'use client'

import { useLang } from '@/i18n/LangContext'
import MarketplacePage from '@/components/MarketplacePage'

export default function SkillsPage() {
  const { t } = useLang()
  return <MarketplacePage type="skills" title={t.nav_skills} subtitle={t.overview_skills_desc} />
}
