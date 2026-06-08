import { useEffect, useMemo, useState } from 'react'
import { Ban, CheckCircle2, ChevronDown, Edit3, ExternalLink, Eye, EyeOff, Save, Search, ShieldCheck, UserRound, X } from 'lucide-react'
import {
  ACCOUNT_ROLE_LABELS,
  ACCOUNT_STATUS_LABELS,
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

const ACCOUNT_STATUS_META = {
  active: { label: 'Активен', tone: 'neutral', icon: ShieldCheck },
  pending: { label: 'Чака', tone: 'warning', icon: UserRound },
  approved: { label: 'Одобрен', tone: 'success', icon: CheckCircle2 },
  rejected: { label: 'Отхвърлен', tone: 'danger', icon: Ban },
  banned: { label: 'Блокиран', tone: 'danger', icon: Ban },
}

const ROLE_META = {
  user: { label: 'Клиент', tone: 'neutral' },
  specialist: { label: 'Специалист', tone: 'info' },
  admin: { label: 'Админ', tone: 'admin' },
}

const TONE_CLASSES = {
  admin: 'border-indigo-200 bg-indigo-50 text-indigo-800',
  danger: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-sky-200 bg-sky-50 text-sky-800',
  neutral: 'border-line bg-soft text-muted',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
}

export default function UsersManager({ globalQuery = '', account: currentAccount }) {
  const [accounts, setAccounts] = useState([])
  const [profiles, setProfiles] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [actionState, setActionState] = useState({ id: '', message: '', tone: 'neutral' })
  const [editingEntity, setEditingEntity] = useState(null)

  const canManageAdmins = currentAccount?.role === 'admin' || hasAdminRoleManagerAccess(currentAccount)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setStatus('loading')
    setError('')
    try {
      const [accs, { data: profs, error: profsError }] = await Promise.all([
        loadAccounts(),
        supabase.from('profiles').select(PROFILE_SELECT_COLUMNS).order('name'),
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
    profiles.forEach((profile) => {
      if (profile.user_id) profilesByUserId.set(profile.user_id, profile)
    })

    const handledProfileIds = new Set()
    const result = []

    accounts.forEach((account) => {
      const profile = profilesByUserId.get(account.id)
      if (profile) handledProfileIds.add(profile.id)
      result.push({
        id: `acc_${account.id}`,
        type: profile ? 'combined' : 'account',
        account,
        profile: profile ? normalizeProfile(profile) : null,
      })
    })

    profiles.forEach((profile) => {
      if (!handledProfileIds.has(profile.id)) {
        result.push({
          id: `prof_${profile.id}`,
          type: 'profile',
          account: null,
          profile: normalizeProfile(profile),
        })
      }
    })

    return result
  }, [accounts, profiles])

  const filtered = useMemo(() => {
    const searchNeedle = String(query || globalQuery || '').trim().toLowerCase()
    if (!searchNeedle) return entities

    return entities.filter(({ type, account, profile }) => {
      const statusValue = getAccountStatusValue(account)
      const searchString = [
        type,
        account?.email,
        account?.full_name,
        account?.display_name,
        account?.phone,
        account?.city,
        account?.role,
        ACCOUNT_ROLE_LABELS[account?.role],
        ACCOUNT_STATUS_META[statusValue]?.label,
        profile?.name,
        profile?.tag,
        profile?.city,
        profile?.layerTitle,
        profile?.layerSlug,
        profile?.isPublished ? 'публичен видим каталог' : 'скрит',
      ].filter(Boolean).join(' ').toLowerCase()

      return searchString.includes(searchNeedle)
    })
  }, [entities, globalQuery, query])

  const pageData = useMemo(() => paginateRows(filtered, page), [filtered, page])

  useEffect(() => {
    setPage(1)
  }, [globalQuery, query])

  async function saveEntity(entity, draft) {
    const actionId = entity.account ? `acc_${entity.account.id}` : `prof_${entity.profile.id}`
    setActionState({ id: actionId, message: 'Запазваме промените...', tone: 'neutral' })
    setError('')

    try {
      if (entity.account) {
        const updates = buildAccountUpdates(entity.account, draft)
        if (Object.keys(updates).length > 0) {
          await updateAccount(entity.account.id, updates)
          setAccounts((current) => current.map((item) => item.id === entity.account.id ? { ...item, ...mapLocalUpdates(updates) } : item))
        }
      }

      if (entity.profile) {
        const profileUpdates = buildProfileUpdates(entity.profile, draft)
        if (Object.keys(profileUpdates).length > 0) {
          const { data, error: updateError } = await supabase
            .from('profiles')
            .update(profileUpdates)
            .eq('id', entity.profile.id)
            .select(PROFILE_SELECT_COLUMNS)
            .single()
          if (updateError) throw updateError

          setProfiles((current) => current.map((profile) => profile.id === entity.profile.id ? data : profile))
        }
      }

      setActionState({ id: actionId, message: 'Промените са запазени.', tone: 'success' })
      setEditingEntity(null)
      setTimeout(() => setActionState({ id: '', message: '', tone: 'neutral' }), 3000)
    } catch (saveError) {
      setActionState({ id: actionId, message: saveError.message || 'Действието не успя.', tone: 'danger' })
      throw saveError
    }
  }

  if (status === 'loading') return <Panel title="Зареждаме потребителите и профилите..." />
  if (status === 'error') {
    return (
      <Panel title="Грешка при зареждане">
        <p className="text-sm text-red-700">{error}</p>
      </Panel>
    )
  }

  return (
    <section className="space-y-5">
      <label className="relative block">
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-14 w-full rounded-3xl border border-line bg-paper pl-14 pr-4 text-sm leading-[3.5rem] outline-none transition focus:border-ink"
          placeholder="Търсене по имейл, име, град, роля, статус или слой..."
        />
      </label>

      {actionState.message && !editingEntity && (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${toneClass(actionState.tone)}`}>
          {actionState.message}
        </div>
      )}

      <div className="grid gap-4 2xl:grid-cols-2">
        {pageData.rows.map((entity) => (
          <UserCard
            key={entity.id}
            entity={entity}
            currentAccount={currentAccount}
            busyMessage={actionState.id === (entity.account ? `acc_${entity.account.id}` : `prof_${entity.profile.id}`) ? actionState.message : ''}
            onEdit={() => setEditingEntity(entity)}
          />
        ))}
        {pageData.rows.length === 0 && <Empty text="Няма намерени резултати по това търсене." />}
      </div>

      <Pager current={pageData.currentPage} total={pageData.totalPages} onChange={setPage} />

      {editingEntity && (
        <EditUserModal
          entity={editingEntity}
          canManageAdmins={canManageAdmins}
          currentAccount={currentAccount}
          actionState={actionState}
          onClose={() => setEditingEntity(null)}
          onSave={saveEntity}
        />
      )}
    </section>
  )
}

function UserCard({ entity, currentAccount, busyMessage, onEdit }) {
  const { account, profile, type } = entity
  const isSelf = account && account.id === currentAccount?.id
  const statusValue = getAccountStatusValue(account)
  const roleValue = account?.role || (profile ? 'specialist' : 'user')
  const profileUrl = profile?.slug ? `/profil/${profile.slug}` : ''
  const canOpenProfile = Boolean(profileUrl && profile?.isPublished)

  return (
    <article className="rounded-3xl border border-line bg-paper p-5 transition hover:border-ink/20">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex gap-4">
          <Avatar account={account} profile={profile} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate font-display text-2xl text-ink">{displayName(account, profile)}</h3>
              <StatusPill value={statusValue} />
              <RolePill value={roleValue} />
              {type === 'profile' && <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">Осиротял профил</span>}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
              {account?.email && <span className="truncate">{account.email}</span>}
              {(account?.city || profile?.city) && <span>Град: {account?.city || profile?.city}</span>}
              {account && <span>Регистрация: {formatAdminDate(account.created_at)}</span>}
              {profile?.layerTitle && <span>{profile.layerTitle}</span>}
              {isSelf && <span className="font-medium text-accent">Това е твоят профил</span>}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {profile ? (
                <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 ${profile.isPublished ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-line bg-soft text-muted'}`}>
                  {profile.isPublished ? <Eye size={13} /> : <EyeOff size={13} />}
                  {profile.isPublished ? 'Видим в каталога' : 'Скрит от каталога'}
                </span>
              ) : (
                <span className="rounded-full border border-line bg-soft px-3 py-1 text-muted">Няма публичен профил</span>
              )}
              {account?.account_status === 'banned' && <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 font-medium text-red-800">Достъпът е блокиран</span>}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 xl:flex-col xl:items-stretch">
          {canOpenProfile ? (
            <a href={profileUrl} target="_blank" rel="noreferrer" className="btn btn-ghost !py-2 text-sm">
              <ExternalLink size={16} /> Виж профила
            </a>
          ) : (
            <button type="button" disabled className="btn btn-ghost !py-2 text-sm opacity-50">
              <ExternalLink size={16} /> Виж профила
            </button>
          )}
          <button type="button" onClick={onEdit} className="btn btn-primary !py-2 text-sm">
            <Edit3 size={16} /> Редактирай
          </button>
        </div>
      </div>
      {busyMessage && <div className="mt-4 text-xs font-medium text-accent">{busyMessage}</div>}
    </article>
  )
}

function EditUserModal({ entity, canManageAdmins, currentAccount, actionState, onClose, onSave }) {
  const [draft, setDraft] = useState(() => createDraft(entity))
  const [localMessage, setLocalMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const { account, profile } = entity
  const statusValue = getAccountStatusValue(account)
  const isCurrentAction = actionState.id === (account ? `acc_${account.id}` : `prof_${profile?.id}`)

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setLocalMessage('')
    try {
      await onSave(entity, draft)
    } catch (error) {
      setLocalMessage(error.message || 'Промените не бяха запазени.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/35 px-3 py-4 backdrop-blur-sm sm:items-center">
      <form onSubmit={submit} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-line bg-paper p-5 shadow-[0_30px_90px_-45px_rgba(13,35,64,0.65)] md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="eyebrow">Редакция</div>
            <h2 className="mt-2 font-display text-3xl text-ink">{displayName(account, profile)}</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusPill value={statusValue} />
              <RolePill value={draft.role} />
            </div>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line text-muted transition hover:border-ink hover:text-ink" aria-label="Затвори">
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <section className="rounded-3xl border border-line bg-soft/60 p-4">
            <div className="text-sm font-semibold text-ink">Настройки на акаунта</div>
            {account ? (
              <div className="mt-4 space-y-4">
                <StatusSelectControl
                  label="Роля"
                  value={draft.role}
                  onChange={(value) => setDraft((current) => ({
                    ...current,
                    role: value,
                    specialistStatus: value === 'specialist' ? (current.specialistStatus || 'pending') : '',
                  }))}
                  options={getRoleOptions(canManageAdmins)}
                  tone={ROLE_META[draft.role]?.tone}
                  disabled={!canManageAdmins}
                />
                <StatusSelectControl
                  label="Specialist статус"
                  value={draft.specialistStatus}
                  onChange={(value) => setDraft((current) => ({ ...current, specialistStatus: value }))}
                  options={Object.entries(SPECIALIST_STATUS_LABELS)}
                  tone={statusTone(draft.specialistStatus)}
                  disabled={draft.role !== 'specialist'}
                  helper={draft.role !== 'specialist' ? 'Активен е само за специалисти.' : ''}
                />
                <StatusSelectControl
                  label="Account статус"
                  value={draft.accountStatus}
                  onChange={(value) => setDraft((current) => ({ ...current, accountStatus: value }))}
                  options={Object.entries(ACCOUNT_STATUS_LABELS)}
                  tone={draft.accountStatus === 'banned' ? 'danger' : 'success'}
                />
                {account.id === currentAccount?.id && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                    Редактираш собствения си admin акаунт. Ако backend политиките ограничат част от промяната, ще видиш грешка при запазване.
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-line bg-paper p-4 text-sm text-muted">Няма свързан акаунт.</div>
            )}
          </section>

          <section className="rounded-3xl border border-line bg-soft/60 p-4">
            <div className="text-sm font-semibold text-ink">Настройки на профила</div>
            {profile ? (
              <div className="mt-4 space-y-4">
                <button
                  type="button"
                  role="switch"
                  aria-checked={draft.isPublished}
                  onClick={() => setDraft((current) => ({ ...current, isPublished: !current.isPublished }))}
                  className={`flex w-full items-center justify-between gap-4 rounded-2xl border p-3 text-left transition ${draft.isPublished ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-line bg-paper text-muted'}`}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {draft.isPublished ? <Eye size={17} /> : <EyeOff size={17} />}
                    Видим в каталога
                  </span>
                  <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${draft.isPublished ? 'bg-emerald-500' : 'bg-line'}`}>
                    <span className={`inline-block h-5 w-5 rounded-full bg-paper shadow transition ${draft.isPublished ? 'translate-x-5' : 'translate-x-1'}`} />
                  </span>
                </button>
                <StatusSelectControl
                  label="Слой"
                  value={draft.layerSlug}
                  onChange={(value) => setDraft((current) => ({ ...current, layerSlug: value }))}
                  options={LAYERS.map((layer) => [layer.slug, `Слой ${layer.number} · ${layer.title}`])}
                  tone="info"
                />
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-line bg-paper p-4 text-sm text-muted">Няма публичен профил.</div>
            )}
          </section>
        </div>

        {(localMessage || (isCurrentAction && actionState.message)) && (
          <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${toneClass(actionState.tone === 'danger' || localMessage ? 'danger' : actionState.tone)}`}>
            {localMessage || actionState.message}
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="btn btn-ghost justify-center">Затвори</button>
          <button type="submit" disabled={saving} className="btn btn-primary justify-center disabled:opacity-60">
            <Save size={17} /> {saving ? 'Запазваме...' : 'Запази'}
          </button>
        </div>
      </form>
    </div>
  )
}

function StatusSelectControl({ label, value, onChange, options, tone = 'neutral', disabled = false, helper = '' }) {
  return (
    <label className="block text-sm font-medium text-ink">
      {label}
      <span className="relative mt-2 block">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className={`${ADMIN_SELECT_CLASS} !mt-0 w-full appearance-none rounded-2xl border px-4 py-3 pr-11 font-semibold disabled:opacity-55 ${toneClass(tone)}`}
        >
          {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
        </select>
        <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-current" />
      </span>
      {helper && <span className="mt-1 block text-xs font-normal text-muted">{helper}</span>}
    </label>
  )
}

function Avatar({ account, profile }) {
  return (
    <div className="mt-1 h-14 w-14 shrink-0 overflow-hidden rounded-full border border-line bg-soft">
      {profile ? (
        <img src={getProfileImage(profile)} alt="" className="img-cover" style={getProfileImageStyle(profile)} />
      ) : (
        <div className="flex h-full items-center justify-center font-display text-2xl text-muted">
          {displayName(account, profile).charAt(0).toUpperCase()}
        </div>
      )}
    </div>
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

function getRoleOptions(canManageAdmins) {
  const roles = Object.entries(ACCOUNT_ROLE_LABELS)
  return canManageAdmins ? roles : roles.filter(([value]) => value !== 'admin')
}

function getAccountStatusValue(account) {
  if (!account) return 'active'
  if (account.account_status === 'banned') return 'banned'
  if (account.role === 'specialist') return account.specialist_status || 'pending'
  return 'active'
}

function createDraft({ account, profile }) {
  return {
    role: account?.role || 'user',
    specialistStatus: account?.specialist_status || (account?.role === 'specialist' ? 'pending' : ''),
    accountStatus: account?.account_status === 'banned' ? 'banned' : 'active',
    isPublished: Boolean(profile?.isPublished),
    layerSlug: profile?.layerSlug || LAYERS[0]?.slug || '',
  }
}

function buildAccountUpdates(account, draft) {
  const updates = {}
  const nextRole = draft.role || 'user'
  const nextSpecialistStatus = nextRole === 'specialist' ? (draft.specialistStatus || 'pending') : null
  const nextAccountStatus = draft.accountStatus || 'active'

  if (nextRole !== (account.role || 'user')) updates.role = nextRole
  if (nextSpecialistStatus !== (account.specialist_status || null)) updates.specialistStatus = nextSpecialistStatus
  if (nextAccountStatus !== (account.account_status || 'active')) updates.accountStatus = nextAccountStatus

  return updates
}

function buildProfileUpdates(profile, draft) {
  const updates = {}
  if (Boolean(draft.isPublished) !== Boolean(profile.isPublished)) updates.is_published = Boolean(draft.isPublished)
  if (draft.layerSlug && draft.layerSlug !== profile.layerSlug) updates.layer_slug = draft.layerSlug
  return updates
}

function mapLocalUpdates(updates) {
  const next = { last_admin_action_at: new Date().toISOString() }
  if ('role' in updates) next.role = updates.role
  if ('specialistStatus' in updates) next.specialist_status = updates.specialistStatus
  if ('accountStatus' in updates) next.account_status = updates.accountStatus
  return next
}

function StatusPill({ value }) {
  const meta = ACCOUNT_STATUS_META[value] || ACCOUNT_STATUS_META.active
  const Icon = meta.icon || ShieldCheck
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${toneClass(meta.tone)}`}>
      <Icon size={13} />
      {meta.label}
    </span>
  )
}

function RolePill({ value }) {
  const meta = ROLE_META[value] || ROLE_META.user
  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${toneClass(meta.tone)}`}>{meta.label}</span>
}

function statusTone(value) {
  if (value === 'approved') return 'success'
  if (value === 'pending') return 'warning'
  if (value === 'rejected' || value === 'banned') return 'danger'
  return 'neutral'
}

function toneClass(tone = 'neutral') {
  return TONE_CLASSES[tone] || TONE_CLASSES.neutral
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
