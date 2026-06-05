import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Home, User, CheckCircle2, MapPin } from 'lucide-react'
import { LAYERS } from '../data/layers.js'
import { loadSharedClientProject, formatProjectBudget, formatProjectLocation, getProjectLayerLabel, getProjectProfileItems } from '../lib/projects.js'

export default function SharedProject() {
  const { shareId } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    loadSharedClientProject(shareId)
      .then(res => {
        if (!active) return
        if (!res) setError('Проектът не е намерен или не е споделен.')
        else setData(res)
      })
      .catch(err => {
        if (!active) return
        setError('Възникна грешка при зареждането на проекта.')
      })
    return () => { active = false }
  }, [shareId])

  if (error) {
    return (
      <section className="section flex min-h-[60vh] items-center justify-center bg-soft">
        <div className="container-page max-w-lg text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
            <User size={32} />
          </div>
          <h1 className="font-display text-2xl text-ink">Недостъпен проект</h1>
          <p className="text-muted">{error}</p>
          <div className="pt-4">
            <Link to="/" className="btn btn-primary">Към началото</Link>
          </div>
        </div>
      </section>
    )
  }

  if (!data) {
    return (
      <section className="section flex min-h-[60vh] items-center justify-center bg-soft">
        <div className="text-muted text-sm">Зареждане...</div>
      </section>
    )
  }

  const { project, account, media } = data
  const activeLayer = LAYERS.find(layer => layer.slug === project?.currentLayerSlug) || LAYERS[0]
  const projectProfileItems = getProjectProfileItems(project, LAYERS)

  return (
    <section className="section bg-soft min-h-screen">
      <div className="container-page space-y-5">
        
        {/* Header / Account info */}
        <div className="rounded-3xl border border-line bg-paper p-5 md:p-8">
          <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
            {account.avatar_url ? (
              <img src={account.avatar_url} alt={account.display_name} className="h-24 w-24 rounded-full object-cover ring-4 ring-soft" />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-accent text-paper ring-4 ring-soft">
                <User size={40} />
              </div>
            )}
            <div>
              <h1 className="font-display text-3xl text-ink">
                {account.display_name || account.full_name || 'Клиент'}
              </h1>
              {account.city && (
                <div className="mt-2 flex items-center justify-center md:justify-start gap-1.5 text-sm text-muted">
                  <MapPin size={16} />
                  {account.city}
                </div>
              )}
            </div>
            <div className="ml-auto mt-4 md:mt-0 self-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-soft px-3 py-1.5 text-xs font-medium text-ink">
                <CheckCircle2 size={14} className="text-accent" />
                Споделен проект
              </span>
            </div>
          </div>
          {account.bio && (
            <p className="mt-6 max-w-3xl text-sm text-ink leading-relaxed">{account.bio}</p>
          )}
          {(account.interests?.length > 0 || account.style_preferences?.length > 0) && (
            <div className="mt-6 border-t border-line pt-6 flex flex-wrap gap-2">
              {[...(account.interests || []), ...(account.style_preferences || [])].map((pref, i) => (
                <span key={i} className="inline-flex rounded-full border border-line bg-soft px-3 py-1 text-xs text-muted">
                  {pref}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Project info */}
        <div className="grid gap-5 lg:grid-cols-12">
          <div className="lg:col-span-8 space-y-5">
            <div className="rounded-2xl border border-line bg-paper p-5 md:p-8">
              <div className="eyebrow flex items-center gap-2">
                <Home size={18} className="text-accent" />
                Проект
              </div>
              <h2 className="mt-3 font-display text-3xl text-ink">{project.title || 'Проект'}</h2>
              <p className="mt-3 max-w-2xl text-sm text-ink leading-relaxed whitespace-pre-wrap">
                {project.ideaDescription || 'Няма въведено описание.'}
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-line bg-soft p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-muted">Слой</div>
                  <div className="mt-1 text-sm font-medium text-ink">{getProjectLayerLabel(project, LAYERS) || `Слой ${activeLayer.number}`}</div>
                </div>
                <div className="rounded-2xl border border-line bg-soft p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-muted">Локация</div>
                  <div className="mt-1 text-sm font-medium text-ink">{formatProjectLocation(project) || 'Не е посочена'}</div>
                </div>
                <div className="rounded-2xl border border-line bg-soft p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-muted">Бюджет</div>
                  <div className="mt-1 text-sm font-medium text-ink">{!project.budgetMin && !project.budgetMax ? 'Не е посочен' : formatProjectBudget(project)}</div>
                </div>
              </div>

              {projectProfileItems.length > 0 && (
                <div className="mt-6 rounded-2xl border border-line bg-soft p-5">
                  <div className="text-xs uppercase tracking-[0.14em] text-muted mb-3">Проектни данни</div>
                  <div className="flex flex-wrap gap-2">
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

            {/* Media */}
            {media.length > 0 && (
              <div className="rounded-2xl border border-line bg-paper p-5 md:p-8">
                <div className="eyebrow mb-6">Снимки и планове ({media.length})</div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {media.map((item) => (
                    <div key={item.id} className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-line bg-soft">
                      <img
                        src={item.url}
                        alt={item.caption || 'Снимка към проекта'}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      {item.caption && (
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 p-4">
                          <p className="text-sm font-medium text-white">{item.caption}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar CTA */}
          <aside className="lg:col-span-4 space-y-5">
            <div className="sticky top-24 rounded-2xl border border-line bg-paper p-6 text-center">
              <h3 className="font-display text-xl text-ink">Totsan</h3>
              <p className="mt-2 text-sm text-muted">Този проект е споделен през платформата на Totsan.</p>
              <div className="mt-6 flex flex-col gap-3">
                <Link to="/login" className="btn btn-primary w-full justify-center">Вход или Регистрация</Link>
                <Link to="/" className="btn btn-ghost w-full justify-center">Научи повече</Link>
              </div>
            </div>
          </aside>
        </div>

      </div>
    </section>
  )
}
