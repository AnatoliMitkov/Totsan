import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CheckCircle2, Home, MapPin, User } from 'lucide-react'
import PublicProfileAvatar from '../components/profile/PublicProfileAvatar.jsx'
import PublicProfileBanner from '../components/profile/PublicProfileBanner.jsx'
import PublicProfilePanel from '../components/profile/PublicProfilePanel.jsx'
import { LAYERS } from '../data/layers.js'
import {
  formatProjectBudget,
  formatProjectLocation,
  getProjectLayerLabel,
  getProjectProfileItems,
  loadSharedClientProject,
} from '../lib/projects.js'

export default function SharedProject() {
  const { shareId } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    loadSharedClientProject(shareId)
      .then((res) => {
        if (!active) return
        if (!res) setError('Проектът не е намерен или не е споделен.')
        else setData(res)
      })
      .catch(() => {
        if (!active) return
        setError('Възникна грешка при зареждането на проекта.')
      })
    return () => {
      active = false
    }
  }, [shareId])

  if (error) {
    return (
      <section className="section flex min-h-[60vh] items-center justify-center bg-soft">
        <div className="container-page max-w-lg space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
            <User size={32} />
          </div>
          <h1 className="font-display text-2xl text-ink">Недостъпен проект</h1>
          <p className="text-muted">{error}</p>
          <div className="pt-4">
            <Link to="/" className="btn btn-primary">
              Към началото
            </Link>
          </div>
        </div>
      </section>
    )
  }

  if (!data) {
    return (
      <section className="section flex min-h-[60vh] items-center justify-center bg-soft">
        <div className="text-sm text-muted">Зареждане...</div>
      </section>
    )
  }

  const { project, account, media } = data
  const activeLayer = LAYERS.find((layer) => layer.slug === project?.currentLayerSlug) || LAYERS[0]
  const projectProfileItems = getProjectProfileItems(project, LAYERS)
  const layerLabel = getProjectLayerLabel(project, LAYERS) || `Слой ${activeLayer.number}`
  const locationLabel = formatProjectLocation(project) || 'Не е посочена'
  const budgetLabel = !project.budgetMin && !project.budgetMax ? 'Не е посочен' : formatProjectBudget(project)
  const displayName = account.display_name || account.full_name || 'Клиент'

  return (
    <>
      <PublicProfileBanner heightClass="h-56 md:h-72" />

      <div className="relative z-10 flex flex-col bg-soft pb-16 md:pb-24">
        <div className="container-page w-full px-4 md:px-6 -mt-20 md:-mt-24">
          <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
            <aside className="lg:col-span-4">
              <div className="space-y-6 lg:sticky lg:top-24">
                <PublicProfilePanel className="transition-all duration-300 hover:shadow-[0_20px_40px_rgba(0,0,0,0.04)]">
                  <div className="flex flex-col items-center text-center">
                    <PublicProfileAvatar
                      src={account.avatar_url}
                      alt={displayName}
                      imageClassName="h-full w-full object-cover"
                      statusTitle="Споделен проект в Totsan"
                      fallbackIcon={User}
                    />

                    <div className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-accent/10 bg-accentSoft/60 px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-accentDeep">
                      Споделен проект
                    </div>

                    <h1 className="mt-4 break-words font-display text-3xl font-semibold tracking-tight text-ink">{displayName}</h1>
                    <p className="mt-2 max-w-[280px] text-sm font-medium leading-relaxed text-ink/75">
                      Публичен изглед на клиентски проект в Totsan
                    </p>

                    {account.city && (
                      <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-muted">
                        <MapPin size={14} className="text-accent" />
                        <span>{account.city}</span>
                      </div>
                    )}
                  </div>

                  {account.bio && (
                    <div className="mt-8 border-t border-line/60 pt-6">
                      <p className="text-sm leading-relaxed text-ink/80">{account.bio}</p>
                    </div>
                  )}

                  {(account.interests?.length > 0 || account.style_preferences?.length > 0) && (
                    <div className="mt-6 flex flex-wrap gap-2 border-t border-line/60 pt-6">
                      {[...(account.interests || []), ...(account.style_preferences || [])].map((pref, index) => (
                        <span
                          key={`${pref}-${index}`}
                          className="inline-flex rounded-full border border-line bg-soft px-3 py-1 text-xs text-muted"
                        >
                          {pref}
                        </span>
                      ))}
                    </div>
                  )}
                </PublicProfilePanel>

                <PublicProfilePanel className="text-center">
                  <div className="flex items-center justify-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accentSoft/60 text-accentDeep">
                      <CheckCircle2 size={18} />
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-muted">Публичен линк</div>
                      <div className="font-display text-lg font-semibold text-ink">Totsan</div>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-muted">
                    Този проект е споделен през платформата на Totsan.
                  </p>
                  <div className="mt-6 flex flex-col gap-3">
                    <Link to="/login" className="btn btn-primary w-full justify-center">
                      Вход или регистрация
                    </Link>
                    <Link to="/" className="btn btn-ghost w-full justify-center">
                      Научи повече
                    </Link>
                  </div>
                </PublicProfilePanel>
              </div>
            </aside>

            <div className="space-y-8 lg:col-span-8 lg:pt-6">
              <PublicProfilePanel>
                <div className="eyebrow mb-2">Проект</div>
                <h2 className="break-words font-display text-3xl font-semibold text-ink">{project.title || 'Проект'}</h2>
                <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-relaxed text-ink/80">
                  {project.ideaDescription || 'Няма въведено описание.'}
                </p>

                <div className="mt-8 grid gap-4 sm:grid-cols-3">
                  <InfoTile label="Слой" value={layerLabel} />
                  <InfoTile label="Локация" value={locationLabel} />
                  <InfoTile label="Бюджет" value={budgetLabel} />
                </div>

                {projectProfileItems.length > 0 && (
                  <div className="mt-6 rounded-2xl border border-line bg-soft/30 p-5 transition-all duration-300 hover:bg-soft/40">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Проектни данни</div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {projectProfileItems.map((item) => (
                        <span
                          key={item.key}
                          className="inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-paper px-3 py-1.5 text-sm text-ink"
                        >
                          <span className="text-muted">{item.label}:</span>
                          <span className="break-words font-medium">{item.value}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </PublicProfilePanel>

              {media.length > 0 && (
                <PublicProfilePanel>
                  <div className="eyebrow mb-2">Снимки и планове</div>
                  <h3 className="font-display text-3xl font-semibold text-ink">Материали по проекта</h3>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    {media.map((item) => (
                      <div
                        key={item.id}
                        className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-line bg-soft"
                      >
                        <img
                          src={item.url}
                          alt={item.caption || 'Снимка към проекта'}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                          loading="lazy"
                        />
                        {item.caption && (
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent p-4">
                            <p className="text-sm font-medium text-white">{item.caption}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </PublicProfilePanel>
              )}

              <PublicProfilePanel>
                <Link
                  to="/"
                  className="group inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted transition-colors duration-200 hover:text-ink"
                >
                  <span className="transition-transform duration-200 group-hover:-translate-x-1">←</span>
                  Обратно към началото
                </Link>
                <div className="mt-6 flex items-start gap-4 rounded-2xl border border-line/60 bg-accentSoft/30 p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-paper text-accentDeep shadow-sm">
                    <Home size={20} />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-accentDeep">
                      Споделяне през Totsan
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-ink/80">
                      Виждаш само информацията, която клиентът е избрал да направи публична за този проект.
                    </p>
                  </div>
                </div>
              </PublicProfilePanel>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function InfoTile({ label, value }) {
  return (
    <div className="rounded-2xl border border-line/40 bg-paper p-4 transition-all duration-300 hover:border-line hover:shadow-[0_8px_25px_rgba(0,0,0,0.02)]">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-1 text-sm font-semibold text-ink">{value}</div>
    </div>
  )
}
