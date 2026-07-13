import {
  BriefcaseBusiness,
  ChevronLeft,
  CornerUpLeft,
  FileText,
  FolderKanban,
  Loader2,
  Mic,
  Paperclip,
  Pause,
  Play,
  Plus,
  Trash2,
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
      className="chat-compose-reference-row flex w-full min-w-0 items-center gap-3 rounded-2xl border px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60"
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
  onSendVoice,
}) {
  const disabled = status === 'sending'
  const replyPreview = buildReplyPreview(replyTarget, conversation)
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)
  const reopenReferenceMenuAfterPickerRef = useRef(false)
  const referenceMenuRef = useRef(null)
  const referenceToggleRef = useRef(null)
  const [referenceMenuOpen, setReferenceMenuOpen] = useState(false)
  const [referenceStep, setReferenceStep] = useState('root')
  const [voiceStatus, setVoiceStatus] = useState('idle')
  const [voiceElapsed, setVoiceElapsed] = useState(0)
  const [voiceError, setVoiceError] = useState('')
  const [voiceLevels, setVoiceLevels] = useState(() => Array.from({ length: 34 }, () => 0.08))
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const mediaRecorderRef = useRef(null)
  const mediaStreamRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const updateViewport = () => setIsMobileViewport(mediaQuery.matches)
    updateViewport()
    mediaQuery.addEventListener?.('change', updateViewport)
    return () => mediaQuery.removeEventListener?.('change', updateViewport)
  }, [])
  const voiceAnimationRef = useRef(0)
  const voiceLastDrawRef = useRef(0)
  const voiceChunksRef = useRef([])
  const voicePeakHistoryRef = useRef([])
  const voiceStartedAtRef = useRef(0)
  const voiceElapsedBeforePauseRef = useRef(0)
  const voiceTimerRef = useRef(null)
  const hasFiles = files.length > 0
  const canSubmit = (Boolean(value.trim()) || hasFiles) && !disabled && voiceStatus === 'idle'
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
      const target = event.target
      if (referenceMenuRef.current?.contains(target) || referenceToggleRef.current?.contains(target)) {
        return
      }
      if (!referenceMenuRef.current?.contains(target)) {
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

  useEffect(() => {
    function restoreReferenceMenuAfterFilePicker() {
      if (!reopenReferenceMenuAfterPickerRef.current) return
      window.setTimeout(() => {
        if (!reopenReferenceMenuAfterPickerRef.current) return
        reopenReferenceMenuAfterPickerRef.current = false
        setReferenceStep('root')
        setReferenceMenuOpen(true)
      }, 160)
    }

    window.addEventListener('focus', restoreReferenceMenuAfterFilePicker)
    return () => window.removeEventListener('focus', restoreReferenceMenuAfterFilePicker)
  }, [])

  useEffect(() => {
    return () => {
      stopVoiceTimer()
      stopVoiceAnalyser()
      stopVoiceStream()
    }
  }, [])

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
    if (disabled || voiceStatus !== 'idle') return
    setReferenceMenuOpen((current) => {
      const next = !current
      if (next) setReferenceStep('root')
      return next
    })
  }

  function openFilePicker() {
    if (disabled || files.length >= MAX_CHAT_ATTACHMENTS) return
    reopenReferenceMenuAfterPickerRef.current = true
    setReferenceMenuOpen(false)
    setReferenceStep('root')
    window.setTimeout(() => fileInputRef.current?.click(), 0)
  }

  function handleFileInputChange(event) {
    const selectedFiles = event.target.files
    reopenReferenceMenuAfterPickerRef.current = false
    onFilesChange?.(selectedFiles)
    setReferenceMenuOpen(false)
    setReferenceStep('root')
    event.target.value = ''
  }

  function handleFilePickerCancel() {
    reopenReferenceMenuAfterPickerRef.current = false
    setReferenceStep('root')
    setReferenceMenuOpen(true)
  }

  function stopVoiceTimer() {
    if (voiceTimerRef.current) {
      window.clearInterval(voiceTimerRef.current)
      voiceTimerRef.current = null
    }
  }

  function stopVoiceStream() {
    mediaStreamRef.current?.getTracks?.().forEach((track) => track.stop())
    mediaStreamRef.current = null
  }

  function stopVoiceAnalyser() {
    if (voiceAnimationRef.current) {
      window.cancelAnimationFrame(voiceAnimationRef.current)
      voiceAnimationRef.current = 0
    }
    audioContextRef.current?.close?.().catch(() => {})
    audioContextRef.current = null
    analyserRef.current = null
    voiceLastDrawRef.current = 0
  }

  function startVoiceAnalyser(stream) {
    stopVoiceAnalyser()
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext
    if (!AudioContextConstructor) return

    const audioContext = new AudioContextConstructor()
    const source = audioContext.createMediaStreamSource(stream)
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 1024
    analyser.smoothingTimeConstant = 0.78
    source.connect(analyser)
    audioContextRef.current = audioContext
    analyserRef.current = analyser
    const samples = new Uint8Array(analyser.fftSize)

    const draw = (now = 0) => {
      if (!analyserRef.current) return
      voiceAnimationRef.current = window.requestAnimationFrame(draw)
      if (now - voiceLastDrawRef.current < 70) return
      voiceLastDrawRef.current = now

      analyserRef.current.getByteTimeDomainData(samples)
      const bars = 34
      const bucketSize = Math.max(1, Math.floor(samples.length / bars))
      const nextLevels = Array.from({ length: bars }, (_, barIndex) => {
        let sum = 0
        const start = barIndex * bucketSize
        const end = Math.min(samples.length, start + bucketSize)
        for (let index = start; index < end; index += 1) {
          const centered = (samples[index] - 128) / 128
          sum += centered * centered
        }
        const rms = Math.sqrt(sum / Math.max(1, end - start))
        return Math.max(0.04, Math.min(1, rms * 4.6))
      })
      setVoiceLevels(nextLevels)
      voicePeakHistoryRef.current.push(Math.max(...nextLevels))
      if (voicePeakHistoryRef.current.length > 1600) {
        voicePeakHistoryRef.current.splice(0, voicePeakHistoryRef.current.length - 1600)
      }
    }

    draw()
  }

  function startVoiceTimer() {
    stopVoiceTimer()
    voiceStartedAtRef.current = Date.now()
    voiceTimerRef.current = window.setInterval(() => {
      const activeElapsed = Math.floor((Date.now() - voiceStartedAtRef.current) / 1000)
      setVoiceElapsed(voiceElapsedBeforePauseRef.current + activeElapsed)
    }, 250)
  }

  async function startVoiceRecording() {
    if (disabled || voiceStatus !== 'idle') return
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setVoiceError('Браузърът не поддържа гласови съобщения.')
      return
    }

    try {
      setReferenceMenuOpen(false)
      setVoiceError('')
      voiceChunksRef.current = []
      voicePeakHistoryRef.current = []
      voiceElapsedBeforePauseRef.current = 0
      setVoiceElapsed(0)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = preferredVoiceMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      mediaStreamRef.current = stream
      mediaRecorderRef.current = recorder
      startVoiceAnalyser(stream)
      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) voiceChunksRef.current.push(event.data)
      }
      recorder.start()
      setVoiceStatus('recording')
      startVoiceTimer()
    } catch {
      setVoiceError('Не успяхме да стартираме микрофона.')
      stopVoiceStream()
      mediaRecorderRef.current = null
      setVoiceStatus('idle')
    }
  }

  function pauseVoiceRecording() {
    const recorder = mediaRecorderRef.current
    if (!recorder || voiceStatus !== 'recording') return
    recorder.pause()
    voiceElapsedBeforePauseRef.current = voiceElapsed
    stopVoiceTimer()
    stopVoiceAnalyser()
    setVoiceStatus('paused')
  }

  function resumeVoiceRecording() {
    const recorder = mediaRecorderRef.current
    if (!recorder || voiceStatus !== 'paused') return
    recorder.resume()
    setVoiceStatus('recording')
    if (mediaStreamRef.current) startVoiceAnalyser(mediaStreamRef.current)
    startVoiceTimer()
  }

  function cancelVoiceRecording() {
    const recorder = mediaRecorderRef.current
    stopVoiceTimer()
    voiceChunksRef.current = []
    voicePeakHistoryRef.current = []
    setVoiceElapsed(0)
    setVoiceError('')
    setVoiceStatus('idle')
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => {}
      recorder.stop()
    }
    mediaRecorderRef.current = null
    stopVoiceAnalyser()
    stopVoiceStream()
  }

  function finishVoiceRecording() {
    const recorder = mediaRecorderRef.current
    if (!recorder || voiceStatus === 'idle') return
    setVoiceStatus('sending')
    stopVoiceTimer()
    const activeElapsed = voiceStatus === 'recording' && voiceStartedAtRef.current
      ? Math.floor((Date.now() - voiceStartedAtRef.current) / 1000)
      : 0
    const recordedDuration = Math.max(1, voiceElapsedBeforePauseRef.current + activeElapsed || voiceElapsed || 1)
    const recordedWaveform = compactVoiceWaveform(voicePeakHistoryRef.current)
    recorder.onstop = async () => {
      try {
        const type = (recorder.mimeType || preferredVoiceMimeType() || 'audio/webm').split(';')[0]
        const blob = new Blob(voiceChunksRef.current, { type })
        if (!blob.size) throw new Error('Empty recording.')
        const extension = type.includes('ogg') ? 'ogg' : type.includes('mp4') ? 'm4a' : 'webm'
        const file = new File([blob], `voice-message-${Date.now()}.${extension}`, { type })
        Object.defineProperty(file, '__chatVoiceMeta', {
          value: { duration: recordedDuration, waveform: recordedWaveform },
          enumerable: false,
        })
        await onSendVoice?.(file)
        setVoiceElapsed(0)
        setVoiceError('')
      } catch {
        setVoiceError('Гласовото съобщение не се изпрати.')
      } finally {
        voiceChunksRef.current = []
        voicePeakHistoryRef.current = []
        mediaRecorderRef.current = null
        stopVoiceAnalyser()
        stopVoiceStream()
        setVoiceStatus('idle')
      }
    }
    if (recorder.state !== 'inactive') recorder.stop()
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
          <div ref={referenceMenuRef} className="chat-compose-reference-menu rounded-[1.6rem] border p-3">
            {referenceStep === 'root' ? (
              <div className="grid gap-2">
                <ReferenceRow
                  icon={Paperclip}
                  title="Прикачи файлове"
                  meta={files.length >= MAX_CHAT_ATTACHMENTS ? 'Достигнат е лимитът за файлове' : 'Снимки, документи или други файлове'}
                  onClick={openFilePicker}
                  disabled={disabled || files.length >= MAX_CHAT_ATTACHMENTS}
                />
                <ReferenceRow
                  icon={BriefcaseBusiness}
                  title="Услуга"
                  meta={services.length ? `${services.length} публични услуги` : 'Няма публични услуги за прикачване'}
                  onClick={() => setReferenceStep('services')}
                  disabled={!canShareReferences || !services.length}
                />
                <ReferenceRow
                  icon={FolderKanban}
                  title="Портфолио"
                  meta={portfolio.length ? `${portfolio.length} публични проекта` : 'Няма публични проекти за прикачване'}
                  onClick={() => setReferenceStep('portfolio')}
                  disabled={!canShareReferences || !portfolio.length}
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

        {voiceError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{voiceError}</div>
        )}

        {voiceStatus !== 'idle' ? (
          <VoiceRecordingBar
            status={voiceStatus}
            elapsed={voiceElapsed}
            levels={voiceLevels}
            onCancel={cancelVoiceRecording}
            onPause={pauseVoiceRecording}
            onResume={resumeVoiceRecording}
            onSend={finishVoiceRecording}
          />
        ) : (
        <div className="chat-compose-bar">
          <div className="chat-compose-primary">
            <button
              ref={referenceToggleRef}
              type="button"
              onClick={toggleReferenceMenu}
              disabled={disabled}
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
                <OfferHandIcon />
              </button>
            )}

            <textarea
              ref={textareaRef}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={handleTextareaKeyDown}
              rows={1}
              disabled={disabled}
              placeholder={isMobileViewport ? 'съобщение...' : 'Напиши съобщение...'}
              className="chat-compose-textarea"
            />
          </div>

          <div className="chat-compose-actions">
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif,audio/aac,audio/m4a,audio/mp4,audio/mpeg,audio/ogg,audio/wav,audio/webm,application/pdf,text/plain,text/csv,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip"
              onChange={handleFileInputChange}
              onCancel={handleFilePickerCancel}
              disabled={disabled || files.length >= MAX_CHAT_ATTACHMENTS}
            />
            <button
              type="button"
              onClick={startVoiceRecording}
              disabled={disabled}
              className="chat-compose-icon-button"
              aria-label="Запиши гласово съобщение"
            >
              <Mic size={25} strokeWidth={1.9} />
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              aria-label={disabled ? 'Sending message' : 'Send message'}
              className="chat-compose-send-button"
            >
              {disabled ? <Loader2 size={22} className="animate-spin" /> : <SendPlaneIcon className="chat-compose-send-icon" />}
            </button>
          </div>
        </div>
        )}
      </div>
    </form>
  )
}

