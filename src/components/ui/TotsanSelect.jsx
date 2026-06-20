import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

function normalizeOptions(options = []) {
  return options.map((option) => {
    if (Array.isArray(option)) {
      return { value: option[0], label: option[1] }
    }
    return option
  }).filter(Boolean)
}

export default function TotsanSelect({
  label = '',
  value = '',
  options = [],
  onChange,
  placeholder = 'Избери',
  disabled = false,
  required = false,
  helper = '',
  error = '',
  className = '',
  buttonClassName = '',
  menuClassName = '',
  ariaLabel = '',
}) {
  const id = useId()
  const rootRef = useRef(null)
  const buttonRef = useRef(null)
  const optionRefs = useRef([])
  const [open, setOpen] = useState(false)
  const items = useMemo(() => normalizeOptions(options), [options])
  const selectedIndex = items.findIndex((item) => String(item.value) === String(value))
  const selected = selectedIndex >= 0 ? items[selectedIndex] : null
  const activeIndex = selectedIndex >= 0 ? selectedIndex : 0
  const helperId = helper || error ? `${id}-helper` : undefined

  useEffect(() => {
    if (!open) return

    function closeOnOutside(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }

    document.addEventListener('mousedown', closeOnOutside)
    document.addEventListener('touchstart', closeOnOutside)
    return () => {
      document.removeEventListener('mousedown', closeOnOutside)
      document.removeEventListener('touchstart', closeOnOutside)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    optionRefs.current[activeIndex]?.focus()
  }, [activeIndex, open])

  function selectOption(option) {
    if (disabled || !option) return
    onChange?.(option.value)
    setOpen(false)
    window.requestAnimationFrame(() => buttonRef.current?.focus())
  }

  function handleButtonKeyDown(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setOpen(true)
    }
    if (event.key === 'Escape') setOpen(false)
  }

  function handleOptionKeyDown(event, index) {
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      buttonRef.current?.focus()
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      selectOption(items[index])
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      optionRefs.current[Math.min(index + 1, items.length - 1)]?.focus()
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      optionRefs.current[Math.max(index - 1, 0)]?.focus()
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`.trim()}>
      {label && (
        <label id={`${id}-label`} className="mb-2 block text-sm font-medium text-ink">
          {label}
        </label>
      )}
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        required={required}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={label ? `${id}-label ${id}-button` : undefined}
        aria-label={label ? undefined : ariaLabel}
        aria-describedby={helperId}
        id={`${id}-button`}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleButtonKeyDown}
        className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl border bg-paper/85 px-4 py-3 text-left text-sm text-ink shadow-[0_18px_45px_-38px_rgba(13,35,64,0.55)] outline-none backdrop-blur transition hover:border-ink/30 hover:bg-paper focus:border-ink focus:ring-2 focus:ring-ink/10 disabled:cursor-not-allowed disabled:opacity-55 ${error ? 'border-red-300 bg-red-50/70 text-red-800 focus:ring-red-100' : 'border-line'} ${buttonClassName}`.trim()}
      >
        <span className={`min-w-0 flex-1 truncate ${selected ? '' : 'text-muted'}`}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown size={17} className={`shrink-0 text-muted transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          role="listbox"
          aria-labelledby={label ? `${id}-label` : undefined}
          className={`absolute left-0 right-0 z-50 mt-2 max-h-72 overflow-y-auto totsan-scrollbar rounded-2xl border border-line bg-paper/95 p-1.5 shadow-[0_24px_70px_-36px_rgba(13,35,64,0.55)] backdrop-blur-xl ${menuClassName}`.trim()}
        >
          {items.map((option, index) => {
            const isSelected = String(option.value) === String(value)
            return (
              <button
                key={option.value}
                ref={(node) => { optionRefs.current[index] = node }}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => selectOption(option)}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
                className={`flex w-full items-start justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm outline-none transition hover:bg-soft focus:bg-soft ${isSelected ? 'bg-accentSoft text-accentDeep' : 'text-ink'}`}
              >
                <span className="min-w-0 whitespace-normal break-words leading-5">{option.label}</span>
                {isSelected && <Check size={16} className="mt-0.5 shrink-0" />}
              </button>
            )
          })}
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
