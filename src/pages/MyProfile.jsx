import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { getAccountDisplayName, useAccount } from '../lib/account.js'
import { uploadProfileMedia } from '../lib/profile-media-upload-client.js'
import { LAYERS } from '../data/layers.js'
import CustomerHeader from '../components/profile/CustomerHeader.jsx'
import CustomerOverview from '../components/profile/CustomerOverview.jsx'
import CustomerPersonal from '../components/profile/CustomerPersonal.jsx'
import CustomerProject from '../components/profile/CustomerProject.jsx'
import CompletenessBar from '../components/profile/CompletenessBar.jsx'
import PartnerProfileWorkspace from '../components/profile/PartnerProfileWorkspace.jsx'
import {
  calculateClientProfileCompleteness,
  deleteClientProjectMedia,
  loadActiveClientProject,
  saveActiveClientProject,
  saveCustomerAccountProfile,
  updateClientProjectMedia,
  uploadClientProjectMedia,
} from '../lib/projects.js'
import {
  PROFILE_SELECT_COLUMNS,
  getProfileImage,
  getProfileImageStyle,
  normalizeProfile,
  slugify,
} from '../lib/profiles.js'

const INPUT = 'mt-2 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-sm outline-none transition focus:border-ink'

export default function MyProfile() {
  const { session, account, loading, refresh } = useAccount()

  if (loading) {
    return <div className="section"><div className="container-page text-muted">Зареждане…</div></div>
  }

  if (!session) {
    return (
      <section className="section">
        <div className="container-page max-w-xl">
          <h1 className="h-section">Моят профил</h1>
          <p className="text-muted mt-3">За да видиш профила си, трябва първо да влезеш в акаунта си.</p>
          <Link to="/login" className="btn btn-primary mt-6 inline-flex">Вход</Link>
        </div>
      </section>
    )
  }

  if (account?.role === 'specialist') {
    return <ProEditor session={session} account={account} />
  }

  return <CustomerProfile session={session} account={account} refreshAccount={refresh} />
}

