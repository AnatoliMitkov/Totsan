import { ArrowUpRight, CalendarDays, Clock3, Link2, MapPin, Phone, Video } from 'lucide-react'

const channelMeta = { video: { label: 'Видео разговор', Icon: Video }, phone: { label: 'Телефон', Icon: Phone }, in_person: { label: 'На място', Icon: MapPin } }

function safeExternalUrl(value = '') {
  try {
    const url = new URL(String(value).trim())
    return ['http:', 'https:'].includes(url.protocol) ? url.href : ''
  } catch {
    return ''
  }
}

export default function CallInviteCard({ call, own, onAccept, onDecline, onReschedule }) {
  const channel = channelMeta[call.channel] || channelMeta.video
  const startsAt = call.startsAt ? new Date(call.startsAt) : null
  const validDate = startsAt && !Number.isNaN(startsAt.getTime())
  const status = { accepted: 'Приет', declined: 'Отказан', cancelled: 'Отменен', pending: 'Очаква отговор' }[call.status] || 'Очаква отговор'
  const locationUrl = safeExternalUrl(call.location)
  return <section className="w-full rounded-2xl border border-accentDeep/20 bg-paper p-4 text-ink shadow-[0_16px_32px_-28px_rgba(22,62,162,.4)]">
    <div className="flex items-start justify-between gap-3"><div><div className="text-[11px] font-semibold uppercase tracking-[.14em] text-accentDeep">{validDate ? 'Предложен разговор' : 'Покана за разговор'}</div><h3 className="mt-1 text-base font-semibold">{call.purpose}</h3></div><span className="rounded-full bg-accentSoft px-2.5 py-1 text-xs font-semibold text-accentDeep">{status}</span></div>
    <div className="mt-4 grid gap-2 text-sm text-muted"><div className="flex items-center gap-2"><Clock3 size={16} className="text-accentDeep" />{call.duration} минути</div><div className="flex items-center gap-2"><channel.Icon size={16} className="text-accentDeep" />{channel.label}</div>{validDate && <div className="flex items-center gap-2 font-medium text-ink"><CalendarDays size={16} className="text-accentDeep" />{startsAt.toLocaleString('bg-BG', { dateStyle: 'medium', timeStyle: 'short' })}</div>}{locationUrl ? <a href={locationUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex w-fit items-center gap-2 rounded-xl border border-line bg-soft px-3 py-2 text-sm font-medium text-accentDeep transition hover:border-accentDeep/35 hover:bg-accentSoft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accentDeep/25"><Link2 size={16} />Отвори линка<ArrowUpRight size={15} /></a> : call.location && !call.location.includes('[скрито от Totsan') && <div className="flex items-start gap-2"><MapPin size={16} className="mt-0.5 shrink-0 text-accentDeep" /><span className="break-words">{call.location}</span></div>}</div>
    {call.note && <p className="mt-4 rounded-xl bg-soft px-3 py-2.5 text-sm leading-6 text-ink">{call.note}</p>}
    {!own && call.status === 'pending' && <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={onAccept} className="btn btn-primary px-4 py-2 text-sm">Приеми</button><button type="button" onClick={onReschedule} className="btn btn-ghost px-4 py-2 text-sm">Предложи друг час</button><button type="button" onClick={onDecline} className="px-3 py-2 text-sm font-medium text-muted transition hover:text-red-700">Откажи</button></div>}
  </section>
}
