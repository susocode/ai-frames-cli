import { useNavigate } from 'react-router-dom'
import { useLang } from '../i18n/LangContext'

interface CardProps {
  title: string
  desc: string
  to: string
  comingSoon?: boolean
}

function Card({ title, desc, to, comingSoon }: CardProps) {
  const navigate = useNavigate()
  const { t } = useLang()
  return (
    <div className={`overview-card ${comingSoon ? 'overview-card-soon' : ''}`} onClick={() => navigate(to)}>
      <div className="overview-card-header">
        <h4>{title}</h4>
        {comingSoon && <span className="overview-badge-soon">{t.coming_soon}</span>}
      </div>
      <p>{desc}</p>
    </div>
  )
}

export default function OverviewPage() {
  const { t } = useLang()

  return (
    <div className="page overview-page">
      <h2>{t.overview_title}</h2>
      <p className="page-subtitle">{t.overview_subtitle}</p>

      <div className="overview-section">
        <p className="overview-section-label">{t.overview_section_config}</p>
        <div className="overview-grid">
          <Card title={t.overview_aicontext_title} desc={t.overview_aicontext_desc} to="/workspace" />
          <Card title={t.overview_repositories_title} desc={t.overview_repositories_desc} to="/repositories" />
        </div>
      </div>

      <div className="overview-section">
        <p className="overview-section-label">{t.overview_section_resources}</p>
        <div className="overview-grid">
          <Card title={t.overview_templates_title} desc={t.overview_templates_desc} to="/templates" comingSoon />
          <Card title={t.overview_agents_title} desc={t.overview_agents_desc} to="/agents" />
          <Card title={t.overview_skills_title} desc={t.overview_skills_desc} to="/skills" />
          <Card title={t.overview_rules_title} desc={t.overview_rules_desc} to="/rules" />
          <Card title={t.overview_prompts_title} desc={t.overview_prompts_desc} to="/prompts" />
          <Card title={t.overview_mcps_title} desc={t.overview_mcps_desc} to="/mcps" />
          <Card title={t.nav_contexts_res} desc={t.overview_aicontext_desc} to="/contexts" />
        </div>
      </div>

      <div className="overview-section">
        <p className="overview-section-label">{t.overview_section_deploy}</p>
        <div className="overview-grid">
          <Card title={t.overview_summary_title} desc={t.overview_summary_desc} to="/summary" />
        </div>
      </div>
    </div>
  )
}
