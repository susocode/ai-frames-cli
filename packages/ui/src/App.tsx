import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import SetupWizard from './pages/SetupWizard'
import MainLayout from './pages/MainLayout'
import LangSelector from './components/LangSelector'
import ThemeToggle from './components/ThemeToggle'
import { useLang } from './i18n/LangContext'

interface BootState {
  loading: boolean
  setup_required: boolean
  error: boolean
}

export default function App() {
  const { t } = useLang()
  const navigate = useNavigate()
  const location = useLocation()
  const [state, setState] = useState<BootState>({ loading: true, setup_required: false, error: false })

  useEffect(() => {
    fetch('/api/contexts')
      .then(r => {
        if (!r.ok) {
          setState({ loading: false, setup_required: false, error: true })
          return null
        }
        return r.json()
      })
      .then(data => {
        if (!data) return
        setState({ loading: false, setup_required: data.setup_required, error: false })
      })
      .catch(() => setState({ loading: false, setup_required: false, error: true }))
  }, [])

  function handleSetupComplete() {
    setState({ loading: false, setup_required: false })
    navigate('/', { replace: true })
  }

  if (state.loading) {
    return <div className="loading">{t.loading}</div>
  }

  if (state.error) {
    return (
      <div className="loading" style={{ flexDirection: 'column', gap: 12 }}>
        <span style={{ color: 'var(--danger)' }}>✕ {t['err:unknown-error']}</span>
        <button className="btn-primary" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <>
      {(state.setup_required || location.pathname === '/setup') && (
        <div className="lang-fixed">
          <ThemeToggle />
          <LangSelector />
        </div>
      )}
      <Routes>
        <Route
          path="/setup"
          element={
            <SetupWizard
              onComplete={handleSetupComplete}
              canGoBack={!state.setup_required}
            />
          }
        />
        <Route
          path="/*"
          element={state.setup_required ? <Navigate to="/setup" replace /> : <MainLayout />}
        />
      </Routes>
    </>
  )
}
