import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'

const DAY_MS = 24 * 60 * 60 * 1000
const WEEKDAY_LABELS = [
  { short: 'Пн', long: 'Понеделник' },
  { short: 'Вт', long: 'Вторник' },
  { short: 'Ср', long: 'Сряда' },
  { short: 'Чт', long: 'Четвъртък' },
  { short: 'Пт', long: 'Петък' },
  { short: 'Сб', long: 'Събота' },
  { short: 'Нд', long: 'Неделя' },
]

const MONTH_FORMATTER = new Intl.DateTimeFormat('bg-BG', {
  month: 'long',
  year: 'numeric',
})

const BUTTON_DATE_FORMATTER = new Intl.DateTimeFormat('bg-BG', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const ACCESSIBLE_DATE_FORMATTER = new Intl.DateTimeFormat('bg-BG', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export default function TotsanDatePicker({
  label = '',
  value = '',
  onChange,
  min = '',
  required = false,
  helper = '',
  error = '',
  className = '',
}) {
  const id = useId()
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const dayRefs = useRef(new Map())
  const selectedDate = useMemo(() => parseDateOnly(value), [value])
  const minDate = useMemo(() => parseDateOnly(min), [min])
  const today = useMemo(() => localToday(), [])
  const initialDate = laterDate(selectedDate || today, minDate) || today
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(initialDate))
  const [focusedValue, setFocusedValue] = useState(() => toDateOnly(initialDate))
  const helperId = helper || error ? `${id}-helper` : undefined
  const dialogId = `${id}-dialog`
  const labelId = label ? `${id}-label` : undefined

  useEffect(() => {
    if (!selectedDate) return
    const nextDate = laterDate(selectedDate, minDate) || selectedDate
    setViewMonth(startOfMonth(nextDate))
    setFocusedValue(toDateOnly(nextDate))
  }, [minDate, selectedDate])

  useEffect(() => {
    if (!open) return undefined

    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }

    function handleKeyDown(event) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      triggerRef.current?.focus()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [open])

  useEffect(() => {
    if (!open || !focusedValue) return undefined
    const frame = window.requestAnimationFrame(() => {
      dayRefs.current.get(focusedValue)?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [focusedValue, open, viewMonth])

  const calendarDays = useMemo(() => buildCalendarDays(viewMonth), [viewMonth])
  const weeks = useMemo(
    () => Array.from({ length: 6 }, (_, index) => calendarDays.slice(index * 7, index * 7 + 7)),
    [calendarDays],
  )
  const previousMonth = addMonths(viewMonth, -1)
  const previousMonthDisabled = Boolean(minDate && compareDays(endOfMonth(previousMonth), minDate) < 0)

  function openCalendar() {
    const nextDate = laterDate(selectedDate || today, minDate) || today
    setViewMonth(startOfMonth(nextDate))
    setFocusedValue(toDateOnly(nextDate))
    setOpen(true)
  }

  function handleTriggerClick() {
    if (open) {
      setOpen(false)
      return
    }
    openCalendar()
  }

  function handleTriggerKeyDown(event) {
    if (!['ArrowDown', 'Enter', ' '].includes(event.key) || open) return
    event.preventDefault()
    openCalendar()
  }

  function selectDate(date) {
    if (isBeforeMin(date, minDate)) return
    onChange?.(toDateOnly(date))
    setOpen(false)
    window.requestAnimationFrame(() => triggerRef.current?.focus())
  }

  function clearDate() {
    if (required) return
    onChange?.('')
    setOpen(false)
    window.requestAnimationFrame(() => triggerRef.current?.focus())
  }

  function focusDate(date) {
    const nextDate = laterDate(date, minDate) || date
    setViewMonth(startOfMonth(nextDate))
    setFocusedValue(toDateOnly(nextDate))
  }

  function handleDayKeyDown(event, date) {
    let nextDate = null

    if (event.key === 'ArrowLeft') nextDate = addDays(date, -1)
    if (event.key === 'ArrowRight') nextDate = addDays(date, 1)
    if (event.key === 'ArrowUp') nextDate = addDays(date, -7)
    if (event.key === 'ArrowDown') nextDate = addDays(date, 7)
    if (event.key === 'Home') nextDate = addDays(date, -mondayIndex(date))
    if (event.key === 'End') nextDate = addDays(date, 6 - mondayIndex(date))
    if (event.key === 'PageUp') nextDate = addMonthsClamped(date, event.shiftKey ? -12 : -1)
    if (event.key === 'PageDown') nextDate = addMonthsClamped(date, event.shiftKey ? 12 : 1)

    if (!nextDate) return
    event.preventDefault()
    focusDate(nextDate)
  }

  return (
    <div ref={rootRef} className={`relative w-full ${className}`.trim()}>
      {label && (
        <div id={labelId} className="mb-2 flex items-center gap-1 text-sm font-medium text-ink">
          <span>{label}</span>
          {required && <span className="text-red-700" aria-hidden="true">*</span>}
        </div>
      )}

      <button
        ref={triggerRef}
        id={`${id}-button`}
        type="button"
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        aria-labelledby={labelId ? `${labelId} ${id}-button` : undefined}
        aria-label={label ? undefined : 'Избери дата'}
        aria-describedby={helperId}
        aria-invalid={Boolean(error)}
        aria-required={required}
        className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl border bg-paper px-4 py-2.5 text-left text-sm shadow-[0_18px_45px_-38px_rgba(13,35,64,0.55)] outline-none transition-[border-color,box-shadow,background-color] hover:border-ink/30 focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-ink/10 ${error ? 'border-red-300 bg-red-50/70 text-red-800 focus-visible:ring-red-100' : 'border-line text-ink'}`}
      >
        <span className={`min-w-0 flex-1 truncate ${selectedDate ? '' : 'text-muted'}`}>
          {selectedDate ? BUTTON_DATE_FORMATTER.format(selectedDate) : 'Избери дата'}
        </span>
        <CalendarDays size={18} className="shrink-0 text-accentDeep" aria-hidden="true" />
      </button>

      {open && (
        <div
          id={dialogId}
          role="dialog"
          aria-modal="false"
          aria-label={label ? `Календар: ${label}` : 'Календар за избор на дата'}
          className="absolute left-1/2 top-full z-[120] mt-2 w-[min(19rem,calc(100vw-1.5rem))] -translate-x-1/2 overflow-hidden rounded-2xl border border-line bg-paper shadow-[0_24px_70px_-30px_rgba(13,35,64,0.5)] sm:left-auto sm:right-0 sm:translate-x-0"
        >
          <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-2.5">
            <button
              type="button"
              onClick={() => {
                if (previousMonthDisabled) return
                const nextMonth = addMonths(viewMonth, -1)
                setViewMonth(nextMonth)
                focusDate(firstFocusableDay(nextMonth, minDate))
              }}
              disabled={previousMonthDisabled}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-muted outline-none transition-colors hover:bg-soft hover:text-ink focus-visible:ring-2 focus-visible:ring-ink/15 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Предишен месец"
            >
              <ChevronLeft size={19} aria-hidden="true" />
            </button>
            <div className="min-w-0 flex-1 text-center text-sm font-semibold capitalize text-ink" aria-live="polite">
              {MONTH_FORMATTER.format(viewMonth)}
            </div>
            <button
              type="button"
              onClick={() => {
                const nextMonth = addMonths(viewMonth, 1)
                setViewMonth(nextMonth)
                focusDate(firstFocusableDay(nextMonth, minDate))
              }}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-muted outline-none transition-colors hover:bg-soft hover:text-ink focus-visible:ring-2 focus-visible:ring-ink/15"
              aria-label="Следващ месец"
            >
              <ChevronRight size={19} aria-hidden="true" />
            </button>
          </div>

          <div className="px-2 pb-2 pt-1.5">
            <div className="grid grid-cols-7" aria-hidden="true">
              {WEEKDAY_LABELS.map((day) => (
                <div key={day.short} title={day.long} className="flex h-8 items-center justify-center text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                  {day.short}
                </div>
              ))}
            </div>

            <div role="grid" aria-label={MONTH_FORMATTER.format(viewMonth)} className="space-y-0.5">
              {weeks.map((week, weekIndex) => (
                <div key={`week-${weekIndex}`} role="row" className="grid grid-cols-7 gap-0.5">
                  {week.map((date) => {
                    const dateValue = toDateOnly(date)
                    const selected = Boolean(selectedDate && compareDays(date, selectedDate) === 0)
                    const current = compareDays(date, today) === 0
                    const outsideMonth = date.getMonth() !== viewMonth.getMonth()
                    const disabled = isBeforeMin(date, minDate)
                    const focused = dateValue === focusedValue

                    return (
                      <button
                        key={dateValue}
                        ref={(node) => {
                          if (node) dayRefs.current.set(dateValue, node)
                          else dayRefs.current.delete(dateValue)
                        }}
                        type="button"
                        role="gridcell"
                        tabIndex={focused ? 0 : -1}
                        disabled={disabled}
                        aria-selected={selected}
                        aria-current={current ? 'date' : undefined}
                        aria-label={ACCESSIBLE_DATE_FORMATTER.format(date)}
                        onClick={() => selectDate(date)}
                        onFocus={() => setFocusedValue(dateValue)}
                        onKeyDown={(event) => handleDayKeyDown(event, date)}
                        className={`flex h-11 min-w-0 items-center justify-center rounded-xl text-sm font-medium outline-none transition-[background-color,color,box-shadow] focus-visible:ring-2 focus-visible:ring-accentDeep/30 disabled:cursor-not-allowed disabled:opacity-25 ${selected ? 'bg-accentDeep text-paper shadow-sm' : current ? 'bg-accentSoft text-accentDeep ring-1 ring-accentDeep/25' : outsideMonth ? 'text-muted/55 hover:bg-soft hover:text-ink' : 'text-ink hover:bg-soft'}`}
                      >
                        {date.getDate()}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          {!required && value && (
            <div className="border-t border-line p-2">
              <button
                type="button"
                onClick={clearDate}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium text-muted outline-none transition-colors hover:bg-soft hover:text-ink focus-visible:ring-2 focus-visible:ring-ink/15"
              >
                <X size={16} aria-hidden="true" />
                Изчисти датата
              </button>
            </div>
          )}
        </div>
      )}

      {(helper || error) && (
        <p id={helperId} className={`mt-1.5 text-xs ${error ? 'text-red-700' : 'text-muted'}`}>
          {error || helper}
        </p>
      )}
    </div>
  )
}

function parseDateOnly(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim())
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const date = new Date(year, month, day, 12)
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null
  return date
}

function toDateOnly(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function localToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12)
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12)
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 12)
}

function addDays(date, amount) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount, 12)
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1, 12)
}

function addMonthsClamped(date, amount) {
  const targetMonth = new Date(date.getFullYear(), date.getMonth() + amount, 1, 12)
  const day = Math.min(date.getDate(), endOfMonth(targetMonth).getDate())
  return new Date(targetMonth.getFullYear(), targetMonth.getMonth(), day, 12)
}

function mondayIndex(date) {
  return (date.getDay() + 6) % 7
}

function buildCalendarDays(viewMonth) {
  const firstDay = startOfMonth(viewMonth)
  const gridStart = addDays(firstDay, -mondayIndex(firstDay))
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index))
}

function compareDays(left, right) {
  return dayNumber(left) - dayNumber(right)
}

function dayNumber(date) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS)
}

function isBeforeMin(date, minDate) {
  return Boolean(minDate && compareDays(date, minDate) < 0)
}

function laterDate(date, minimum) {
  if (!date) return minimum || null
  if (!minimum) return date
  return compareDays(date, minimum) < 0 ? minimum : date
}

function firstFocusableDay(month, minDate) {
  return laterDate(startOfMonth(month), minDate) || startOfMonth(month)
}
