import { useEffect, useState } from 'react'
import { CheckCircle2, Mail, User, Clock } from 'lucide-react'
import { loadPartnerInquiries, updatePartnerInquiryStatus } from '../../lib/partner-inquiries.js'
import { formatAdminDate } from '../../lib/admin.js'

export default function PartnerInquiries({ profileSlug }) {
  const [inquiries, setInquiries] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      if (!profileSlug) return
      try {
        const rows = await loadPartnerInquiries(profileSlug)
        if (!active) return
        setInquiries(rows)
        setStatus('ready')
      } catch (err) {
        if (!active) return
        setError(err.message || 'Не успяхме да заредим запитванията.')
        setStatus('error')
      }
    }
    load()
    return () => { active = false }
  }, [profileSlug])

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
      await updatePartnerInquiryStatus(id, 'completed')
      setInquiries(current => current.map(item => item.id === id ? { ...item, status: 'completed' } : item))
    } catch (err) {
      console.error(err)
    }
  }

  if (status === 'loading') {
    return <div className="rounded-3xl border border-line bg-paper p-5 md:p-7 text-center text-muted">Зареждане на запитвания...</div>
  }

  if (status === 'error') {
    return <div className="rounded-3xl border border-red-200 bg-red-50 p-5 md:p-7 text-red-700">{error}</div>
  }

  const activeInquiries = inquiries.filter(i => i.status === 'new' || i.status === 'seen')
  const pastInquiries = inquiries.filter(i => i.status === 'completed' || i.status === 'spam' || i.status === 'rejected')

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
          {activeInquiries.map(inq => (
            <div key={inq.id} className={`rounded-3xl border p-5 md:p-7 transition-colors ${inq.status === 'new' ? 'border-accent/30 bg-accent/5' : 'border-line bg-paper'}`}>
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
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
                <div className="flex flex-col gap-2 min-w-[140px]">
                  {inq.status === 'new' && <button type="button" onClick={() => markAsSeen(inq.id)} className="btn btn-primary w-full justify-center text-sm">Маркирай като видяно</button>}
                  <button type="button" onClick={() => markAsDone(inq.id)} className="btn btn-ghost w-full justify-center text-sm"><CheckCircle2 size={16} /> Приключи</button>
                </div>
              </div>
              <div className="mt-4 rounded-2xl bg-white/60 p-4 text-sm text-ink whitespace-pre-wrap border border-line/50">
                {inq.message}
              </div>
            </div>
          ))}
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
