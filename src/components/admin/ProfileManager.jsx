import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, Link as LinkIcon, RefreshCcw, Search, ShieldCheck, SlidersHorizontal, UserRound } from 'lucide-react'
import { LAYERS } from '../../data/layers.js'
import { PROFILE_SELECT_COLUMNS, buildProfileDirectory, getProfileImage, getProfileImageStyle } from '../../lib/profiles.js'
import { supabase } from '../../lib/supabase.js'

const inputClassName = 'mt-2 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-sm outline-none transition focus:border-ink'
const selectClassName = 'rounded-2xl border border-line bg-paper px-4 py-3 text-sm outline-none transition focus:border-ink'

const FILTERS = [
  { value: 'all', label: 'Всички профили' },
  { value: 'published', label: 'Публични' },
  { value: 'hidden', label: 'Скрити' },
  { value: 'linked', label: 'Свързани с акаунт' },
  { value: 'unlinked', label: 'Без акаунт' },
]

export default function ProfileManager() {
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [selectedSlug, setSelectedSlug] = useState('')
  const [draft, setDraft] = useState(createGovernanceDraft())
  const [saveState, setSaveState] = useState({ status: 'idle', message: '' })

  const profiles = useMemo(() => buildProfileDirectory(rows, { includeUnpublished: true }), [rows])
  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.slug === selectedSlug) || profiles[0] || null,
    [profiles, selectedSlug],
  )

  const filteredProfiles = useMemo(() => {
    const needle = query.trim().toLowerCase()

    return profiles.filter((profile) => {
      const matchesQuery = !needle || [
        profile.name,
        profile.tag,
        profile.city,
        profile.layerTitle,
        profile.userId,
      ].filter(Boolean).join(' ').toLowerCase().includes(needle)

      const matchesFilter =
        filter === 'all' ||
        (filter === 'published' && profile.isPublished) ||
        (filter === 'hidden' && !profile.isPublished) ||
        (filter === 'linked' && profile.userId) ||
        (filter === 'unlinked' && !profile.userId)

      return matchesQuery && matchesFilter
    })
  }, [profiles, query, filter])

  const stats = useMemo(() => ({
    total: profiles.length,
    published: profiles.filter((profile) => profile.isPublished).length,
    hidden: profiles.filter((profile) => !profile.isPublished).length,
    unlinked: profiles.filter((profile) => !profile.userId).length,
  }), [profiles])

  useEffect(() => {
    loadProfiles()
  }, [])

  useEffect(() => {
    if (!profiles.length) {
      setDraft(createGovernanceDraft())
      return
    }

    const nextProfile = profiles.find((profile) => profile.slug === selectedSlug) || profiles[0]
    if (!selectedSlug || nextProfile.slug !== selectedSlug) setSelectedSlug(nextProfile.slug)
    setDraft(createGovernanceDraft(nextProfile))
  }, [profiles, selectedSlug])

  async function loadProfiles() {
    setStatus('loading')
    setError('')

    const { data, error: loadError } = await supabase
      .from('profiles')
      .select(PROFILE_SELECT_COLUMNS)
      .order('name')

    if (loadError) {
      setRows([])
      setError(loadError.message)
      setStatus('error')
      return
    }

    setRows(data || [])
    setStatus('ready')
  }

  function selectProfile(profile) {
    setSelectedSlug(profile.slug)
    setDraft(createGovernanceDraft(profile))
    setSaveState({ status: 'idle', message: '' })
  }

  function updateDraft(key, value) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  async function submit(e) {
    e.preventDefault()

    if (!selectedProfile?.id) {
      setSaveState({
        status: 'error',
        message: 'Този профил няма стабилно ID в базата. Не е безопасно да се обнови от admin екрана.',
      })
      return
    }

    setSaveState({ status: 'saving', message: 'Запазваме модерационните настройки...' })

    const payload = {
      is_published: Boolean(draft.isPublished),
      layer_slug: draft.layerSlug || selectedProfile.layerSlug,
      user_id: draft.userId.trim() || null,
    }

    const { data, error: saveError } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', selectedProfile.id)
      .select(PROFILE_SELECT_COLUMNS)
      .single()

    if (saveError) {
      setSaveState({ status: 'error', message: saveError.message })
      return
    }

    setRows((current) => current.map((row) => (row.id === data.id ? data : row)))
    setSelectedSlug(data.slug)
    setDraft(createGovernanceDraft(buildProfileDirectory([data], { includeUnpublished: true })[0]))
    setSaveState({ status: 'saved', message: 'Профилът е обновен безопасно.' })
  }

  return (
    <section className="mt-12">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="eyebrow">Профили</div>
          <h2 className="h-section mt-2">Публичност, категоризация и свързани акаунти.</h2>
          <p className="mt-3 max-w-3xl text-sm text-muted">
            Admin управлява дали профилът е видим, към кой слой принадлежи и кой акаунт го контролира.
            Bio, снимки, портфолио и творческо съдържание остават работа на партньора.
          </p>
        </div>
        <button type="button" className="btn btn-ghost self-start md:self-auto" onClick={loadProfiles}>
          <RefreshCcw size={16} />
          Обнови
        </button>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-4">
        <StatCard label="Всички" value={stats.total} />
        <StatCard label="Публични" value={stats.published} />
        <StatCard label="Скрити" value={stats.hidden} />
        <StatCard label="Без акаунт" value={stats.unlinked} />
      </div>

      <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
        <div className="flex items-start gap-3">
          <ShieldCheck size={18} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-medium">Безопасен режим на управление</div>
            <p className="mt-1 text-amber-900">
              Този екран вече не създава профили и не редактира снимки, рейтинг, описание или публично copy.
              Ако трябва cleanup/архивиране, първо е нужен ясен soft-archive модел в базата.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          Профилите не се заредиха: {error}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <aside className="lg:col-span-4 xl:col-span-3">
          <div className="rounded-3xl border border-line bg-paper p-4">
            <label className="relative block">
              <Search size={17} className="pointer-events-none absolute left-4 top-1/2 translate-y-0.5 text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Търси име, град, слой..."
                className={`${inputClassName} pl-11`}
              />
            </label>

            <div className="mt-3 flex items-center gap-2">
              <SlidersHorizontal size={16} className="text-muted" />
              <select value={filter} onChange={(e) => setFilter(e.target.value)} className={`${selectClassName} w-full`}>
                {FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="mt-4 max-h-[42rem] space-y-2 overflow-auto pr-1">
              {filteredProfiles.map((profile) => (
                <button
                  key={profile.slug}
                  type="button"
                  onClick={() => selectProfile(profile)}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${selectedProfile?.slug === profile.slug ? 'border-ink bg-soft' : 'border-line bg-paper hover:border-ink/40'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 overflow-hidden rounded-full border border-line bg-soft">
                      <img src={getProfileImage(profile)} alt={profile.name} className="img-cover" style={getProfileImageStyle(profile)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-display text-lg text-ink">{profile.name}</div>
                        <VisibilityBadge profile={profile} />
                      </div>
                      <div className="mt-1 text-xs text-muted">{profile.tag} · {profile.city}</div>
                      <div className="mt-1 text-xs text-muted">Слой {profile.layerNumber} · {profile.layerTitle}</div>
                      <div className="mt-2 text-[11px] text-muted">
                        {profile.userId ? 'Свързан акаунт' : 'Без свързан акаунт'}
                      </div>
                    </div>
                  </div>
                </button>
              ))}

              {status === 'loading' && (
                <div className="rounded-2xl border border-line bg-soft px-4 py-6 text-center text-sm text-muted">
                  Зареждаме профилите...
                </div>
              )}

              {status !== 'loading' && filteredProfiles.length === 0 && (
                <div className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
                  Няма профили по този филтър.
                </div>
              )}
            </div>
          </div>
        </aside>

        <div className="lg:col-span-8 xl:col-span-9">
          {selectedProfile ? (
            <form onSubmit={submit} className="rounded-3xl border border-line bg-paper p-6 md:p-8">
              <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
                <div className="space-y-6">
                  <ProfileSummary profile={selectedProfile} />

                  <div className="rounded-3xl border border-line bg-soft/50 p-5">
                    <div className="eyebrow">Admin контрол</div>
                    <div className="mt-5 grid gap-5 md:grid-cols-2">
                      <label className="rounded-2xl border border-line bg-paper p-4 text-sm text-ink">
                        <span className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={draft.isPublished}
                            onChange={(e) => updateDraft('isPublished', e.target.checked)}
                            className="mt-1 h-4 w-4 rounded border-line"
                          />
                          <span>
                            <span className="font-medium">Публичен профил</span>
                            <span className="mt-1 block text-muted">Изключи само при проблем, непълен профил или модерация.</span>
                          </span>
                        </span>
                      </label>

                      <Field label="Слой / категория">
                        <select value={draft.layerSlug} onChange={(e) => updateDraft('layerSlug', e.target.value)} className={inputClassName}>
                          {LAYERS.map((layer) => (
                            <option key={layer.slug} value={layer.slug}>Слой {layer.number} · {layer.title}</option>
                          ))}
                        </select>
                      </Field>
                    </div>

                    <Field label="Свързан акаунт (User ID)">
                      <input
                        value={draft.userId}
                        onChange={(e) => updateDraft('userId', e.target.value)}
                        className={inputClassName}
                        placeholder="uuid от auth.users, празно ако няма"
                      />
                      <div className="mt-2 text-xs text-muted">
                        Този акаунт редактира профила от “Моят профил”. Admin само свързва или маха връзката.
                      </div>
                    </Field>
                  </div>

                  <div className="rounded-3xl border border-line bg-paper p-5">
                    <div className="eyebrow">Съдържание само за преглед</div>
                    <p className="mt-3 text-sm text-muted">
                      Тези данни помагат за проверка, но не се редактират от admin екрана.
                    </p>
                    <dl className="mt-5 grid gap-4 md:grid-cols-2">
                      <ReadOnlyItem label="Роля" value={selectedProfile.tag} />
                      <ReadOnlyItem label="Град" value={selectedProfile.city} />
                      <ReadOnlyItem label="Проекти" value={selectedProfile.projects} />
                      <ReadOnlyItem label="Рейтинг" value={selectedProfile.rating} />
                    </dl>
                    {selectedProfile.bio && (
                      <div className="mt-5 rounded-2xl border border-line bg-soft/50 p-4">
                        <div className="text-xs uppercase tracking-[0.18em] text-muted">Bio</div>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-ink/80">{selectedProfile.bio}</p>
                      </div>
                    )}
                  </div>
                </div>

                <aside className="space-y-4">
                  <div className="rounded-3xl border border-line bg-soft/60 p-5">
                    <div className="eyebrow">Публична карта</div>
                    <div className="mt-4 card bg-paper p-5 shadow-none">
                      <div className="flex items-start gap-4">
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-line bg-soft">
                          <img src={getProfileImage(selectedProfile)} alt={selectedProfile.name} className="img-cover" style={getProfileImageStyle(selectedProfile)} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-soft px-2.5 py-1 text-xs text-ink">{selectedProfile.tag}</span>
                            <VisibilityBadge profile={selectedProfile} />
                          </div>
                          <div className="mt-3 font-display text-xl text-ink">{selectedProfile.name}</div>
                          <div className="mt-1 text-sm text-muted">{selectedProfile.city} · Слой {selectedProfile.layerNumber}</div>
                        </div>
                      </div>
                      <Link to={`/profil/${selectedProfile.slug}`} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full border border-line px-4 py-3 text-center font-medium transition hover:border-ink">
                        <LinkIcon size={16} />
                        Отвори профила
                      </Link>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-line bg-paper p-5">
                    <div className="eyebrow">Cleanup</div>
                    <p className="mt-3 text-sm text-muted">
                      Не е добавен delete бутон. В текущия модел не се вижда безопасно поле като archived_at/deleted_at,
                      затова cleanup трябва първо да мине през schema/helper решение.
                    </p>
                  </div>
                </aside>
              </div>

              <div className="mt-8 flex flex-col gap-4 border-t border-line pt-6 md:flex-row md:items-center md:justify-between">
                <div className={`text-sm ${saveState.status === 'error' ? 'text-red-700' : 'text-muted'}`}>
                  {saveState.message || 'Запазват се само видимост, слой и свързан акаунт.'}
                </div>
                <button type="submit" className="btn btn-primary self-start md:self-auto" disabled={saveState.status === 'saving'}>
                  {saveState.status === 'saving' ? 'Запазва се...' : 'Запази admin настройките'}
                </button>
              </div>
            </form>
          ) : (
            <div className="rounded-3xl border border-line bg-paper p-8 text-sm text-muted">
              Няма профили за управление.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function ProfileSummary({ profile }) {
  return (
    <div className="rounded-3xl border border-line bg-paper p-5">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border border-line bg-soft">
            <img src={getProfileImage(profile)} alt={profile.name} className="img-cover" style={getProfileImageStyle(profile)} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <VisibilityBadge profile={profile} />
              {profile.userId ? <StatusPill icon={<UserRound size={13} />} label="Свързан акаунт" /> : <StatusPill label="Без акаунт" />}
            </div>
            <h3 className="mt-3 font-display text-3xl text-ink">{profile.name}</h3>
            <p className="mt-1 text-sm text-muted">{profile.tag} · {profile.city}</p>
            <p className="mt-1 text-sm text-muted">Слой {profile.layerNumber} · {profile.layerTitle}</p>
          </div>
        </div>
        <Link to={`/profil/${profile.slug}`} className="btn btn-ghost self-start">
          Отвори
        </Link>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block text-sm font-medium text-ink">
      {label}
      {children}
    </label>
  )
}

function ReadOnlyItem({ label, value }) {
  return (
    <div className="rounded-2xl border border-line bg-soft/50 px-4 py-3">
      <dt className="text-xs uppercase tracking-[0.18em] text-muted">{label}</dt>
      <dd className="mt-1 text-sm text-ink">{value || 'Няма данни'}</dd>
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-3xl border border-line bg-paper p-5">
      <div className="font-display text-3xl text-ink">{value}</div>
      <div className="mt-1 text-xs text-muted">{label}</div>
    </div>
  )
}

function VisibilityBadge({ profile }) {
  return profile.isPublished ? (
    <StatusPill icon={<Eye size={13} />} label="Публичен" tone="green" />
  ) : (
    <StatusPill icon={<EyeOff size={13} />} label="Скрит" tone="amber" />
  )
}

function StatusPill({ icon = null, label, tone = 'neutral' }) {
  const className = tone === 'green'
    ? 'bg-green-100 text-green-800'
    : tone === 'amber'
      ? 'bg-amber-100 text-amber-900'
      : 'bg-soft text-muted'

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${className}`}>
      {icon}
      {label}
    </span>
  )
}

function createGovernanceDraft(profile = null) {
  return {
    layerSlug: profile?.layerSlug || profile?.layer || LAYERS[0]?.slug || '',
    isPublished: profile?.isPublished ?? true,
    userId: profile?.userId || '',
  }
}