function VoiceRecordingBar({ status, elapsed, levels, onCancel, onPause, onResume, onSend }) {
  const paused = status === 'paused'
  const sending = status === 'sending'

  return (
    <div className="chat-voice-bar" role="group" aria-label="Гласово съобщение">
      <button
        type="button"
        onClick={onCancel}
        disabled={sending}
        className="chat-voice-icon-button"
        aria-label="Изтрий гласовото съобщение"
      >
        <Trash2 size={19} strokeWidth={2.2} />
      </button>

      <div className="chat-voice-time">
        <span className="chat-voice-dot" aria-hidden="true" />
        <span>{formatVoiceTime(elapsed)}</span>
      </div>

      <div className={`chat-voice-waveform ${paused ? 'is-paused' : ''}`} aria-hidden="true">
        {levels.map((level, index) => (
          <span key={index} style={{ '--wave-height': `${Math.max(3, Math.round(level * 32))}px` }} />
        ))}
      </div>

      <button
        type="button"
        onClick={paused ? onResume : onPause}
        disabled={sending}
        className="chat-voice-icon-button"
        aria-label={paused ? 'Продължи записа' : 'Пауза'}
      >
        {paused ? <Play size={19} fill="currentColor" /> : <Pause size={19} fill="currentColor" />}
      </button>

      <div className="chat-voice-duration-indicator" aria-hidden="true">
        <span>{elapsed || 1}</span>
      </div>

      <button
        type="button"
        onClick={onSend}
        disabled={sending}
        className="chat-compose-send-button"
        aria-label="Изпрати гласовото съобщение"
      >
        {sending ? <Loader2 size={22} className="animate-spin" /> : <SendPlaneIcon className="chat-compose-send-icon" />}
      </button>
    </div>
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

function preferredVoiceMimeType() {
  if (typeof MediaRecorder === 'undefined') return ''
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
  ]
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || ''
}

function formatVoiceTime(totalSeconds = 0) {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  return `${minutes}:${String(remaining).padStart(2, '0')}`
}

function compactVoiceWaveform(samples = [], bars = 34) {
  const safeSamples = Array.isArray(samples)
    ? samples.map(Number).filter(Number.isFinite)
    : []
  if (!safeSamples.length) return Array.from({ length: bars }, () => 0.08)

  return Array.from({ length: bars }, (_, index) => {
    const start = Math.floor((index / bars) * safeSamples.length)
    const end = Math.max(start + 1, Math.floor(((index + 1) / bars) * safeSamples.length))
    const bucket = safeSamples.slice(start, end)
    const peak = bucket.reduce((max, value) => Math.max(max, value), 0)
    return Math.max(0.06, Math.min(1, peak))
  })
}

function OfferHandIcon() {
  return (
    <svg width="31" height="31" viewBox="0 0 31 31" fill="none" aria-hidden="true">
      <path d="M0.00565895 28.8517C0.00565895 28.8407 0.0679696 28.7554 0.0708678 28.6452C0.136077 25.9003 0.0542033 22.9468 0.245483 20.2245C0.275913 19.792 0.308518 19.3426 0.821494 19.2806C1.80687 19.1625 3.01468 19.471 4.03339 19.3405C4.50362 19.5177 5.40785 19.2486 5.78751 19.5243C5.83678 19.56 5.99763 19.7635 5.99763 19.8V20.9277C7.89665 20.032 10.029 19.8372 12.0222 20.5608C13.0025 20.9168 13.7241 21.512 14.8131 21.6513C16.3202 21.8446 18.0084 21.6564 19.5263 21.7819C20.8203 21.8884 21.9216 22.6135 22.5578 23.7354L27.2463 21.5084C28.4592 20.9999 29.8938 21.3836 30.6944 22.4231C31.0096 22.8323 31.1863 23.2138 30.6908 23.5742C27.3195 25.5933 24.0851 28.1303 20.7022 30.0961C19.2118 30.9627 17.2896 31.1895 15.6087 30.8467C13.2626 30.3682 10.8231 29.3025 8.48063 28.8203C7.25833 28.5687 6.80332 29.1325 5.76432 29.5935C5.77809 30.0611 5.7607 30.5374 5.23613 30.6775L0.521533 30.5549C0.24186 30.5119 0.142597 30.3478 0.00276078 30.1318C0.00928166 29.7066 -0.00593374 29.2777 0.00276078 28.8517H0.00565895ZM1.39606 20.4273L1.14754 29.4338L4.62172 29.5308L4.87024 20.5243L1.39606 20.4273ZM22.9577 24.8375C23.0019 25.37 23.1744 26.0156 22.4911 26.1659L15.487 25.9726C14.8523 25.8566 14.7936 25.0068 15.416 24.8324C17.394 24.8631 19.3691 24.9112 21.3478 24.9477C21.4775 24.9499 21.8093 25.0972 21.7753 24.885C21.6021 23.8178 20.4225 23.0256 19.4075 22.9395C17.5251 22.7805 15.2689 23.135 13.4749 22.5128C12.9243 22.3217 12.4461 21.9898 11.9128 21.7695C9.97754 20.9722 7.66118 21.1334 5.94908 22.3691L5.81866 28.2411C6.20557 28.1215 6.53234 27.8589 6.92142 27.7371C7.75174 27.4767 8.22777 27.5795 9.03998 27.7714C12.1975 28.5161 16.8803 30.8219 19.9045 29.2281L29.5206 22.9395C29.6018 22.7594 28.8446 22.4866 28.7171 22.4661C28.4295 22.4202 28.1165 22.4413 27.8404 22.5296L22.9592 24.8375H22.9577Z" fill="currentColor" />
      <path d="M11.7279 3.35245C12.204 2.87245 12.3865 2.22468 12.9887 1.72718C14.3342 0.615456 15.3341 1.25448 16.592 0.722689C17.8498 0.190902 18.2969 -0.259914 19.8011 0.174124C20.4083 0.349198 20.9351 0.837946 21.5415 0.920377C22.4777 1.04804 23.024 0.851806 23.9587 1.3515C24.9869 1.90079 25.0188 2.46541 25.6716 3.22333C26.1962 3.83244 27.02 4.00752 27.6091 4.7472C28.3909 5.72908 28.2163 6.36153 28.3431 7.48201C28.4134 8.10206 28.8257 8.44564 29.0322 8.98254C29.3104 9.70837 29.3285 10.5597 29.0938 11.2986C28.9003 11.9077 28.4163 12.3389 28.3431 12.9808C28.2185 14.0787 28.3917 14.7133 27.6352 15.6813C27.0295 16.4567 26.1216 16.6544 25.5876 17.3372C24.9992 18.09 24.9101 18.6029 23.9587 19.1106C23.0726 19.584 22.5552 19.4366 21.6473 19.5264C20.9235 19.5979 20.3011 20.1865 19.5606 20.3507C18.1491 20.6644 17.7477 20.2274 16.592 19.7394C15.3341 19.2083 14.3436 19.8371 12.9916 18.732C12.375 18.2279 12.217 17.6006 11.7482 17.1191C11.2591 16.6172 10.5338 16.4626 9.99473 15.8367C9.20277 14.9168 9.29841 14.3894 9.20494 13.2791C9.11872 12.2491 8.32893 11.621 8.23836 10.5341C8.10793 8.97378 9.09988 8.43762 9.20494 7.18146C9.28827 6.19157 9.16147 5.83339 9.76214 4.93833C10.3628 4.04326 11.0925 3.99074 11.7272 3.35099L11.7279 3.35245ZM12.5155 4.20593C12.0148 4.69906 11.2823 4.8858 10.8432 5.41686C10.1607 6.2419 10.4642 6.93417 10.257 7.87447C10.0498 8.81476 9.31363 9.33998 9.39043 10.413C9.44333 11.1549 10.0041 11.6758 10.2056 12.3958C10.5157 13.5031 10.0766 14.4624 11.1156 15.3195C11.5453 15.674 12.1185 15.8491 12.5365 16.2663C13.0242 16.7522 13.2386 17.4802 13.8125 17.9077C14.7559 18.6109 15.6834 18.1973 16.7007 18.5343C17.4057 18.7677 17.8564 19.2667 18.6795 19.2864C19.6707 19.3104 20.1931 18.6671 21.072 18.4592C21.7567 18.2972 22.411 18.4526 23.0842 18.2301C24.2609 17.8406 24.3333 16.7908 25.1883 16.0818C25.71 15.6492 26.2861 15.5347 26.7273 14.9496C27.3918 14.0692 27.0353 13.3426 27.2918 12.4096C27.4809 11.7224 28.041 11.1717 28.0968 10.4772C28.1902 9.31445 27.5236 8.97889 27.278 8.00577C27.0729 7.19459 27.3352 6.51837 26.8715 5.73273C26.4078 4.94708 25.7745 4.87632 25.1572 4.35037C24.3319 3.64789 24.2609 2.65653 23.1291 2.24729C22.4349 1.99635 21.7799 2.16997 21.0713 2.00292C20.1069 1.77532 19.625 1.07721 18.5063 1.18736C17.7585 1.26104 17.2868 1.75198 16.605 1.95477C15.6015 2.25386 14.6972 1.86359 13.7785 2.58285C13.2198 3.01981 13.0119 3.71646 12.5148 4.20593H12.5155Z" fill="currentColor" />
      <path d="M22.1401 4.1248C22.6097 4.09562 22.9386 4.6617 22.6481 5.05124L15.8327 16.0481C15.3617 16.6258 14.5263 16.1969 14.8241 15.4594L21.8373 4.23568C21.93 4.19775 22.0416 4.13137 22.1401 4.12553V4.1248Z" fill="currentColor" />
      <path d="M21.542 10.2164C24.9896 9.7459 25.425 15.7881 22.0703 16.0508C18.7343 16.3119 18.3517 10.6512 21.542 10.2164ZM21.6616 11.3734C20.832 11.509 20.3994 12.5741 20.4675 13.3393C20.5639 14.4145 21.6297 15.4066 22.6311 14.6049C23.7904 13.6763 23.2028 11.1217 21.6616 11.3734Z" fill="currentColor" />
      <path d="M15.3069 4.42607C18.8124 3.95118 19.1602 10.0204 15.8351 10.2604C12.5101 10.5004 12.1427 4.855 15.3069 4.42607ZM15.4265 5.58301C14.6628 5.70557 14.1998 6.71516 14.2309 7.42494C14.2722 8.38201 15.0606 9.41495 16.0895 8.99331C17.6285 8.36232 17.172 5.30217 15.4265 5.58301Z" fill="currentColor" />
    </svg>
  )
}

function SendPlaneIcon({ className = '' }) {
  return (
    <svg className={className} width="31" height="31" viewBox="18 15 36 36" fill="none" aria-hidden="true">
      <path d="M37.329 40.6348C36.6025 41.6236 35.8954 42.6305 35.1513 43.6064C34.7684 44.1084 34.3571 44.9712 33.6201 44.7002C33.4648 44.6432 33.1308 44.3733 33.1308 44.2168V39.2051L37.329 40.6348ZM48.4101 21C48.701 21.121 48.8747 21.2939 48.996 21.5811C48.9869 21.7239 49.009 21.8751 48.996 22.0166C48.9882 22.0986 48.9216 22.2693 48.9072 22.3877C48.1629 28.5625 46.9363 34.6904 46.1503 40.8613C46.119 41.3193 45.8107 41.6159 45.3593 41.6748L34.204 37.9463L44.6503 25.3574L31.081 36.8135H30.9335C29.0973 36.1621 27.2264 35.598 25.3915 34.9453C25.1154 34.8469 24.3869 34.6394 24.2187 34.4629C23.9025 34.1311 23.9306 33.6033 24.2939 33.3213L48.0195 21H48.4101Z" fill="currentColor" />
    </svg>
  )
}
