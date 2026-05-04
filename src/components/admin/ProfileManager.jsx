import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { LAYERS } from '../../data/layers.js'
import { supabase } from '../../lib/supabase.js'
import { resolveProfileUploadTarget, uploadProfileMedia } from '../../lib/profile-media-upload-client.js'
import {
  PROFILE_SELECT_COLUMNS,
  buildProfileDirectory,
  getProfileImage,
  getProfileImageStyle,
  normalizeProfile,
  slugify,
} from '../../lib/profiles.js'

const CURRENT_YEAR = new Date().getFullYear()
const inputClassName = 'mt-2 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-sm outline-none transition focus:border-ink'

export default function ProfileManager() {
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [selectedSlug, setSelectedSlug] = useState('')
  const [draft, setDraft] = useState(createDraft())
  const [saveState, setSaveState] = useState({ status: 'idle', message: '' })

  const profiles = useMemo(() => buildProfileDirectory(rows, { includeUnpublished: true }), [rows])
  const filteredProfiles = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return profiles
    return profiles.filter((profile) => (`${profile.name} ${profile.tag} ${profile.city} ${profile.layerTitle}`).toLowerCase().includes(needle))
  }, [profiles, query])

  useEffect(() => {
    loadProfiles()
  }, [])

  useEffect(() => {
    if (!profiles.length) return

    if (!selectedSlug) {
      const first = profiles[0]
      setSelectedSlug(first.slug)
      setDraft(createDraft(first))
      return
    }

    const match = profiles.find((profile) => profile.slug === selectedSlug)
    if (match) setDraft(createDraft(match))
  }, [profiles, selectedSlug])

  const previewProfile = useMemo(() => normalizeProfile({
    slug: draft.slug || slugify(draft.name || 'profil'),
    layer_slug: draft.layerSlug,
    name: draft.name || 'Име на профила',
    tag: draft.tag || 'Роля',
    city: draft.city || 'Град',
    since: draft.since || CURRENT_YEAR,
    rating: draft.rating,
    projects: draft.projects,
    bio: draft.bio || 'Тук ще се вижда текстът за биото на профила.',
    image_url: draft.imageUrl,
    image_zoom: draft.imageZoom,
    image_x: draft.imageX,
    image_y: draft.imageY,
    is_published: draft.isPublished,
  }), [draft])

  async function loadProfiles() {
    setStatus('loading')
    const { data, error: loadError } = await supabase.from('profiles').select(PROFILE_SELECT_COLUMNS).order('name')

    if (loadError) {
      setRows([])
      setError(loadError.message)
      setStatus('error')
      return
    }

    setRows(data || [])
    setError('')
    setStatus('ready')
  }

  function updateDraft(key, value) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function editProfile(profile) {
    setSelectedSlug(profile.slug)
    setDraft(createDraft(profile))
    setSaveState({ status: 'idle', message: '' })
  }

  function startNewProfile() {
    setSelectedSlug('__new__')
    setDraft(createDraft())
    setSaveState({ status: 'idle', message: '' })
  }

  async function handleImageUpload(file) {
    if (!file) return

    const target = resolveProfileUploadTarget({
      userId: draft.userId,
      slug: draft.slug,
      name: draft.name,
    })
    if (!target) {
      setSaveState({ status: 'error', message: 'Въведи име, slug или свързан user ID преди да качиш снимка.' })
      return
    }

    setSaveState({ status: 'uploading', message: 'Оптимизираме и качваме снимката…' })

    try {
      const result = await uploadProfileMedia({ file, target })
      updateDraft('imageUrl', result.publicUrl)
      const reuseMessage = result.reused
        ? 'Същото изображение вече съществува и ползваме готовия optimized файл.'
        : 'Снимката е качена.'
      const compressMessage = result.precompressed ? ' Преди upload я компресирахме локално.' : ''
      setSaveState({ status: 'uploaded', message: `${reuseMessage}${compressMessage} Натисни „Запази профила“.` })
    } catch (error) {
      setSaveState({ status: 'error', message: error.message || 'Качването не успя.' })
      return
    }

  }

  async function submit(e) {
    e.preventDefault()
    const payload = toPayload(draft)

    if (!payload.name || !payload.tag || !payload.city) {
      setSaveState({ status: 'error', message: 'Попълни име, роля и град.' })
      return
    }

    setSaveState({ status: 'saving', message: 'Запазваме профила…' })

    const { data, error: saveError } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'slug' })
      .select(PROFILE_SELECT_COLUMNS)
      .single()

    if (saveError) {
      setSaveState({ status: 'error', message: saveError.message })
      return
    }

    setRows((current) => [...current.filter((row) => row.slug !== data.slug), data].sort((left, right) => left.name.localeCompare(right.name, 'bg')))
    setSelectedSlug(data.slug)
    setDraft(createDraft(normalizeProfile(data)))
    setStatus('ready')
    setError('')
    setSaveState({ status: 'saved', message: 'Профилът е запазен.' })
  }

  const liveSlug = draft.slug || slugify(draft.name) || 'nov-profil'

  return (
    <section className="mt-12">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="eyebrow">Профили</div>
          <h2 className="h-section mt-2">Редактирай карти, снимки и био от админа.</h2>
          <p className="mt-3 max-w-3xl text-sm text-muted">Тук сменяш име, роля, био, рейтинг, снимка и кадриране на снимката. Позицията и zoom-ът се пазят и се показват еднакво в каталога и в профилната страница.</p>
        </div>
        <button type="button" className="btn btn-primary self-start md:self-auto" onClick={startNewProfile}>Нов профил</button>
      </div>

      {error && (
        <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          Профилите още не са активни в Supabase: {error}. Пусни обновения SQL файл от папка supabase/schema.sql и после презареди тази страница.
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <aside className="lg:col-span-4 xl:col-span-3">
          <div className="rounded-3xl border border-line bg-paper p-4">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Търси по име, роля, град…"
              className={inputClassName}
            />

            <div className="mt-4 max-h-[42rem] space-y-2 overflow-auto pr-1">
              {filteredProfiles.map((profile) => (
                <button
                  key={profile.slug}
                  type="button"
                  onClick={() => editProfile(profile)}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${selectedSlug === profile.slug ? 'border-ink bg-soft' : 'border-line bg-paper hover:border-ink/40'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 overflow-hidden rounded-full border border-line bg-soft">
                      <img src={getProfileImage(profile)} alt={profile.name} className="img-cover" style={getProfileImageStyle(profile)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-display text-lg text-ink">{profile.name}</div>
                        {!profile.isPublished && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-900">Скрит</span>}
                      </div>
                      <div className="mt-1 text-xs text-muted">{profile.tag} · {profile.city}</div>
                      <div className="mt-1 text-xs text-muted">Слой {profile.layerNumber} · {profile.layerTitle}</div>
                    </div>
                  </div>
                </button>
              ))}

              {filteredProfiles.length === 0 && (
                <div className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
                  Няма профили по това търсене.
                </div>
              )}
            </div>

            {status === 'loading' && <div className="mt-4 text-xs text-muted">Зареждаме профилите…</div>}
          </div>
        </aside>

        <div className="lg:col-span-8 xl:col-span-9">
          <form onSubmit={submit} className="rounded-3xl border border-line bg-paper p-6 md:p-8">
            <div className="grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Име на профила">
                    <input value={draft.name} onChange={(e) => updateDraft('name', e.target.value)} className={inputClassName} placeholder="Напр. Студио Ламбринов" />
                  </Field>
                  <Field label="Роля / етикет">
                    <input value={draft.tag} onChange={(e) => updateDraft('tag', e.target.value)} className={inputClassName} placeholder="Напр. Архитект" />
                  </Field>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Field label="Град">
                    <input value={draft.city} onChange={(e) => updateDraft('city', e.target.value)} className={inputClassName} placeholder="София" />
                  </Field>
                  <Field label="Слой">
                    <select value={draft.layerSlug} onChange={(e) => updateDraft('layerSlug', e.target.value)} className={inputClassName}>
                      {LAYERS.map((layer) => <option key={layer.slug} value={layer.slug}>Слой {layer.number} · {layer.title}</option>)}
                    </select>
                  </Field>
                  <Field label="От година">
                    <input type="number" min="1900" max="2100" value={draft.since} onChange={(e) => updateDraft('since', Number(e.target.value))} className={inputClassName} />
                  </Field>
                  <Field label="Проекти">
                    <input type="number" min="0" value={draft.projects} onChange={(e) => updateDraft('projects', Number(e.target.value))} className={inputClassName} />
                  </Field>
                </div>

                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_14rem]">
                  <Field label="URL на снимка">
                    <input value={draft.imageUrl} onChange={(e) => updateDraft('imageUrl', e.target.value)} className={inputClassName} placeholder="https://..." />
                    <div className="mt-2 text-xs text-muted">Можеш да поставиш директен линк или да качиш файл отдолу.</div>
                  </Field>
                  <Field label="Качи файл">
                    <input
                      type="file"
                      accept="image/*"
                      className={`${inputClassName} file:mr-3 file:rounded-full file:border-0 file:bg-soft file:px-4 file:py-2 file:text-sm file:font-medium`}
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        await handleImageUpload(file)
                        e.target.value = ''
                      }}
                    />
                  </Field>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <RangeField label="Zoom" value={draft.imageZoom} min={1} max={2.5} step={0.05} onChange={(value) => updateDraft('imageZoom', value)} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <RangeField label="Ляво / дясно" value={draft.imageX} min={0} max={100} step={1} onChange={(value) => updateDraft('imageX', value)} />
                    <RangeField label="Горе / долу" value={draft.imageY} min={0} max={100} step={1} onChange={(value) => updateDraft('imageY', value)} />
                  </div>
                </div>

                <Field label="Био / описание">
                  <textarea
                    rows={7}
                    value={draft.bio}
                    onChange={(e) => updateDraft('bio', e.target.value)}
                    className={inputClassName}
                    placeholder="Опиши специалиста, стила на работа, вида проекти и защо клиентът да се свърже точно с него."
                  />
                </Field>

                <div className="rounded-2xl border border-line bg-soft/50 px-4 py-4">
                  <label className="flex items-start gap-3 text-sm text-ink">
                    <input type="checkbox" checked={draft.isPublished} onChange={(e) => updateDraft('isPublished', e.target.checked)} className="mt-1 h-4 w-4 rounded border-line" />
                    <span>
                      <span className="font-medium">Покажи профила публично</span>
                      <span className="mt-1 block text-muted">Когато е изключено, профилът остава в админа, но не се показва на сайта.</span>
                    </span>
                  </label>
                </div>

                <Field label="Свързан акаунт (User ID)">
                  <input value={draft.userId} onChange={(e) => updateDraft('userId', e.target.value)} className={inputClassName} placeholder="uuid от auth.users — празно ако няма" />
                  <div className="mt-2 text-xs text-muted">Когато е попълнено, този потребител може да редактира профила от /moy-profil. Намираш ID-то в Supabase → Authentication → Users.</div>
                </Field>
              </div>

              <div className="space-y-4">
                <div className="rounded-3xl border border-line bg-soft/60 p-5">
                  <div className="eyebrow">Live Preview</div>
                  <div className="mt-4 card bg-paper p-6 shadow-none">
                    <div className="flex items-start gap-4">
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-line bg-soft">
                        <img src={getProfileImage(previewProfile)} alt={previewProfile.name} className="img-cover" style={getProfileImageStyle(previewProfile)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-soft px-2.5 py-1 text-xs text-ink">{previewProfile.tag}</span>
                          <span className="text-xs text-muted">Слой {previewProfile.layerNumber} · {previewProfile.layerTitle}</span>
                        </div>
                        <div className="mt-3 font-display text-xl text-ink">{previewProfile.name}</div>
                        <div className="mt-1 text-sm text-muted">{previewProfile.city} · от {previewProfile.since} г.</div>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl border border-line bg-soft/70 px-4 py-3">
                        <div className="text-xs text-muted">Оценка</div>
                        <div className="mt-1 font-medium">★ {previewProfile.rating}</div>
                      </div>
                      <div className="rounded-xl border border-line bg-soft/70 px-4 py-3">
                        <div className="text-xs text-muted">Проекти</div>
                        <div className="mt-1 font-medium">{previewProfile.projects}</div>
                      </div>
                    </div>

                    <div className="mt-5 rounded-full border border-line px-4 py-3 text-center font-medium">Виж профила</div>
                  </div>
                </div>

                <div className="rounded-3xl border border-line bg-paper p-5">
                  <div className="eyebrow">Профилна страница</div>
                  <div className="mt-4 flex items-center gap-4">
                    <div className="h-20 w-20 overflow-hidden rounded-full border-2 border-paper bg-soft shadow-lg">
                      <img src={getProfileImage(previewProfile)} alt={previewProfile.name} className="img-cover" style={getProfileImageStyle(previewProfile)} />
                    </div>
                    <div>
                      <div className="font-display text-2xl text-ink">{previewProfile.name}</div>
                      <div className="text-sm text-muted">{previewProfile.tag} · {previewProfile.city} · от {previewProfile.since} г.</div>
                    </div>
                  </div>
                  <p className="mt-4 whitespace-pre-wrap text-sm text-muted">{previewProfile.bio}</p>
                  <div className="mt-4 text-xs text-muted">Линк: /profil/{liveSlug}</div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-4 border-t border-line pt-6 md:flex-row md:items-center md:justify-between">
              <div className={`text-sm ${saveState.status === 'error' ? 'text-red-700' : 'text-muted'}`}>
                {saveState.message || 'Промените ще се покажат в каталога и в профилната страница след запазване.'}
              </div>
              <div className="flex flex-wrap gap-3">
                <Link to={`/profil/${liveSlug}`} className="btn btn-ghost">Отвори профила</Link>
                <button type="submit" className="btn btn-primary" disabled={saveState.status === 'saving'}>
                  {saveState.status === 'saving' ? 'Запазва се…' : 'Запази профила'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </section>
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

function RangeField({ label, value, min, max, step, onChange }) {
  return (
    <label className="block text-sm font-medium text-ink">
      <span className="flex items-center justify-between gap-4">
        <span>{label}</span>
        <span className="text-xs text-muted">{Number(value).toFixed(step < 1 ? 2 : 0)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 w-full accent-black"
      />
    </label>
  )
}

function createDraft(profile = null) {
  if (!profile) {
    return {
      id: '',
      slug: '',
      layerSlug: LAYERS[0]?.slug || '',
      name: '',
      tag: '',
      city: '',
      since: CURRENT_YEAR,
      rating: 4.8,
      projects: 0,
      bio: '',
      imageUrl: '',
      imageZoom: 1,
      imageX: 50,
      imageY: 50,
      isPublished: true,
      userId: '',
    }
  }

  return {
    id: profile.id || '',
    slug: profile.slug || '',
    layerSlug: profile.layerSlug || profile.layer || LAYERS[0]?.slug || '',
    name: profile.name || '',
    tag: profile.tag || '',
    city: profile.city || '',
    since: profile.since || CURRENT_YEAR,
    rating: profile.rating ?? 4.8,
    projects: profile.projects ?? 0,
    bio: profile.bio || '',
    imageUrl: profile.imageUrl || '',
    imageZoom: profile.imageZoom ?? 1,
    imageX: profile.imageX ?? 50,
    imageY: profile.imageY ?? 50,
    isPublished: profile.isPublished ?? true,
    userId: profile.userId || '',
  }
}

function toPayload(draft) {
  const slug = draft.slug.trim() || slugify(draft.name)

  return {
    slug,
    layer_slug: draft.layerSlug,
    name: draft.name.trim(),
    tag: draft.tag.trim(),
    city: draft.city.trim(),
    since: Number(draft.since) || CURRENT_YEAR,
    rating: Number(Number(draft.rating || 0).toFixed(1)),
    projects: Number(draft.projects) || 0,
    bio: draft.bio.trim(),
    image_url: draft.imageUrl.trim(),
    image_zoom: Number(draft.imageZoom || 1),
    image_x: Number(draft.imageX || 50),
    image_y: Number(draft.imageY || 50),
    is_published: Boolean(draft.isPublished),
    user_id: draft.userId?.trim() || null,
  }
}

