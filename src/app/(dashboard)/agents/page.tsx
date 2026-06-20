'use client'

import { useLang } from '@/i18n/LangContext'
import MarketplacePage from '@/components/MarketplacePage'

export default function AgentsPage() {
  const { t } = useLang()
  return <MarketplacePage type="agents" title={t.nav_agents} subtitle={t.overview_agents_desc} />
}
