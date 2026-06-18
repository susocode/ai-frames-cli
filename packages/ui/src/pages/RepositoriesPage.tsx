import { useEffect, useState } from 'react'
import { useLang } from '../i18n/LangContext'

interface Repo {
  name: string
  source: string
  propagate_context: boolean
}

export default function RepositoriesPage() {
  const { t } = useLang()
  const [repos, setRepos] = useState<Repo[]>([])
  const [newName, setNewName] = useState('')
  const [newSource, setNewSource] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/resources')
      .then(r => r.json())
      .then(data => {
        if (data.manifest?.repos) setRepos(data.manifest.repos)
      })
  }, [])

  async function saveRepos(updated: Repo[]) {
    setSaving(true)
    const res = await fetch('/api/resources')
    const data = await res.json()
    const manifest = data.manifest ?? {}
    await fetch('/api/resources', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...manifest, repos: updated }),
    })
    setSaving(false)
  }

  function addRepo() {
    if (!newName.trim() || !newSource.trim()) return
    const updated = [...repos, { name: newName.trim(), source: newSource.trim(), propagate_context: true }]
    setRepos(updated)
    saveRepos(updated)
    setNewName('')
    setNewSource('')
  }

  function removeRepo(name: string) {
    const updated = repos.filter(r => r.name !== name)
    setRepos(updated)
    saveRepos(updated)
  }

  return (
    <div className="page">
      <h2>{t.repositories_title}</h2>
      <p className="page-subtitle">{t.repositories_subtitle}</p>

      <table className="repo-table">
        <thead>
          <tr>
            <th>{t.repositories_col_name}</th>
            <th>{t.repositories_col_source}</th>
            <th>{t.repositories_col_propagate}</th>
            <th>{t.repositories_col_actions}</th>
          </tr>
        </thead>
        <tbody>
          {repos.map(r => (
            <tr key={r.name}>
              <td>{r.name}</td>
              <td className="source">{r.source}</td>
              <td>{r.propagate_context ? 'Yes' : 'No'}</td>
              <td>
                <button className="btn-danger" onClick={() => removeRepo(r.name)}>
                  {t.repositories_remove}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="add-repo">
        <input
          placeholder={t.repositories_add_name}
          value={newName}
          onChange={e => setNewName(e.target.value)}
        />
        <input
          placeholder={t.repositories_add_source}
          value={newSource}
          onChange={e => setNewSource(e.target.value)}
        />
        <button className="btn-primary" onClick={addRepo} disabled={saving}>
          {t.repositories_add_button}
        </button>
      </div>
    </div>
  )
}
