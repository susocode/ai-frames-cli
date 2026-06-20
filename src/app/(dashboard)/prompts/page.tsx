'use client'

import { useLang } from '@/i18n/LangContext'
import MarketplacePage from '@/components/MarketplacePage'

export default function PromptsPage() {
  const { t } = useLang()
  return <MarketplacePage type="prompts" title={t.nav_prompts} subtitle={t.overview_prompts_desc} />
}
