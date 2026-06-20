'use client'

import { useLang } from '@/i18n/LangContext'
import MarketplacePage from '@/components/MarketplacePage'

export default function RulesPage() {
  const { t } = useLang()
  return <MarketplacePage type="rules" title={t.nav_rules} subtitle={t.overview_rules_desc} />
}
