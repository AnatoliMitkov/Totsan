import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, RefreshCcw, Search, SlidersHorizontal, UserRound, Pencil, X, Ban } from 'lucide-react'
import { LAYERS } from '../../data/layers.js'
import { PROFILE_SELECT_COLUMNS, buildProfileDirectory, getProfileImage, getProfileImageStyle } from '../../lib/profiles.js'
import { supabase } from '../../lib/supabase.js'
import { updateAccount } from '../../lib/admin.js'

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
  const [editingProfile, setEditingProfile] = useState(null)
  const [draft, setDraft] = useState(null)
  const [saveState, setSaveState] = useState({ status: 'idle', message: '' })

  const profiles = useMemo(() => buildProfileDirectory(rows, { includeUnpublished: true }), [rows])

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

  function startEditing(profile) {
    setEditingProfile(profile)
    setDraft({
      layerSlug: profile.layerSlug || profile.layer || LAYERS[0]?.slug || '',
      isPublished: profile.isPublished ?? true,
      userId: profile.userId || '',
    })
    setSaveState({ status: 'idle', message: '' })
  }

  function closeEditing() {
    setEditingProfile(null)
    setDraft(null)
  }

  function updateDraft(key, value) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  async function submit(e) {
    e.preventDefault()

    if (!editingProfile?.id) return

    setSaveState({ status: 'saving', message: 'Запазваме настройките...' })

    const payload = {
      is_published: Boolean(draft.isPublished),
      layer_slug: draft.layerSlug || editingProfile.layerSlug,
      user_id: draft.userId.trim() || null,
    }

    const { data, error: saveError } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', editingProfile.id)
      .select(PROFILE_SELECT_COLUMNS)
      .single()

    if (saveError) {
      setSaveState({ status: 'error', message: saveError.message })
      return
    }

    setRows((current) => current.map((row) => (row.id === data.id ? data : row)))
    setSaveState({ status: 'saved', message: 'Успешно запазено.' })
    setTimeout(() => {
      closeEditing()
    }, 1000)
  }

  async function blockProfile() {
    if (!window.confirm('Сигурни ли сте, че искате да блокирате този профил?\nТова ще го скрие от публичния каталог и ще блокира достъпа на свързания акаунт (ако има такъв).')) return
    
    setSaveState({ status: 'saving', message: 'Блокиране на профила...' })

    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ is_published: false })
        .eq('id', editingProfile.id)

      if (profileError) throw profileError

      if (editingProfile.userId) {
        await updateAccount(editingProfile.userId, { accountStatus: 'banned' })
      }

      await loadProfiles()
      setSaveState({ status: 'saved', message: 'Профилът е успешно блокиран.' })
      setTimeout(() => {
        closeEditing()
      }, 1500)
    } catch (err) {
      setSaveState({ status: 'error', message: err.message || 'Грешка при блокиране.' })
    }
  }

  return (
    <section className="mt-12">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="eyebrow">Профили</div>
          <h2 className="h-section mt-2">Управление на профили</h2>
          <p className="mt-3 max-w-3xl text-sm text-muted">
            Публичност, категоризация и свързани акаунти на всички партньори в системата.
          </p>
        </div>
        <button type="button" className="btn btn-ghost self-start md:self-auto" onClick={loadProfiles}>
          <RefreshCcw size={16} />
          Обнови
        </button>
      </div>

      <div className="mt-6 grid gap-3 grid-cols-2 md:grid-cols-4">
        <StatCard label="Всички" value={stats.total} />
        <StatCard label="Публични" value={stats.published} />
        <StatCard label="Скрити" value={stats.hidden} />
        <StatCard label="Без акаунт" value={stats.unlinked} />
      </div>

      {error && (
        <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          Профилите не се заредиха: {error}
        </div>
      )}

      <div className="mt-6 rounded-3xl border border-line bg-paper p-4 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <label className="relative flex-1 block">
            <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Търси име, град, слой..."
              className={`${inputClassName} !mt-0 pl-11`}
            />
          </label>
          <div className="flex w-full md:w-auto items-center gap-2">
            <SlidersHorizontal size={16} className="text-muted shrink-0" />
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className={`${selectClassName} !mt-0 w-full min-w-[14rem]`}>
              {FILTERS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-line custom-scrollbar">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-soft border-b border-line text-muted uppercase text-[10px] tracking-wider font-semibold">
              <tr>
                <th className="px-5 py-4 w-1/3">Профил</th>
                <th className="px-5 py-4">Слой / Категория</th>
                <th className="px-5 py-4">Статус</th>
                <th className="px-5 py-4">Акаунт</th>
                <th className="px-5 py-4 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredProfiles.length > 0 ? (
                filteredProfiles.map((profile) => (
                  <tr key={profile.slug} className="hover:bg-soft/40 transition">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-line bg-soft">
                          <img src={getProfileImage(profile)} alt={profile.name} className="img-cover" style={getProfileImageStyle(profile)} />
                        </div>
                        <div>
                          <div className="font-medium text-ink text-base">{profile.name}</div>
                          <div className="text-xs text-muted mt-0.5">{profile.tag} · {profile.city}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="font-medium text-ink">Слой {profile.layerNumber}</div>
                      <div className="text-xs text-muted mt-0.5 truncate max-w-[12rem]">{profile.layerTitle}</div>
                    </td>
                    <td className="px-5 py-3">
                      <VisibilityBadge profile={profile} />
                    </td>
                    <td className="px-5 py-3">
                      {profile.userId ? (
                        <div className="inline-flex items-center gap-1.5 text-xs text-ink bg-soft px-2.5 py-1 rounded-full border border-line/50">
                          <UserRound size={12} />
                          Свързан
                        </div>
                      ) : (
                        <div className="inline-flex text-xs text-muted px-2.5 py-1 rounded-full border border-line bg-paper">
                          Няма акаунт
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link to={`/profil/${profile.slug}`} title="Отвори публичния профил" className="p-2 text-muted hover:text-ink hover:bg-soft rounded-xl transition">
                          <Eye size={16} />
                        </Link>
                        <button type="button" onClick={() => startEditing(profile)} className="btn btn-ghost !px-3 !py-1.5 text-xs">
                          <Pencil size={14} className="mr-1.5" /> Редакция
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center text-muted bg-soft/20">
                    {status === 'loading' ? 'Зареждаме профилите...' : 'Няма намерени профили.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingProfile && draft && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/20 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-[2rem] border border-line bg-paper shadow-2xl relative max-h-[90vh] flex flex-col">
            <button type="button" onClick={closeEditing} className="absolute right-4 top-4 p-2 text-muted hover:bg-soft hover:text-ink rounded-full transition z-10">
              <X size={20} />
            </button>
            <div className="px-6 pt-6 pb-4 border-b border-line shrink-0">
               <div className="eyebrow">Редакция на профил</div>
               <div className="mt-2 text-xl font-display text-ink pr-8">{editingProfile.name}</div>
            </div>
            
            <form onSubmit={submit} className="p-6 overflow-y-auto flex-1 custom-scrollbar">
              <div className="space-y-5">
                <label className="flex items-start gap-3 rounded-2xl border border-line bg-soft/50 p-4 cursor-pointer hover:border-ink/30 transition">
                  <input
                    type="checkbox"
                    checked={draft.isPublished}
                    onChange={(e) => updateDraft('isPublished', e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-line accent-accent"
                  />
                  <span>
                    <span className="block font-medium text-sm text-ink">Публичен профил</span>
                    <span className="block text-xs text-muted mt-0.5">Ако е изключено, профилът няма да се вижда в каталога.</span>
                  </span>
                </label>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-ink">Слой / категория</label>
                  <select value={draft.layerSlug} onChange={(e) => updateDraft('layerSlug', e.target.value)} className={`${selectClassName} !mt-0`}>
                    {LAYERS.map((layer) => (
                      <option key={layer.slug} value={layer.slug}>Слой {layer.number} · {layer.title}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-ink">Свързан акаунт (User ID)</label>
                  <input
                    value={draft.userId}
                    onChange={(e) => updateDraft('userId', e.target.value)}
                    className={`${inputClassName} !mt-0 font-mono text-xs`}
                    placeholder="uuid от auth.users"
                  />
                  <div className="text-[11px] text-muted">
                    Този акаунт може да редактира профила си през портала.
                  </div>
                </div>

                {saveState.message && (
                  <div className={`rounded-xl p-3 text-xs ${saveState.status === 'error' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
                    {saveState.message}
                  </div>
                )}
              </div>
              
              <div className="mt-8 flex gap-3 pt-2">
                <button type="button" onClick={blockProfile} disabled={saveState.status === 'saving'} className="btn border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 flex-1 justify-center transition">
                   <Ban size={16} className="mr-1.5" /> Блокирай
                </button>
                <button type="button" onClick={closeEditing} className="btn btn-ghost flex-1 justify-center">Отказ</button>
                <button type="submit" disabled={saveState.status === 'saving'} className="btn btn-primary flex-1 justify-center">
                   {saveState.status === 'saving' ? 'Запазване...' : 'Запази'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-3xl border border-line bg-paper p-5 transition hover:border-ink/30 shadow-sm">
      <div className="font-display text-[clamp(1.5rem,1rem+1vw,2rem)] text-ink">{value}</div>
      <div className="mt-1 text-xs text-muted font-medium">{label}</div>
    </div>
  )
}

function VisibilityBadge({ profile }) {
  return profile.isPublished ? (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-green-100 text-green-800">
      <Eye size={12} /> Публичен
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-amber-100 text-amber-900">
      <EyeOff size={12} /> Скрит
    </span>
  )
}
