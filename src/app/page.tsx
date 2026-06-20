'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLang } from '@/i18n/LangContext'
import ThemeToggle from '@/components/ThemeToggle'
import LangSelector from '@/components/LangSelector'

export default function BootPage() {
  const { t } = useLang()
  const router = useRouter()
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/api/contexts')
      .then(r => {
        if (!r.ok) { setError(true); return null }
        return r.json()
      })
      .then(data => {
        if (!data) return
        if (data.setup_required) {
          router.replace('/setup')
        } else {
          router.replace('/overview')
        }
      })
      .catch(() => setError(true))
  }, [router])

  if (error) {
    return (
      <div className="loading" style={{ flexDirection: 'column', gap: 12 }}>
        <span style={{ color: 'var(--danger)' }}>✕ {t['err:unknown-error']}</span>
        <button className="btn-primary" onClick={() => window.location.reload()}>Retry</button>
      </div>
    )
  }

  return <div className="loading">{t.loading}</div>
}
