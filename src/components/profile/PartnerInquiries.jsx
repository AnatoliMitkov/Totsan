import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Mail, User, Clock } from 'lucide-react'
import { loadPartnerInquiries, updatePartnerInquiryStatus, loadInquiryProjects } from '../../lib/partner-inquiries.js'
import { formatAdminDate } from '../../lib/admin.js'
import { createConversationWithClient } from '../../lib/chat.js'
import { useNavigate } from 'react-router-dom'
import { LAYERS } from '../../data/layers.js'
import { formatMoneyRange } from '../../lib/money.js'

export default function PartnerInquiries({ profileSlug, partnerId }) {
  const navigate = useNavigate()
  const [inquiries, setInquiries] = useState([])
  const [projects, setProjects] = useState({})
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [chatAction, setChatAction] = useState({ id: '', status: 'idle', message: '' })
  const openingInquiryRef = useRef('')

  useEffect(() => {
    let active = true
    async function load() {
      if (!profileSlug) return
      try {
        const rows = await loadPartnerInquiries(profileSlug, partnerId)
        
        // Fetch client projects for inquiries that have a client_id
        const clientIds = rows.map(r => r.client_id).filter(Boolean)
        const uniqueClientIds = [...new Set(clientIds)]
        
        let projectMap = {}
        if (uniqueClientIds.length > 0) {
          const fetchedProjects = await loadInquiryProjects(uniqueClientIds)
          fetchedProjects.forEach(p => { projectMap[p.user_id] = p })
        }
        
        if (!active) return
        setInquiries(rows)
        setProjects(projectMap)
        setStatus('ready')
      } catch (err) {
        if (!active) return
        setError(err.message || 'Не успяхме да заредим запитванията.')
        setStatus('error')
      }
    }
    load()
    return () => { active = false }
  }, [partnerId, profileSlug])

  async function markAsSeen(id) {
    try {
      await updatePartnerInquiryStatus(id, 'seen')
      setInquiries(current => current.map(item => item.id === id ? { ...item, status: 'seen' } : item))
    } catch (err) {
      console.error(err)
    }
  }

  async function markAsDone(id) {
    try {
      await updatePartnerInquiryStatus(id, 'closed')
      setInquiries(current => current.map(item => item.id === id ? { ...item, status: 'closed' } : item))
    } catch (err) {
      console.error(err)
    }
  }

  async function startChat(clientId, inquiryId) {
    if (openingInquiryRef.current) return

    openingInquiryRef.current = inquiryId
    setChatAction({ id: inquiryId, status: 'opening', message: 'Отваряме защитен чат...' })

    try {
      const conv = await createConversationWithClient({ clientId, partnerId, subject: 'Връзка по ваше запитване' })
      await markAsSeen(inquiryId)
      setChatAction({ id: inquiryId, status: 'opened', message: '' })
      navigate(`/inbox/${conv.id}`)
    } catch (err) {
      openingInquiryRef.current = ''
      setChatAction({
        id: inquiryId,
        status: 'error',
        message: err.message || 'Чатът не се отвори. Опитай пак след малко.',
      })
    }
  }

  function getLayerTitle(slug) {
    return LAYERS.find(l => l.slug === slug)?.title || slug
  }

  if (status === 'loading') {
    return <div className="rounded-3xl border border-line bg-paper p-5 md:p-7 text-center text-muted">Зареждане на запитвания...</div>
  }

  if (status === 'error') {
    return <div className="rounded-3xl border border-red-200 bg-red-50 p-5 md:p-7 text-red-700">{error}</div>
  }

  const activeInquiries = inquiries.filter(i => i.status === 'new' || i.status === 'seen' || i.status === 'replied')
  const pastInquiries = inquiries.filter(i => i.status === 'closed')

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-line bg-paper p-5 md:p-7">
        <div className="eyebrow">Запитвания от клиенти</div>
        <h2 className="mt-2 font-display text-3xl text-ink">Директни запитвания от профила ти</h2>
        <p className="mt-2 text-sm text-muted">Тук се появяват съобщенията от клиенти, които са използвали формата "Поискай оферта".</p>
      </div>

      {activeInquiries.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-display text-2xl text-ink">Активни запитвания ({activeInquiries.length})</h3>
          {activeInquiries.map(inq => {
            const project = inq.client_id ? projects[inq.client_id] : null
            const isOpeningChat = chatAction.id === inq.id && chatAction.status === 'opening'
            const chatError = chatAction.id === inq.id && chatAction.status === 'error' ? chatAction.message : ''

            return (
              <div key={inq.id} className={`overflow-hidden rounded-3xl border p-5 transition-colors md:p-7 ${inq.status === 'new' ? 'border-accent/30 bg-accent/5' : 'border-line bg-paper'}`}>
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-medium text-ink">
                      <User size={18} className="text-accentDeep" /> {inq.name}
                      {inq.status === 'new' && <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-white">Ново</span>}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-sm text-muted">
                      <Mail size={16} /> <a href={inq.contact.includes('@') ? `mailto:${inq.contact}` : `tel:${inq.contact}`} className="hover:text-accent hover:underline">{inq.contact}</a>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted">
                      <Clock size={14} /> {formatAdminDate(inq.created_at)}
                    </div>
                  </div>
                  <div className="flex w-full flex-col gap-2 md:w-[13rem] md:min-w-[13rem]">
                    {inq.client_id && (
                      <button
                        type="button"
                        onClick={() => startChat(inq.client_id, inq.id)}
                        disabled={isOpeningChat}
                        className="btn btn-primary w-full justify-center text-sm disabled:cursor-wait disabled:opacity-60"
                      >
                        {isOpeningChat ? 'Отваряме...' : 'Започни чат'}
                      </button>
                    )}
                    {inq.status === 'new' && <button type="button" onClick={() => markAsSeen(inq.id)} className="btn btn-ghost w-full justify-center text-sm border border-line">Маркирай като видяно</button>}
                    <button type="button" onClick={() => markAsDone(inq.id)} className="btn btn-ghost w-full justify-center text-sm text-muted hover:text-ink"><CheckCircle2 size={16} /> Приключи</button>
                    {chatError && <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{chatError}</div>}
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  <div className="rounded-2xl bg-white/60 p-4 text-sm text-ink whitespace-pre-wrap border border-line/50 relative">
                    <div className="absolute -top-2 left-4 bg-white px-2 text-xs font-medium text-muted uppercase tracking-wider">Съобщение</div>
                    {inq.message}
                  </div>

                  {project && (
                    <div className="rounded-2xl bg-soft p-4 md:p-5 border border-line">
                      <div className="mb-3 text-xs font-medium text-muted uppercase tracking-wider">Данни за имота на клиента</div>
                      <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                        {project.property_type && (
                          <div>
                            <div className="text-muted text-xs uppercase tracking-wider mb-1">Тип</div>
                            <div className="font-medium text-ink capitalize">{project.property_type}</div>
                          </div>
                        )}
                        {project.area_sqm && (
                          <div>
                            <div className="text-muted text-xs uppercase tracking-wider mb-1">Квадратура</div>
                            <div className="font-medium text-ink">{project.area_sqm} м²</div>
                          </div>
                        )}
                        {project.budget_min && (
                          <div>
                            <div className="text-muted text-xs uppercase tracking-wider mb-1">Бюджет</div>
                            <div className="font-medium text-ink">{formatMoneyRange(project.budget_min, project.budget_max, project.budget_currency)}</div>
                          </div>
                        )}
                        {project.address_city && (
                          <div>
                            <div className="text-muted text-xs uppercase tracking-wider mb-1">Локация</div>
                            <div className="font-medium text-ink">{project.address_city} {project.address_region ? `, ${project.address_region}` : ''}</div>
                          </div>
                        )}
                      </div>
                      
                      {project.idea_description && (
                        <div className="mt-4 pt-4 border-t border-line/50">
                          <div className="text-muted text-xs uppercase tracking-wider mb-1">Идея за ремонта</div>
                          <p className="text-ink text-sm">{project.idea_description}</p>
                        </div>
                      )}
                      
                      {project.current_layer_slug && (
                        <div className="mt-3">
                          <span className="inline-block rounded-full bg-white px-3 py-1 text-xs font-medium text-ink border border-line">
                            Текущ етап: {getLayerTitle(project.current_layer_slug)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {!project && inq.client_id && (
                    <div className="text-xs text-muted italic">Клиентът е регистриран, но все още не е попълнил данни за проекта си.</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {pastInquiries.length > 0 && (
        <div className="space-y-3 pt-5">
          <h3 className="font-display text-2xl text-ink">Приключени ({pastInquiries.length})</h3>
          {pastInquiries.map(inq => (
            <div key={inq.id} className="rounded-3xl border border-line bg-soft p-5 opacity-75">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="font-medium text-ink">{inq.name}</div>
                  <div className="text-sm text-muted">{inq.contact}</div>
                </div>
                <div className="text-xs text-muted">{formatAdminDate(inq.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {inquiries.length === 0 && (
        <div className="rounded-3xl border border-dashed border-line bg-paper p-10 text-center text-muted">
          Все още нямаш директни запитвания.
        </div>
      )}
    </div>
  )
}