function CustomerProfile({ session, account, refreshAccount }) {
  const [mode, setMode] = useState('profile')
  const [activeTab, setActiveTab] = useState('overview')
  const [localAccount, setLocalAccount] = useState(account)
  const [project, setProject] = useState(null)
  const [media, setMedia] = useState([])
  const [loadState, setLoadState] = useState({ status: 'loading', message: '' })
  const email = session.user.email || account?.email || ''
  const userId = session.user.id
  const displayName = getAccountDisplayName(localAccount, session, 'приятел')
  const isAdmin = localAccount?.role === 'admin'

  useEffect(() => {
    setLocalAccount(account)
  }, [account])

  useEffect(() => {
    let active = true
    async function loadProject() {
      setLoadState({ status: 'loading', message: '' })
      try {
        const data = await loadActiveClientProject(userId)
        if (!active) return
        setProject(data.project)
        setMedia(data.media)
        setLoadState({ status: 'ready', message: '' })
      } catch (error) {
        if (!active) return
        setLoadState({ status: 'error', message: error.message || 'Проектът не успя да зареди.' })
      }
    }
    loadProject()
    return () => { active = false }
  }, [userId])

  const completeness = useMemo(() => calculateClientProfileCompleteness({
    account: localAccount,
    session,
    project,
    media,
  }), [localAccount, session, project, media])

  async function savePersonal(values) {
    const savedAccount = await saveCustomerAccountProfile(values)
    setLocalAccount(savedAccount)
    await refreshAccount?.()
    return savedAccount
  }

  async function uploadAvatar(file) {
    const result = await uploadProfileMedia({ file, target: userId })
    return result.publicUrl
  }

  async function saveProject(projectDraft) {
    const savedProject = await saveActiveClientProject(userId, projectDraft, projectDraft.id || project?.id || '')
    setProject(savedProject)
    return savedProject
  }

  async function uploadProjectMediaRow({ file, projectId, kind, caption, orderIndex }) {
    const nextMedia = await uploadClientProjectMedia({ file, userId, projectId, kind, caption, orderIndex })
    setMedia(current => [...current, nextMedia])
    return nextMedia
  }

  async function updateProjectMediaRow(mediaId, updates) {
    const updated = await updateClientProjectMedia(mediaId, updates)
    setMedia(current => current.map(item => item.id === mediaId ? { ...item, ...updated, url: updated.url || item.url, signedUrl: updated.signedUrl || item.signedUrl } : item))
    return updated
  }

  async function deleteProjectMediaRow(mediaId) {
    await deleteClientProjectMedia(mediaId)
    setMedia(current => current.filter(item => item.id !== mediaId))
  }

  if (mode === 'application') {
    return (
      <CenteredCard title="Стани партньор">
        <p className="text-muted mt-3">Попълни кратка заявка и ще я прегледаме от админ панела.</p>
        <ApplicationForm userId={userId} email={email} initialName={displayName} onCreated={() => setMode('sent')} />
      </CenteredCard>
    )
  }

  if (mode === 'sent') {
    return (
      <CenteredCard title="Заявката е изпратена">
        <p className="text-muted mt-3">Ще я прегледаме и след одобрение тук ще се появи редакторът на професионалния ти профил.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button className="btn btn-primary" onClick={() => setMode('overview')}>Към профила</button>
          <button className="btn btn-ghost" onClick={() => supabase.auth.signOut()}>Изход</button>
        </div>
      </CenteredCard>
    )
  }

  return (
    <section className="section bg-soft min-h-screen">
      <div className="container-page space-y-5">
        <CustomerHeader account={localAccount} displayName={displayName} completeness={completeness} onSignOut={() => supabase.auth.signOut()} />

        <div className="flex flex-wrap items-center gap-2 rounded-3xl border border-line bg-paper p-2">
          {[
            ['overview', 'Преглед'],
            ['personal', 'Лични данни'],
            ['project', 'Моят проект'],
            ['activity', 'Активност'],
          ].map(([tab, label]) => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`rounded-full px-4 py-2 text-sm transition ${activeTab === tab ? 'bg-ink text-paper' : 'text-muted hover:bg-soft hover:text-ink'}`}>
              {label}
            </button>
          ))}
          <button type="button" onClick={() => setMode('application')} className="ml-auto rounded-full border border-line px-4 py-2 text-sm text-ink transition hover:border-ink">
            Стани партньор
          </button>
        </div>

        {loadState.status === 'error' && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{loadState.message}</div>
        )}

        {loadState.status === 'loading' && (
          <div className="rounded-2xl border border-line bg-paper p-5 text-sm text-muted">Зареждаме проекта…</div>
        )}

        {activeTab === 'overview' && (
          <CustomerOverview
            account={localAccount}
            project={project}
            media={media}
            completeness={completeness}
            isAdmin={isAdmin}
            onSelectTab={setActiveTab}
          />
        )}

        {activeTab === 'personal' && (
          <CustomerPersonal
            account={localAccount}
            session={session}
            onSave={savePersonal}
            onUploadAvatar={uploadAvatar}
          />
        )}

        {activeTab === 'project' && (
          <CustomerProject
            project={project}
            media={media}
            onSave={saveProject}
            onUploadMedia={uploadProjectMediaRow}
            onUpdateMedia={updateProjectMediaRow}
            onDeleteMedia={deleteProjectMediaRow}
          />
        )}

        {activeTab === 'activity' && <CustomerActivity account={localAccount} completeness={completeness} />}
      </div>
    </section>
  )
}

function CustomerActivity({ account, completeness }) {
  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <div className="lg:col-span-8 rounded-3xl border border-line bg-paper p-5 md:p-7">
        <div className="eyebrow">Активност</div>
        <h2 className="mt-2 font-display text-3xl text-ink">История на профила</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <ActivityTile label="Регистриран" value={account?.created_at ? new Date(account.created_at).toLocaleDateString('bg-BG') : 'Скоро'} />
          <ActivityTile label="Запитвания" value="Скоро" />
          <ActivityTile label="Активни разговори" value="Скоро" />
        </div>
      </div>
      <aside className="lg:col-span-4">
        <CompletenessBar completeness={completeness} />
      </aside>
    </div>
  )
}

