import {
  BriefcaseBusiness,
  ChevronLeft,
  CornerUpLeft,
  FileText,
  FolderKanban,
  Loader2,
  Mic,
  Plus,
  Send,
  Sparkles,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { getMessageSnippet, getParticipantDisplayName } from '../../lib/chat.js'
import { formatAttachmentSize, MAX_CHAT_ATTACHMENTS } from '../../lib/chat-attachments.js'

function ReferenceRow({ icon: Icon, title, meta, onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full min-w-0 items-center gap-3 rounded-2xl border border-line bg-paper px-3 py-3 text-left transition hover:border-ink/20 hover:bg-soft disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-soft text-accentDeep">
        <Icon size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{title}</span>
        {meta && <span className="mt-0.5 block truncate text-xs text-muted">{meta}</span>}
      </span>
    </button>
  )
}

export default function ComposeBar({
  value,
  onChange,
  onSubmit,
  canSendOffer,
  onOpenOffer,
  replyTarget,
  onClearReply,
  conversation,
  status,
  files = [],
  onFilesChange,
  onRemoveFile,
  referenceLibrary = null,
  onSendReference,
}) {
  const disabled = status === 'sending'
  const replyPreview = buildReplyPreview(replyTarget, conversation)
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)
  const referenceMenuRef = useRef(null)
  const [referenceMenuOpen, setReferenceMenuOpen] = useState(false)
  const [referenceStep, setReferenceStep] = useState('root')
  const hasFiles = files.length > 0
  const canSubmit = (Boolean(value.trim()) || hasFiles) && !disabled
  const referenceStatus = referenceLibrary?.status || 'idle'
  const canShareReferences = Boolean(referenceLibrary?.profileId)
  const services = Array.isArray(referenceLibrary?.services) ? referenceLibrary.services : []
  const portfolio = Array.isArray(referenceLibrary?.portfolio) ? referenceLibrary.portfolio : []

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 152)}px`
  }, [value])

  useEffect(() => {
    setReferenceMenuOpen(false)
    setReferenceStep('root')
  }, [conversation?.id])

  useEffect(() => {
    if (!referenceMenuOpen) return undefined

    function handlePointerDown(event) {
      if (!referenceMenuRef.current?.contains(event.target)) {
        setReferenceMenuOpen(false)
        setReferenceStep('root')
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [referenceMenuOpen])

  function handleTextareaKeyDown(event) {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return

    const desktopLike = typeof window !== 'undefined'
      && window.matchMedia('(min-width: 768px) and (pointer: fine)').matches
    if (!desktopLike) return

    event.preventDefault()
    if (canSubmit) event.currentTarget.form?.requestSubmit()
  }

  async function handleReferencePick(referenceType, referenceId) {
    if (!referenceId || typeof onSendReference !== 'function') return
    await onSendReference({ referenceType, referenceId })
    setReferenceMenuOpen(false)
    setReferenceStep('root')
  }

  function toggleReferenceMenu() {
    if (!canShareReferences || disabled) return
    setReferenceMenuOpen((current) => {
      const next = !current
      if (next) setReferenceStep('root')
      return next
    })
  }

  return (
    <form
      onSubmit={onSubmit}
      className="chat-compose-shell"
    >
      <div className="chat-compose-inner">
        {replyPreview && (
          <div className="flex min-w-0 items-start justify-between gap-3 rounded-2xl border border-line bg-soft/92 px-3 py-2.5 shadow-[0_14px_30px_-28px_rgba(15,23,42,0.35)]">
            <div className="flex min-w-0 items-start gap-2.5">
              <div className="mt-0.5 rounded-full border border-line bg-paper p-1.5 text-muted">
                <CornerUpLeft size={14} />
              </div>
              <div className="min-w-0">
                <div className="truncate text-xs font-medium uppercase tracking-[0.12em] text-muted">
                  Отговор до {replyPreview.senderLabel}
                </div>
                <div className="mt-1 break-words text-sm leading-relaxed text-ink/85 [overflow-wrap:anywhere]">
                  {replyPreview.body}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClearReply}
              className="rounded-full border border-transparent p-1.5 text-muted transition hover:border-line hover:bg-paper hover:text-ink"
              aria-label="Премахни отговора"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {hasFiles && (
          <div className="flex min-w-0 flex-wrap gap-2 rounded-2xl border border-line bg-soft/80 px-3 py-2">
            {files.map((file, index) => (
              <div key={`${file.name}-${file.size}-${index}`} className="flex min-w-0 max-w-full items-center gap-2 rounded-full border border-line bg-paper px-3 py-1.5 text-xs text-muted">
                <FileText size={14} className="shrink-0 text-accentDeep" />
                <span className="min-w-0 truncate text-ink">{file.name}</span>
                <span className="shrink-0">{formatAttachmentSize(file.size)}</span>
                <button
                  type="button"
                  onClick={() => onRemoveFile?.(index)}
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-muted transition hover:bg-soft hover:text-ink"
                  aria-label="Remove attachment"
                  disabled={disabled}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {referenceMenuOpen && (
          <div ref={referenceMenuRef} className="rounded-[1.6rem] border border-line bg-paper/98 p-3 shadow-[0_22px_60px_-36px_rgba(15,23,42,0.45)] backdrop-blur-sm">
            {referenceStep === 'root' ? (
              <div className="grid gap-2">
                <ReferenceRow
                  icon={BriefcaseBusiness}
                  title="Услуга"
                  meta={services.length ? `${services.length} публични услуги` : 'Няма публични услуги за прикачване'}
                  onClick={() => setReferenceStep('services')}
                  disabled={!services.length}
                />
                <ReferenceRow
                  icon={FolderKanban}
                  title="Портфолио"
                  meta={portfolio.length ? `${portfolio.length} публични проекта` : 'Няма публични проекти за прикачване'}
                  onClick={() => setReferenceStep('portfolio')}
                  disabled={!portfolio.length}
                />
                {referenceStatus === 'loading' && (
                  <div className="flex items-center gap-2 rounded-2xl bg-soft px-3 py-2 text-sm text-muted">
                    <Loader2 size={15} className="animate-spin" />
                    <span>Зареждаме елементите на партньора…</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={() => setReferenceStep('root')}
                  className="inline-flex w-fit items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted transition hover:bg-soft hover:text-ink"
                >
                  <ChevronLeft size={14} />
                  <span>Назад</span>
                </button>

                <div className="grid gap-2">
                  {referenceStep === 'services' && services.map((item) => (
                    <ReferenceRow
                      key={item.id}
                      icon={BriefcaseBusiness}
                      title={item.title}
                      meta={[item.subtitle, item.profile?.name, item.lowestPrice ? `${item.lowestPrice} ${item.lowestCurrency || 'EUR'}` : ''].filter(Boolean).join(' · ')}
                      onClick={() => { void handleReferencePick('service', item.id) }}
                      disabled={disabled}
                    />
                  ))}
                  {referenceStep === 'portfolio' && portfolio.map((item) => (
                    <ReferenceRow
                      key={item.id}
                      icon={FolderKanban}
                      title={item.title}
                      meta={[item.city, item.year, item.budgetBand].filter(Boolean).join(' · ')}
                      onClick={() => { void handleReferencePick('portfolio', item.id) }}
                      disabled={disabled}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="chat-compose-bar">
          <div className="chat-compose-primary">
            <button
              type="button"
              onClick={toggleReferenceMenu}
              disabled={!canShareReferences || disabled}
              className="chat-compose-icon-button"
              aria-label="Прикачи услуга или портфолио"
              aria-expanded={referenceMenuOpen}
            >
              {referenceStatus === 'loading' ? <Loader2 size={21} className="animate-spin" /> : <Plus size={25} strokeWidth={1.9} />}
            </button>

            {canSendOffer && (
              <button
                type="button"
                onClick={onOpenOffer}
                disabled={disabled}
                className="chat-compose-icon-button chat-compose-offer-button"
                aria-label="Оферта"
              >
                <Sparkles size={25} strokeWidth={1.9} />
              </button>
            )}

            <textarea
              ref={textareaRef}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={handleTextareaKeyDown}
              rows={1}
              disabled={disabled}
              placeholder="Напиши съобщение..."
              className="chat-compose-textarea"
            />
          </div>

          <div className="chat-compose-actions">
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,text/csv,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip"
              onChange={(event) => {
                onFilesChange?.(event.target.files)
                event.target.value = ''
              }}
              disabled={disabled || files.length >= MAX_CHAT_ATTACHMENTS}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || files.length >= MAX_CHAT_ATTACHMENTS}
              className="chat-compose-icon-button"
              aria-label="Attach files"
            >
              <Mic size={25} strokeWidth={1.9} />
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              aria-label={disabled ? 'Sending message' : 'Send message'}
              className="chat-compose-send-button"
            >
              {disabled ? <Loader2 size={22} className="animate-spin" /> : <Send size={25} strokeWidth={1.9} />}
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}

function buildReplyPreview(replyTarget, conversation) {
  if (!replyTarget?.id) return null

  const sender = replyTarget.sender_id === conversation?.client_id
    ? conversation?.client
    : replyTarget.sender_id === conversation?.partner_id
      ? conversation?.partner
      : null

  return {
    senderLabel: getParticipantDisplayName(sender, 'Потребител'),
    body: getMessageSnippet(replyTarget, { maxLength: 160 }),
  }
}
