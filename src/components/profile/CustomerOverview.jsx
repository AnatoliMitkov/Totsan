import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ArrowRight, Camera, Home, MessageCircle, Sparkles } from 'lucide-react'
import CompletenessBar from './CompletenessBar.jsx'
import { LAYERS } from '../../data/layers.js'
import { loadConversations } from '../../lib/chat.js'

export default function CustomerOverview({ account, project, media, completeness, isAdmin, onSelectTab }) {
  const activeLayer = LAYERS.find(layer => layer.slug === project?.currentLayerSlug) || LAYERS[0]
  const nextChecks = completeness?.nextChecks || []
  const [conversationCount, setConversationCount] = useState(null)

  useEffect(() => {
    if (!account?.id) return undefined
    let active = true
    loadConversations()
      .then((rows) => { if (active) setConversationCount(rows.filter(row => row.status === 'open').length) })
      .catch(() => { if (active) setConversationCount(null) })
    return () => { active = false }
  }, [account?.id])

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <div className="lg:col-span-8 space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          <button type="button" onClick={() => onSelectTab('project')} className="rounded-2xl border border-line bg-paper p-5 text-left transition hover:border-ink/40">
            <Home size={22} className="text-accentDeep" />
            <div className="mt-4 font-display text-2xl text-ink">Моят проект</div>
            <p className="mt-2 text-sm text-muted">Добави помещение, бюджет и идея.</p>
          </button>
          <button type="button" onClick={() => onSelectTab('project')} className="rounded-2xl border border-line bg-paper p-5 text-left transition hover:border-ink/40">
            <Camera size={22} className="text-accentDeep" />
            <div className="mt-4 font-display text-2xl text-ink">Снимки</div>
            <p className="mt-2 text-sm text-muted">Качени: {media.length}. Цел: поне 3.</p>
          </button>
          <Link to="/katalog" className="rounded-2xl border border-line bg-paper p-5 transition hover:border-ink/40">
            <Sparkles size={22} className="text-accentDeep" />
            <div className="mt-4 font-display text-2xl text-ink">Специалисти</div>
            <p className="mt-2 text-sm text-muted">Виж хора от Слой {activeLayer.number}.</p>
          </Link>
          <Link to="/inbox" className="rounded-2xl border border-line bg-paper p-5 transition hover:border-ink/40 md:col-span-3">
            <MessageCircle size={22} className="text-accentDeep" />
            <div className="mt-4 font-display text-2xl text-ink">Активни разговори</div>
            <p className="mt-2 text-sm text-muted">{conversationCount === null ? 'Отвори съобщенията си.' : `Отворени разговори: ${conversationCount}.`}</p>
          </Link>
        </div>

        <div className="rounded-2xl border border-line bg-paper p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="eyebrow">Активен проект</div>
              <h2 className="mt-2 font-display text-3xl text-ink">{project?.title || 'Още няма заглавие'}</h2>
              <p className="mt-2 max-w-2xl text-sm text-muted">
                {project?.ideaDescription || 'Когато опишеш какво искаш да направиш, партньорите ще могат да върнат по-точна оферта.'}
              </p>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => onSelectTab('project')}>
              Отвори проекта
              <ArrowRight size={18} />
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <InfoTile label="Слой" value={`Слой ${activeLayer.number} · ${activeLayer.title}`} />
            <InfoTile label="Локация" value={[project?.addressCity, project?.addressRegion].filter(Boolean).join(', ') || 'Не е посочена'} />
            <InfoTile label="Бюджет" value={formatBudget(project)} />
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-paper p-5 md:p-6">
          <div className="eyebrow">Активност</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <InfoTile label="Регистрация" value={account?.created_at ? new Date(account.created_at).toLocaleDateString('bg-BG') : 'Скоро'} />
            <InfoTile label="Запитвания" value="Скоро" />
            <InfoTile label="Активни разговори" value={conversationCount === null ? 'Съобщения' : conversationCount} />
          </div>
        </div>
      </div>

      <aside className="lg:col-span-4 space-y-5">
        <CompletenessBar completeness={completeness} />
        <div className="rounded-2xl border border-line bg-paper p-5">
          <div className="eyebrow">Следващи стъпки</div>
          <div className="mt-4 grid gap-3">
            {nextChecks.length > 0 ? nextChecks.map(check => (
              <button key={check.key} type="button" onClick={() => onSelectTab(check.key.includes('project') || ['area', 'budget', 'idea', 'layer', 'media', 'quiz', 'address', 'property-type'].includes(check.key) ? 'project' : 'personal')} className="flex items-center justify-between rounded-2xl border border-line bg-soft px-4 py-3 text-left text-sm transition hover:border-ink/40">
                <span>{check.label}</span>
                <span className="text-muted">+{check.weight}%</span>
              </button>
            )) : (
              <p className="text-sm text-muted">Профилът е в отлична форма.</p>
            )}
          </div>
          {isAdmin && <Link to="/admin" className="btn btn-ghost mt-5 w-full justify-center">Админ панел</Link>}
        </div>
      </aside>
    </div>
  )
}

function InfoTile({ label, value }) {
  return (
    <div className="rounded-2xl border border-line bg-soft p-4">
      <div className="text-xs uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="mt-1 text-sm font-medium text-ink">{value}</div>
    </div>
  )
}

function formatBudget(project) {
  if (!project?.budgetMin && !project?.budgetMax) return 'Не е посочен'
  const currency = project.budgetCurrency || 'EUR'
  if (project.budgetMin && project.budgetMax) return `${project.budgetMin} - ${project.budgetMax} ${currency}`
  if (project.budgetMin) return `от ${project.budgetMin} ${currency}`
  return `до ${project.budgetMax} ${currency}`
}