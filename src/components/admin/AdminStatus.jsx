import { AlertCircle, CheckCircle2, Eye, MessageSquareReply, XCircle } from 'lucide-react'
import TotsanSelect from '../ui/TotsanSelect.jsx'

export const INQUIRY_STATUS_META = {
  new: {
    label: 'Ново',
    tone: 'info',
    icon: AlertCircle,
  },
  seen: {
    label: 'Прегледано',
    tone: 'warning',
    icon: Eye,
  },
  replied: {
    label: 'Отговорено',
    tone: 'success',
    icon: MessageSquareReply,
  },
  closed: {
    label: 'Затворено',
    tone: 'neutral',
    icon: CheckCircle2,
  },
}

const TONE_CLASSES = {
  info: 'border-sky-200 bg-sky-50 text-sky-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  danger: 'border-red-200 bg-red-50 text-red-800',
  neutral: 'border-line bg-soft text-muted',
}

export function statusToneClass(tone = 'neutral') {
  return TONE_CLASSES[tone] || TONE_CLASSES.neutral
}

export function StatusBadge({ value, metaMap = INQUIRY_STATUS_META, label, className = '' }) {
  const meta = metaMap[value] || { label: label || value || '—', tone: 'neutral', icon: XCircle }
  const Icon = meta.icon || XCircle

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${statusToneClass(meta.tone)} ${className}`.trim()}>
      <Icon size={13} className="shrink-0" />
      {label || meta.label || value}
    </span>
  )
}

export function StatusSelect({
  value,
  onChange,
  options,
  metaMap = INQUIRY_STATUS_META,
  className = '',
  disabled = false,
  ariaLabel = 'Статус',
}) {
  const meta = metaMap[value] || { tone: 'neutral', icon: XCircle }
  const Icon = meta.icon || XCircle

  return (
    <span className={`relative inline-flex min-w-[11rem] items-center ${className}`.trim()}>
      <Icon size={15} className="pointer-events-none absolute left-3.5 z-10 text-current" />
      <TotsanSelect
        value={value}
        onChange={onChange}
        options={options}
        disabled={disabled}
        aria-label={ariaLabel}
        buttonClassName={`!min-h-0 !rounded-full !py-2 !pl-9 !pr-9 font-semibold ${statusToneClass(meta.tone)}`}
      />
    </span>
  )
}
