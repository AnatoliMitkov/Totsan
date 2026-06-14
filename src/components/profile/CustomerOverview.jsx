import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ArrowRight, Camera, ExternalLink, Home, MessageCircle, Sparkles, Share2, Link as LinkIcon, CheckCircle2 } from 'lucide-react'
import CompletenessBar from './CompletenessBar.jsx'
import { LAYERS } from '../../data/layers.js'
import { loadConversations } from '../../lib/chat.js'
import { formatProjectBudget, formatProjectLocation, getProjectLayerLabel, getProjectProfileItems } from '../../lib/projects.js'

export default function CustomerOverview({ account, project, media, completeness, isAdmin, onSelectTab, onToggleShare }) {
  const activeLayer = LAYERS.find(layer => layer.slug === project?.currentLayerSlug) || LAYERS[0]
  const projectProfileItems = getProjectProfileItems(project, LAYERS)
  const nextChecks = completeness?.nextChecks || []
  const [conversationCount, setConversationCount] = useState(null)
  const [copied, setCopied] = useState(false)
  const shareUrl = project?.publicShareId ? `${window.location.origin}/proekt/${project.publicShareId}` : ''

  async function copyShareLink() {
    if (!shareUrl) return

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl)
      } else {
        const input = document.createElement('textarea')
        input.value = shareUrl
        input.setAttribute('readonly', '')
        input.style.position = 'fixed'
        input.style.opacity = '0'
        document.body.appendChild(input)
        input.select()
        document.execCommand('copy')
        document.body.removeChild(input)
      }

      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Project share link copy failed:', error)
      window.prompt('Копирай линка към проекта:', shareUrl)
    }
  }

  async function handleToggleShare() {
    if (onToggleShare) {
      await onToggleShare(!project?.isShareable)
    }
  }

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
          <button type="button" onClick={() => onSelectTab('project')} className="rounded-3xl border border-line bg-paper p-5 text-left shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition hover:-translate-y-0.5 hover:border-ink/40 hover:shadow-[0_12px_30px_rgba(13,35,64,0.06)]">
            <Home size={22} className="text-accentDeep" />
            <div className="mt-4 font-display text-2xl text-ink">Моят проект</div>
            <p className="mt-2 text-sm text-muted">Добави помещение, бюджет и идея.</p>
          </button>
          <button type="button" onClick={() => onSelectTab('project')} className="rounded-3xl border border-line bg-paper p-5 text-left shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition hover:-translate-y-0.5 hover:border-ink/40 hover:shadow-[0_12px_30px_rgba(13,35,64,0.06)]">
            <Camera size={22} className="text-accentDeep" />
            <div className="mt-4 font-display text-2xl text-ink">Снимки</div>
            <p className="mt-2 text-sm text-muted">Качени: {media.length}. Цел: поне 3.</p>
          </button>
          <Link to="/katalog" className="rounded-3xl border border-line bg-paper p-5 shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition hover:-translate-y-0.5 hover:border-ink/40 hover:shadow-[0_12px_30px_rgba(13,35,64,0.06)]">
            <Sparkles size={22} className="text-accentDeep" />
            <div className="mt-4 font-display text-2xl text-ink">Специалисти</div>
            <p className="mt-2 text-sm text-muted">Виж хора от Слой {activeLayer.number}.</p>
          </Link>
          <Link to="/inbox" className="rounded-3xl border border-line bg-paper p-5 shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition hover:-translate-y-0.5 hover:border-ink/40 hover:shadow-[0_12px_30px_rgba(13,35,64,0.06)] md:col-span-3">
            <MessageCircle size={22} className="text-accentDeep" />
            <div className="mt-4 font-display text-2xl text-ink">Активни разговори</div>
            <p className="mt-2 text-sm text-muted">{conversationCount === null ? 'Отвори съобщенията си.' : `Отворени разговори: ${conversationCount}.`}</p>
          </Link>
        </div>

        <div className="rounded-3xl border border-line bg-paper p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)] md:p-8">
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
            <InfoTile label="Слой" value={getProjectLayerLabel(project, LAYERS) || `Слой ${activeLayer.number} · ${activeLayer.title}`} />
            <InfoTile label="Локация" value={formatProjectLocation(project) || 'Не е посочена'} />
            <InfoTile label="Бюджет" value={formatBudget(project)} />
          </div>
          {projectProfileItems.length > 0 && (
            <div className="mt-5 rounded-2xl border border-line bg-soft p-4">
              <div className="text-xs uppercase tracking-[0.14em] text-muted">Проектен профил</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {projectProfileItems.map((item) => (
                  <span key={item.key} className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1.5 text-sm text-ink">
                    <span className="text-muted">{item.label}:</span>
                    <span className="font-medium">{item.value}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-line bg-paper p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)] md:p-8">
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
        <div className="rounded-3xl border border-line bg-paper p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)] md:p-8">
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

        <div className="rounded-3xl border border-line bg-paper p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)] md:p-8">
          <div className="flex items-center gap-2">
            <Share2 size={18} className="text-accent" />
            <div className="eyebrow">Сподели проекта</div>
          </div>
          <p className="mt-3 text-sm text-muted">Създай публичен линк към проекта, за да го изпратиш на приятели или специалисти.</p>
          <div className="mt-4 space-y-3">
            <button type="button" onClick={handleToggleShare} className="btn w-full justify-center bg-soft text-ink border-line hover:border-ink">
              {project?.isShareable ? 'Изключи споделянето' : 'Включи споделянето'}
            </button>
            {project?.isShareable && project?.publicShareId && (
              <>
                <button type="button" onClick={copyShareLink} className="btn btn-primary w-full justify-center">
                  {copied ? <CheckCircle2 size={18} /> : <LinkIcon size={18} />}
                  {copied ? 'Копирано!' : 'Копирай линка'}
                </button>
                <Link to={`/proekt/${project.publicShareId}`} target="_blank" rel="noopener noreferrer" className="btn w-full justify-center border border-line bg-paper text-ink hover:border-ink">
                  <ExternalLink size={18} />
                  Виж как те виждат специалистите
                </Link>
              </>
            )}
          </div>
        </div>
      </aside>
    </div>
  )
}

function InfoTile({ label, value }) {
  return (
    <div className="rounded-2xl border border-line/40 bg-soft/60 p-4">
      <div className="text-xs uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="mt-1 text-sm font-medium text-ink">{value}</div>
    </div>
  )
}

function formatBudget(project) {
  if (!project?.budgetMin && !project?.budgetMax) return 'Не е посочен'
  return formatProjectBudget(project)
}