function ActivityTile({ label, value }) {
  return (
    <div className="rounded-2xl border border-line bg-soft p-4">
      <div className="text-xs uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="mt-1 font-medium text-ink">{value}</div>
    </div>
  )
}

function ProEditor({ session, account }) {
  const userId = session.user.id
  const email = session.user.email
  const displayName = getAccountDisplayName(account, session, email?.split('@')[0] || '')

  const [status, setStatus] = useState('loading') // loading | needs_application | pending | ready | error
  const [profile, setProfile] = useState(null)
  const [application, setApplication] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setStatus('loading')
    setError('')

    const [profRes, appRes] = await Promise.all([
      supabase.from('profiles').select(PROFILE_SELECT_COLUMNS).eq('user_id', userId).maybeSingle(),
      supabase.from('partner_applications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])

    if (profRes.error && profRes.error.code !== 'PGRST116') {
      setError(profRes.error.message)
      setStatus('error')
      return
    }

    if (profRes.data) {
      setProfile(normalizeProfile(profRes.data))
      setStatus('ready')
      return
    }

    if (appRes.data) {
      setApplication(appRes.data)
      setStatus(appRes.data.status === 'rejected' ? 'rejected' : 'pending')
      return
    }

    setStatus('needs_application')
  }

  if (status === 'loading') {
    return <div className="section"><div className="container-page text-muted">Зареждане…</div></div>
  }

  if (status === 'error') {
    return (
      <section className="section">
        <div className="container-page max-w-xl">
          <h1 className="h-section">Моят профил</h1>
          <p className="text-red-700 text-sm mt-4">{error}</p>
        </div>
      </section>
    )
  }

  if (status === 'needs_application') {
    return (
      <CenteredCard title="Стани партньор">
        <p className="text-muted mt-3">Нямаш активна заявка. Регистрирай се като специалист, за да получиш профил в Totsan.</p>
        <ApplicationForm userId={userId} email={email} initialName={displayName} onCreated={load} />
      </CenteredCard>
    )
  }

  if (status === 'pending') {
    return (
      <CenteredCard title="Заявката ти се преглежда">
        <p className="text-muted mt-3">Получихме регистрацията ти{application?.created_at ? ` на ${new Date(application.created_at).toLocaleDateString('bg-BG')}` : ''}. Ще те уведомим веднага щом профилът е активиран.</p>
        <div className="mt-6 flex gap-2">
          <Link to="/" className="btn btn-ghost">Към сайта</Link>
          <button className="btn btn-primary" onClick={() => supabase.auth.signOut()}>Изход</button>
        </div>
      </CenteredCard>
    )
  }

  if (status === 'rejected') {
    return (
      <CenteredCard title="Заявката не е одобрена">
        <p className="text-muted mt-3">За съжаление в момента не можем да активираме профил за този акаунт.{application?.decision_note ? ` Бележка: ${application.decision_note}` : ''}</p>
        <div className="mt-6 flex gap-2">
          <Link to="/contact" className="btn btn-ghost">Свържи се с нас</Link>
          <button className="btn btn-primary" onClick={() => supabase.auth.signOut()}>Изход</button>
        </div>
      </CenteredCard>
    )
  }

  return <PartnerProfileWorkspace profile={profile} userId={userId} account={account} onSaved={load} />
}

function CenteredCard({ title, children }) {
  return (
    <section className="section">
      <div className="container-page max-w-xl">
        <div className="rounded-3xl border border-line bg-paper p-8">
          <h1 className="h-section">{title}</h1>
          {children}
        </div>
      </div>
    </section>
  )
}

function ApplicationForm({ userId, email, initialName = '', onCreated }) {
  const [name, setName] = useState(initialName)
  const [phone, setPhone] = useState('')
  const [layerSlug, setLayerSlug] = useState(LAYERS[0]?.slug || '')
  const [about, setAbout] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setErr('')
    const { error } = await supabase.from('partner_applications').insert({
      name: name.trim(),
      email,
      phone: phone.trim() || null,
      layer_slug: layerSlug,
      about: about.trim() || null,
      user_id: userId,
      role: 'pro',
      status: 'pending',
    })
    setBusy(false)
    if (error) { setErr(error.message); return }
    onCreated?.()
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <label className="block text-sm font-medium text-ink">Име / фирма<input value={name} onChange={e => setName(e.target.value)} required className={INPUT} /></label>
      <label className="block text-sm font-medium text-ink">Телефон<input value={phone} onChange={e => setPhone(e.target.value)} type="tel" className={INPUT} /></label>
      <label className="block text-sm font-medium text-ink">В кой слой работиш<select value={layerSlug} onChange={e => setLayerSlug(e.target.value)} className={INPUT}>{LAYERS.map(l => <option key={l.slug} value={l.slug}>Слой {l.number} · {l.title}</option>)}</select></label>
      <label className="block text-sm font-medium text-ink">Кратко представяне<textarea value={about} onChange={e => setAbout(e.target.value)} rows={4} className={INPUT} /></label>
      {err && <div className="text-sm text-red-700">{err}</div>}
      <button disabled={busy} className="btn btn-primary w-full justify-center">{busy ? 'Изпращане…' : 'Изпрати заявка'}</button>
    </form>
  )
}

function ProForm({ profile, userId, onSaved }) {
  const [draft, setDraft] = useState({
    name: profile.name,
    tag: profile.tag,
    city: profile.city,
    bio: profile.bio,
    imageUrl: profile.imageUrl,
    imageZoom: profile.imageZoom,
    imageX: profile.imageX,
    imageY: profile.imageY,
    layerSlug: profile.layerSlug,
    since: profile.since,
  })
  const [save, setSave] = useState({ status: 'idle', message: '' })

  function update(key, value) { setDraft(d => ({ ...d, [key]: value })) }

  const preview = useMemo(() => normalizeProfile({
    ...profile,
    ...draft,
    layer_slug: draft.layerSlug,
    image_url: draft.imageUrl,
    image_zoom: draft.imageZoom,
    image_x: draft.imageX,
    image_y: draft.imageY,
  }), [draft, profile])

  async function uploadImage(file) {
    if (!file) return
    setSave({ status: 'uploading', message: 'Оптимизираме и качваме снимката…' })
    try {
      const result = await uploadProfileMedia({ file, target: userId })
      update('imageUrl', result.publicUrl)
      const reuseMessage = result.reused ? 'Същото изображение вече съществува и го използвахме повторно.' : 'Снимката е качена.'
      const compressMessage = result.precompressed ? ' Преди upload я компресирахме локално.' : ''
      setSave({ status: 'uploaded', message: `${reuseMessage}${compressMessage} Натисни „Запази“.` })
    } catch (error) {
      setSave({ status: 'error', message: error.message || 'Качването не успя.' })
    }
  }

  async function submit(e) {
    e.preventDefault()
    setSave({ status: 'saving', message: 'Запазваме…' })
    const { error } = await supabase.from('profiles').update({
      name: draft.name.trim(),
      tag: draft.tag.trim(),
      city: draft.city.trim(),
      bio: draft.bio.trim(),
      image_url: draft.imageUrl.trim(),
      image_zoom: Number(draft.imageZoom),
      image_x: Number(draft.imageX),
      image_y: Number(draft.imageY),
      layer_slug: draft.layerSlug,
      since: Number(draft.since),
    }).eq('id', profile.id)
    if (error) { setSave({ status: 'error', message: error.message }); return }
    setSave({ status: 'saved', message: 'Профилът е запазен.' })
    onSaved?.()
  }

  return (
    <section className="section bg-soft min-h-screen">
      <div className="container-page">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-8">
          <div>
            <div className="eyebrow">Моят профил</div>
            <h1 className="h-section mt-2">Редактирай информацията си.</h1>
            <p className="text-muted text-sm mt-2">
              {profile.isPublished ? 'Профилът ти е публикуван.' : 'Профилът още не е публикуван — администратор го преглежда.'}
              {profile.slug && profile.isPublished && <> Линк: <Link to={`/profil/${profile.slug}`} className="text-accent hover:underline">/profil/{profile.slug}</Link></>}
            </p>
          </div>
          <button className="btn btn-ghost" onClick={() => supabase.auth.signOut()}>Изход</button>
        </div>

        <form onSubmit={submit} className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8 rounded-3xl border border-line bg-paper p-6 md:p-8 space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-ink">Име / фирма<input value={draft.name} onChange={e => update('name', e.target.value)} className={INPUT} /></label>
              <label className="block text-sm font-medium text-ink">Роля / етикет<input value={draft.tag} onChange={e => update('tag', e.target.value)} className={INPUT} placeholder="Архитект, Майстор..." /></label>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="block text-sm font-medium text-ink">Град<input value={draft.city} onChange={e => update('city', e.target.value)} className={INPUT} /></label>
              <label className="block text-sm font-medium text-ink">От година<input type="number" min="1900" max="2100" value={draft.since} onChange={e => update('since', e.target.value)} className={INPUT} /></label>
              <label className="block text-sm font-medium text-ink">Слой<select value={draft.layerSlug} onChange={e => update('layerSlug', e.target.value)} className={INPUT}>{LAYERS.map(l => <option key={l.slug} value={l.slug}>Слой {l.number} · {l.title}</option>)}</select></label>
            </div>
            <label className="block text-sm font-medium text-ink">Кратко за теб<textarea rows={6} value={draft.bio} onChange={e => update('bio', e.target.value)} className={INPUT} /></label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-ink">URL на снимка<input value={draft.imageUrl} onChange={e => update('imageUrl', e.target.value)} className={INPUT} placeholder="https://..." /></label>
              <label className="block text-sm font-medium text-ink">Качи файл<input type="file" accept="image/*" className={`${INPUT} file:mr-3 file:rounded-full file:border-0 file:bg-soft file:px-4 file:py-2 file:text-sm file:font-medium`} onChange={async (e) => { await uploadImage(e.target.files?.[0]); e.target.value = '' }} /></label>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Range label="Zoom" value={draft.imageZoom} min={1} max={2.5} step={0.05} onChange={(v) => update('imageZoom', v)} />
              <Range label="Ляво / дясно" value={draft.imageX} min={0} max={100} step={1} onChange={(v) => update('imageX', v)} />
              <Range label="Горе / долу" value={draft.imageY} min={0} max={100} step={1} onChange={(v) => update('imageY', v)} />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
              <div className={`text-sm ${save.status === 'error' ? 'text-red-700' : 'text-muted'}`}>{save.message || 'Промените се отразяват веднага след запазване.'}</div>
              <button className="btn btn-primary" disabled={save.status === 'saving'}>{save.status === 'saving' ? 'Запазва се…' : 'Запази'}</button>
            </div>
          </div>

          <aside className="lg:col-span-4">
            <div className="rounded-3xl border border-line bg-paper p-6 sticky top-24">
              <div className="eyebrow">Преглед</div>
              <div className="mt-4 flex items-center gap-4">
                <div className="h-20 w-20 overflow-hidden rounded-full border border-line bg-soft">
                  <img src={getProfileImage(preview)} alt={preview.name} className="img-cover" style={getProfileImageStyle(preview)} />
                </div>
                <div>
                  <div className="font-display text-xl">{preview.name}</div>
                  <div className="text-sm text-muted">{preview.tag} · {preview.city}</div>
                </div>
              </div>
              <p className="mt-4 text-sm text-muted whitespace-pre-wrap">{preview.bio}</p>
            </div>
          </aside>
        </form>
      </div>
    </section>
  )
}

function Range({ label, value, min, max, step, onChange }) {
  return (
    <label className="block text-sm font-medium text-ink">
      <span className="flex items-center justify-between gap-4"><span>{label}</span><span className="text-xs text-muted">{Number(value).toFixed(step < 1 ? 2 : 0)}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-3 w-full accent-black" />
    </label>
  )
}
