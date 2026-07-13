import { useEffect, useId, useRef, useState } from 'react'
import { CalendarDays, Clock3, X } from 'lucide-react'
import TotsanSelect from '../ui/TotsanSelect.jsx'
import TotsanDatePicker from '../ui/TotsanDatePicker.jsx'

const PURPOSES = ['Уточняване на детайли', 'Консултация', 'Представяне на идея', 'Друго']

function localDateValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

function isValidTime(value = '') {
  const match = String(value).match(/^(\d{2}):(\d{2})$/)
  return Boolean(match && Number(match[1]) < 24 && Number(match[2]) < 60)
}

function normalizeFixedTime(value = '') {
  const digits = String(value).replace(/\D/g, '').slice(0, 4).padEnd(4, '0')
  const hours = Math.min(Number(digits.slice(0, 2)), 23)
  const minutes = Math.min(Number(digits.slice(2, 4)), 59)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function TimeInput({ value, onChange }) {
  const inputRef = useRef(null)
  const editablePositions = [0, 1, 3, 4]
  const displayValue = normalizeFixedTime(value)

  function focusPosition(position) {
    const safePosition = editablePositions.includes(position) ? position : 0
    window.requestAnimationFrame(() => inputRef.current?.setSelectionRange(safePosition, safePosition))
  }

  function nextPosition(position) {
    const index = editablePositions.indexOf(position)
    return editablePositions[Math.min(index + 1, editablePositions.length - 1)]
  }

  function previousPosition(position) {
    const index = editablePositions.indexOf(position)
    return editablePositions[Math.max(index - 1, 0)]
  }

  function setDigit(position, digit) {
    const next = displayValue.split('')
    next[position] = digit
    const nextValue = next.join('')
    if (!isValidTime(nextValue)) return
    onChange(nextValue)
    focusPosition(nextPosition(position))
  }

  function activePosition() {
    const selection = inputRef.current?.selectionStart ?? 0
    if (selection <= 0) return 0
    if (selection === 2) return 3
    if (selection >= 4) return 4
    return selection
  }

  function handleKeyDown(event) {
    const position = activePosition()
    if (/^\d$/.test(event.key)) {
      event.preventDefault()
      setDigit(position, event.key)
      return
    }
    if (event.key === 'Backspace') {
      event.preventDefault()
      const target = previousPosition(position)
      setDigit(target, '0')
      focusPosition(target)
      return
    }
    if (event.key === 'Delete') {
      event.preventDefault()
      setDigit(position, '0')
      return
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      focusPosition(previousPosition(position))
      return
    }
    if (event.key === 'ArrowRight' || event.key === ':') {
      event.preventDefault()
      focusPosition(nextPosition(position))
    }
  }

  function handlePaste(event) {
    event.preventDefault()
    onChange(normalizeFixedTime(event.clipboardData.getData('text')))
    focusPosition(4)
  }

  return (
    <input
      ref={inputRef}
      required
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={displayValue}
      onChange={() => {}}
      onFocus={() => focusPosition(0)}
      onClick={() => focusPosition(activePosition())}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      aria-label="Час в 24-часов формат"
      className="h-11 rounded-xl border border-line bg-paper px-3 text-sm font-normal tabular-nums outline-none focus:border-accentDeep focus:ring-2 focus:ring-accentDeep/15"
    />
  )
}

export default function CallPlannerDialog({ mode = 'request', onClose, onSubmit, status = 'idle' }) {
  const titleId = useId()
  const [purpose, setPurpose] = useState(PURPOSES[0])
  const [duration, setDuration] = useState(30)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('00:00')
  const [channel, setChannel] = useState('video')
  const [location, setLocation] = useState('')
  const [note, setNote] = useState('')
  const hasSpecificTime = mode === 'scheduled'

  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape' && status !== 'sending') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, status])

  function submit(event) {
    event.preventDefault()
    if (hasSpecificTime && (!date || !isValidTime(time))) return
    onSubmit({
      mode,
      purpose,
      duration,
      startsAt: hasSpecificTime ? new Date(`${date}T${time}`).toISOString() : '',
      channel,
      location,
      note,
    })
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end bg-ink/45 p-0 sm:items-center sm:justify-center sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && status !== 'sending') onClose() }}>
      <form onSubmit={submit} aria-labelledby={titleId} className="w-full max-w-xl rounded-t-[2rem] border border-line bg-paper p-5 shadow-2xl sm:rounded-[2rem] sm:p-6" role="dialog" aria-modal="true">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-accentDeep">Разговор</div>
            <h2 id={titleId} className="mt-1 font-display text-3xl text-ink">{hasSpecificTime ? 'Предложи конкретен час' : 'Покани за разговор'}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{hasSpecificTime ? 'Получателят ще може да приеме, откаже или да предложи друг час.' : 'Изпрати ясна покана, без да разчиташ на автоматичен текст.'}</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line text-muted transition hover:bg-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accentDeep/30" aria-label="Затвори"><X size={18} /></button>
        </div>

        <div className="mt-5 grid gap-4">
          <TotsanSelect label="Цел" value={purpose} onChange={setPurpose} options={PURPOSES.map((item) => ({ value: item, label: item }))} />
          {hasSpecificTime && <div className="grid gap-4 sm:grid-cols-2">
            <TotsanDatePicker label="Дата" required value={date} onChange={setDate} min={localDateValue()} />
            <label className="grid gap-1.5 text-sm font-medium text-ink">Час<TimeInput value={time} onChange={setTime} /></label>
          </div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <TotsanSelect label="Продължителност" value={duration} onChange={(value) => setDuration(Number(value))} options={[15, 30, 45, 60].map((item) => ({ value: item, label: `${item} минути` }))} />
            <TotsanSelect label="Формат" value={channel} onChange={setChannel} options={[{ value: 'video', label: 'Видео разговор' }, { value: 'phone', label: 'Телефон' }, { value: 'in_person', label: 'На място' }]} />
          </div>
          <label className="grid gap-1.5 text-sm font-medium text-ink">{channel === 'in_person' ? 'Място' : 'Линк или детайл по желание'}<input value={location} onChange={(event) => setLocation(event.target.value)} placeholder={channel === 'in_person' ? 'Напр. офис или адрес' : 'Напр. линк към видео разговора'} className="h-11 rounded-xl border border-line bg-paper px-3 text-sm font-normal outline-none placeholder:text-muted focus:border-accentDeep focus:ring-2 focus:ring-accentDeep/15" /></label>
          <label className="grid gap-1.5 text-sm font-medium text-ink">Кратка бележка <span className="font-normal text-muted">по желание</span><textarea value={note} onChange={(event) => setNote(event.target.value)} rows="3" maxLength="600" className="resize-y rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-normal outline-none focus:border-accentDeep focus:ring-2 focus:ring-accentDeep/15" /></label>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="btn btn-ghost">Отказ</button><button disabled={status === 'sending'} className="btn btn-primary gap-2">{hasSpecificTime ? <CalendarDays size={18} /> : <Clock3 size={18} />}{status === 'sending' ? 'Изпращане…' : hasSpecificTime ? 'Изпрати предложение' : 'Изпрати покана'}</button></div>
      </form>
    </div>
  )
}
