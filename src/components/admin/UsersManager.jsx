import { useEffect, useMemo, useState } from 'react'
import { Ban, CheckCircle2, RefreshCcw, Search, ShieldCheck } from 'lucide-react'
import {
  ACCOUNT_ROLE_LABELS,
  ADMIN_INPUT_CLASS,
  ADMIN_SELECT_CLASS,
  SPECIALIST_STATUS_LABELS,
  formatAdminDate,
  loadAccounts,
  paginateRows,
  updateAccount,
} from '../../lib/admin.js'
import { LAYERS } from '../../data/layers.js'
import { PROFILE_SELECT_COLUMNS, getProfileImage, getProfileImageStyle, normalizeProfile } from '../../lib/profiles.js'
import { supabase } from '../../lib/supabase.js'

const ADMIN_ROLE_MANAGER_EMAILS = new Set(['a.mitkov@totsan.com', 'ivelinva2@gmail.com'])

export default function UsersManager({ globalQuery = '', account }) {
  const [accounts, setAccounts] = useState([])
  const [profiles, setProfiles] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [visibilityFilter, setVisibilityFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [actionState, setActionState] = useState({ id: '', message: '' })

  const canManageAdmins = hasAdminRoleManagerAccess(account)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setStatus('loading')
    setError('')
    try {
      const [accs, { data: profs, error: profsError }] = await Promise.all([
        loadAccounts(),
        supabase.from('profiles').select(PROFILE_SELECT_COLUMNS).order('name')
      ])
      if (profsError) throw profsError
      
      setAccounts(accs)
      setProfiles(profs || [])
      setStatus('ready')
    } catch (loadError) {
      setError(loadError.message || 'Данните не се заредиха.')
      setStatus('error')
    }
  }

  const entities = useMemo(() => {
    const profilesByUserId = new Map()
    profiles.forEach(p => {
      if (p.user_id) profilesByUserId.set(p.user_id, p)
    })
    
    const handledProfileIds = new Set()
    const result = []

    accounts.forEach(acc => {
      const prof = profilesByUserId.get(acc.id)
      if (prof) handledProfileIds.add(prof.id)
      result.push({
        id: `acc_${acc.id}`,
        type: prof ? 'combined' : 'account',
        account: acc,
        profile: prof ? normalizeProfile(prof) : null
      })
    })

    profiles.forEach(p => {
      if (!handledProfileIds.has(p.id)) {
        result.push({
          id: `prof_${p.id}`,
          type: 'profile',
          account: null,
          profile: normalizeProfile(p)
        })
      }
    })

    return result
  }, [accounts, profiles])

  const filtered = useMemo(() => {
    const combinedQuery = query || globalQuery
    return entities.filter(({ type, account, profile }) => {
      const accRole = account ? account.role : 'specialist'
      if (roleFilter !== 'all' && accRole !== roleFilter) return false

      const accStatus = account ? (account.account_status === 'banned' ? 'banned' : (account.specialist_status || 'active')) : 'active'
      if (statusFilter !== 'all' && accStatus !== statusFilter) return false

      const profVisibility = profile ? (profile.isPublished ? 'published' : 'hidden') : 'no_profile'
      if (visibilityFilter !== 'all') {
         if (visibilityFilter === 'unlinked' && type !== 'profile') return false
         if (visibilityFilter === 'published' && profVisibility !== 'published') return false
         if (visibilityFilter === 'hidden' && profVisibility !== 'hidden') return false
         if (visibilityFilter === 'no_profile' && profVisibility !== 'no_profile') return false
      }

      const searchNeedle = String(combinedQuery).toLowerCase()
      if (!searchNeedle) return true
      
      const searchString = [
         account?.email, account?.full_name, account?.display_name, account?.phone, account?.city,
         profile?.name, profile?.tag, profile?.city, profile?.layerTitle
      ].filter(Boolean).join(' ').toLowerCase()
      
      return searchString.includes(searchNeedle)
    })
  }, [entities, globalQuery, query, roleFilter, statusFilter, visibilityFilter])

  const pageData = useMemo(() => paginateRows(filtered, page), [filtered, page])

  useEffect(() => {
    setPage(1)
  }, [globalQuery, query, roleFilter, statusFilter, visibilityFilter])

  async function runAccountUpdate(acc, updates, message) {
    setActionState({ id: `acc_${acc.id}`, message: 'Запазваме…' })
    setError('')
    try {
      await updateAccount(acc.id, updates)
      setAccounts((current) => current.map((item) => item.id === acc.id ? { ...item, ...mapLocalUpdates(updates) } : item))
      setActionState({ id: `acc_${acc.id}`, message })
      setTimeout(() => setActionState({ id: '', message: '' }), 3000)
    } catch (actionError) {
      setActionState({ id: `acc_${acc.id}`, message: actionError.message || 'Действието не успя.' })
    }
  }

  async function runProfileUpdate(prof, updates, message) {
    setActionState({ id: `prof_${prof.id}`, message: 'Запазваме…' })
    setError('')
    try {
      const { data, error: updateError } = await supabase.from('profiles').update(updates).eq('id', prof.id).select(PROFILE_SELECT_COLUMNS).single()
      if (updateError) throw updateError
      
      setProfiles(current => current.map(p => p.id === prof.id ? data : p))
      setActionState({ id: `prof_${prof.id}`, message })
      setTimeout(() => setActionState({ id: '', message: '' }), 3000)
    } catch (err) {
      setActionState({ id: `prof_${prof.id}`, message: err.message || 'Действието не успя.' })
    }
  }

  if (status === 'loading') return <Panel title="Зареждаме потребителите и профилите…" />
  if (status === 'error') {
    return (
      <Panel title="Грешка при зареждане">
        <p className="text-sm text-red-700">{error}</p>
        <button type="button" onClick={load} className="btn btn-ghost mt-5">Опитай пак</button>
      </Panel>
    )
  }

  return (
    <section className="space-y-5">
      <div className="rounded-3xl border border-line bg-paper p-5 md:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="eyebrow">Потребители и Профили</div>
            <h2 className="mt-2 font-display text-3xl text-ink">Управление на акаунти и визитки</h2>
            <p className="mt-2 text-sm text-muted">Тук контролираш достъпа (роли, бан) и публичната видимост на специалистите в каталога.</p>
          </div>
          <button type="button" onClick={load} className="btn btn-ghost self-start"><RefreshCcw size={17} /> Обнови</button>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_10rem_10rem_12rem]">
          <label className="relative block">
            <Search size={17} className="pointer-events-none absolute left-4 top-[2.35rem] text-muted" />
            <span className="text-sm font-medium text-ink">Търсене</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} className={`${ADMIN_INPUT_CLASS} pl-11`} placeholder="Имейл, име, град, слой…" />
          </label>
          <Filter label="Роля" value={roleFilter} onChange={setRoleFilter} options={[['all', 'Всички'], ['user', 'Клиенти'], ['specialist', 'Специалисти'], ['admin', 'Админи']]} />
          <Filter label="Статус (Акаунт)" value={statusFilter} onChange={setStatusFilter} options={[['all', 'Всички'], ['active', 'Активни'], ['pending', 'Чакащи'], ['approved', 'Одобрени'], ['rejected', 'Отхвърлени'], ['banned', 'Блокирани']]} />
          <Filter label="Видимост (Профил)" value={visibilityFilter} onChange={setVisibilityFilter} options={[['all', 'Всички'], ['published', 'Публични'], ['hidden', 'Скрити'], ['no_profile', 'Без профил'], ['unlinked', 'Осиротели профили']]} />
        </div>
      </div>

      <div className="space-y-3">
        {pageData.rows.map(({ id, type, account, profile }) => {
          const isSelf = account && account.id === account?.id
          const actionId = account ? `acc_${account.id}` : `prof_${profile.id}`
          const busyMessage = actionState.id === actionId || actionState.id === `prof_${profile?.id}` ? actionState.message : ''
          const roleOptions = account ? getRoleOptions(account, canManageAdmins) : []
          const roleLocked = account ? (isSelf || (!canManageAdmins && account.role === 'admin')) : true
          const accountStatusLocked = account ? (isSelf || (!canManageAdmins && account.role === 'admin')) : true

          return (
            <article key={id} className="rounded-3xl border border-line bg-paper p-5 transition hover:border-ink/20">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_11rem_14rem_9rem] xl:items-start">
                
                {/* 1. Identity */}
                <div className="min-w-0 flex gap-4">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-line bg-soft mt-1">
                    {profile ? (
                      <img src={getProfileImage(profile)} alt="" className="img-cover" style={getProfileImageStyle(profile)} />
                    ) : (
                       <div className="flex h-full items-center justify-center text-muted font-display text-xl">
                          {displayName(account, profile).charAt(0).toUpperCase()}
                       </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate font-display text-2xl text-ink">{displayName(account, profile)}</div>
                      {account && <StatusPill value={account.account_status === 'banned' ? 'banned' : (account.specialist_status || 'active')} />}
                      {type === 'profile' && <span className="rounded-full bg-amber-100 text-amber-900 px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold">Осиротял профил</span>}
                    </div>
                    {account?.email && <div className="mt-1 truncate text-sm text-muted">{account.email}</div>}
                    <div className="mt-2 space-y-1 text-xs text-muted">
                      {account && <div>Регистрация: {formatAdminDate(account.created_at)}</div>}
                      {(account?.city || profile?.city) && <div>Град: {account?.city || profile?.city}</div>}
                      {isSelf && <div className="text-accent">Това е твоят профил</div>}
                    </div>
                  </div>
                </div>

                {/* 2. Account Settings */}
                <div className="space-y-3">
                  <div className="text-sm font-medium text-ink border-b border-line pb-1 mb-2">Акаунт достъп</div>
                  {account ? (
                    <>
                      <label className="block text-xs text-muted">Роля
                        <select
                          value={account.role || 'user'}
                          onChange={(e) => runAccountUpdate(account, { role: e.target.value }, 'Ролята е обновена.')}
                          className={`${ADMIN_SELECT_CLASS} mt-1 w-full !py-1.5 text-xs bg-soft`}
                          disabled={roleLocked}
                        >
                          {roleOptions.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                        </select>
                      </label>
                      <label className="block text-xs text-muted">Specialist статус
                        <select
                          value={account.specialist_status || ''}
                          onChange={(e) => runAccountUpdate(account, { specialistStatus: e.target.value || null }, 'Статусът е обновен.')}
                          className={`${ADMIN_SELECT_CLASS} mt-1 w-full !py-1.5 text-xs bg-soft`}
                          disabled={account.role !== 'specialist'}
                        >
                          <option value="">—</option>
                          {Object.entries(SPECIALIST_STATUS_LABELS).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                        </select>
                      </label>
                    </>
                  ) : (
                    <div className="text-xs text-muted italic">Няма свързан акаунт.</div>
                  )}
                </div>

                {/* 3. Profile Settings */}
                <div className="space-y-3">
                  <div className="text-sm font-medium text-ink border-b border-line pb-1 mb-2">Публичен Профил</div>
                  {(account?.role === 'specialist' || profile) ? (
                    profile ? (
                      <>
                        <label className="flex items-center gap-2 text-xs text-ink cursor-pointer hover:text-accent transition">
                          <input
                            type="checkbox"
                            checked={profile.isPublished}
                            onChange={(e) => runProfileUpdate(profile, { is_published: e.target.checked }, 'Видимостта е обновена.')}
                            className="h-3.5 w-3.5 rounded border-line accent-accent cursor-pointer"
                          />
                          Видим в каталога
                        </label>
                        <label className="block text-xs text-muted mt-2">Слой
                          <select
                            value={profile.layerSlug || ''}
                            onChange={(e) => runProfileUpdate(profile, { layer_slug: e.target.value }, 'Слоят е променен.')}
                            className={`${ADMIN_SELECT_CLASS} mt-1 w-full !py-1.5 text-xs bg-soft`}
                          >
                            {LAYERS.map(l => <option key={l.slug} value={l.slug}>Слой {l.number}</option>)}
                          </select>
                        </label>
                      </>
                    ) : (
                       <div className="text-xs text-muted italic bg-soft/50 rounded-xl p-2.5 border border-line">
                         Специалистът все още не е създал своята публична визитка през портала.
                       </div>
                    )
                  ) : (
                    <div className="text-xs text-muted italic">Само за специалисти.</div>
                  )}
                </div>

                {/* 4. Actions */}
                <div className="flex flex-col gap-2 pt-1 xl:pt-8">
                  {account && account.role === 'specialist' && account.specialist_status !== 'approved' && (
                    <button
                      type="button"
                      onClick={() => runAccountUpdate(account, { role: 'specialist', specialistStatus: 'approved', accountStatus: 'active' }, 'Специалистът е одобрен.')}
                      className="btn btn-primary !py-1.5 text-xs w-full justify-center"
                    >
                      <CheckCircle2 size={14} className="mr-1" /> Одобри
                    </button>
                  )}
                  {account && (
                    <button
                      type="button"
                      disabled={accountStatusLocked}
                      onClick={() => runAccountUpdate(account, { accountStatus: account.account_status === 'banned' ? 'active' : 'banned' }, account.account_status === 'banned' ? 'Акаунтът е активиран.' : 'Акаунтът е блокиран.')}
                      className="btn btn-ghost border border-line !py-1.5 text-xs disabled:opacity-50 w-full justify-center hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                    >
                      {account.account_status === 'banned' ? <ShieldCheck size={14} className="mr-1" /> : <Ban size={14} className="mr-1" />}
                      {account.account_status === 'banned' ? 'Активирай' : 'Блокирай'}
                    </button>
                  )}
                  {profile && profile.isPublished && (
                     <a href={`/profil/${profile.slug}`} target="_blank" rel="noreferrer" className="btn btn-ghost border border-line !py-1.5 text-xs w-full justify-center mt-auto">
                        Виж профила
                     </a>
                  )}
                </div>
              </div>
              {busyMessage && <div className="mt-4 text-xs font-medium text-accent animate-pulse">{busyMessage}</div>}
            </article>
          )
        })}
        {pageData.rows.length === 0 && <Empty text="Няма намерени резултати по тези филтри." />}
      </div>

      <Pager current={pageData.currentPage} total={pageData.totalPages} onChange={setPage} />
    </section>
  )
}

function displayName(account, profile) {
  if (profile?.name) return profile.name
  if (account) return account.full_name || account.display_name || account.email?.split('@')[0] || 'Потребител'
  return 'Неизвестен'
}

function hasAdminRoleManagerAccess(account) {
  return ADMIN_ROLE_MANAGER_EMAILS.has(String(account?.email || '').trim().toLowerCase())
}

function getRoleOptions(row, canManageAdmins) {
  if (canManageAdmins || row.role === 'admin') return Object.entries(ACCOUNT_ROLE_LABELS)
  return Object.entries(ACCOUNT_ROLE_LABELS).filter(([value]) => value !== 'admin')
}

function mapLocalUpdates(updates) {
  const next = { last_admin_action_at: new Date().toISOString() }
  if ('role' in updates) next.role = updates.role
  if ('specialistStatus' in updates) next.specialist_status = updates.specialistStatus
  if ('accountStatus' in updates) next.account_status = updates.accountStatus
  return next
}

function StatusPill({ value }) {
  const labels = {
    active: 'Активен',
    pending: 'Чака',
    approved: 'Одобрен',
    rejected: 'Отхвърлен',
    banned: 'Блокиран',
  }
  const tones = {
    approved: 'bg-green-100 text-green-800',
    pending: 'bg-amber-100 text-amber-900',
    rejected: 'bg-red-100 text-red-800',
    banned: 'bg-red-100 text-red-800',
    active: 'bg-soft text-muted',
  }

  return <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold ${tones[value] || tones.active}`}>{labels[value] || value}</span>
}

function Filter({ label, value, onChange, options }) {
  return (
    <label className="block text-sm font-medium text-ink">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className={`${ADMIN_SELECT_CLASS} mt-2 w-full rounded-2xl`}>
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  )
}

function Pager({ current, total, onChange }) {
  if (total <= 1) return null
  return (
    <div className="flex items-center justify-end gap-2">
      <button type="button" className="btn btn-ghost !py-2 text-sm" onClick={() => onChange(current - 1)} disabled={current <= 1}>Назад</button>
      <span className="text-sm text-muted">{current} / {total}</span>
      <button type="button" className="btn btn-ghost !py-2 text-sm" onClick={() => onChange(current + 1)} disabled={current >= total}>Напред</button>
    </div>
  )
}

function Empty({ text }) {
  return <div className="rounded-3xl border border-dashed border-line bg-paper p-8 text-center text-sm text-muted">{text}</div>
}

function Panel({ title, children }) {
  return <div className="rounded-3xl border border-line bg-paper p-6"><h2 className="font-display text-2xl text-ink">{title}</h2>{children && <div className="mt-3">{children}</div>}</div>
}
