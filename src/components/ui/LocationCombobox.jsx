import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, MapPin, Search, X } from 'lucide-react'
import TotsanSelect from './TotsanSelect.jsx'
import {
  BULGARIA_REGIONS,
  BULGARIA_SETTLEMENTS,
  cityStorageValue,
  findBulgarianCity,
  locationCountKey,
  locationDisplayValue,
  normalizeLocationList,
  normalizeLocationValue,
} from '../../lib/locations.js'

const INPUT_CLASS = 'mt-2 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-sm outline-none transition focus:border-ink'
const DEFAULT_REGION = BULGARIA_REGIONS.includes('София град') ? 'София град' : BULGARIA_REGIONS[0]
const SPECIAL_LOCATION_OPTIONS = ['За цялата страна', 'Извън България']

function optionMatches(option, needle) {
  const query = String(needle || '').trim().toLocaleLowerCase('bg-BG')
  if (!query) return true
  return option.searchText.includes(query)
}

function valueForMode(city, storageMode) {
  if (storageMode === 'cityWithOblast') return cityStorageValue(city)
  if (storageMode === 'id') return city.id
  return city.name
}

export function LocationCombobox({
  label = 'Населено място',
  value = '',
  onChange,
  onSelect,
  required = false,
  storageMode = 'name',
  placeholder = 'Избери населено място',
  helper = '',
  className = '',
  topRightSlot = null,
}) {
  const id = useId()
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const selectedCity = findBulgarianCity(value)
  const [region, setRegion] = useState(() => selectedCity?.oblast || DEFAULT_REGION)
  const [query, setQuery] = useState(() => (
    selectedCity ? selectedCity.name : normalizeLocationValue(value)
  ))
  const [open, setOpen] = useState(false)
  const hasQuery = Boolean(query.trim())
  const queryMatchesSelection = Boolean(selectedCity && query.trim() === selectedCity.name)
  const hasOfficialSelection = Boolean(selectedCity)
  const error = hasQuery && !queryMatchesSelection
    ? 'Избери населено място от официалния списък.'
    : required && !hasOfficialSelection
      ? 'Избери населено място.'
      : ''

  useEffect(() => {
    const nextCity = findBulgarianCity(value)
    if (nextCity) {
      setQuery(nextCity.name)
      setRegion(nextCity.oblast)
      return
    }

    setQuery(normalizeLocationValue(value))
  }, [value])

  useEffect(() => {
    inputRef.current?.setCustomValidity(error)
  }, [error])

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

  const options = useMemo(() => (
    BULGARIA_SETTLEMENTS
      .filter((option) => option.region === region)
      .filter((option) => optionMatches(option, query))
      .slice(0, 60)
  ), [query, region])

  function selectSettlement(option) {
    onChange?.(valueForMode(option, storageMode))
    onSelect?.(option)
    setQuery(option.name)
    setRegion(option.oblast)
    setOpen(false)
  }

  function normalizeTypedValue() {
    const known = findBulgarianCity(query, region)
    if (known) {
      selectSettlement(known)
      return
    }

    setQuery(selectedCity ? selectedCity.name : normalizeLocationValue(value))
  }

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className || ''}`.trim()}>
      <div className="grid min-w-0 gap-4 sm:grid-cols-5">
        <div className="sm:col-span-2">
          <TotsanSelect
            label="Област"
            value={region}
            onChange={(nextRegion) => {
              setRegion(nextRegion)
              setQuery('')
              setOpen(true)
              if (selectedCity) onChange?.('')
            }}
            options={BULGARIA_REGIONS.map((item) => ({ value: item, label: item }))}
          />
        </div>
        <div className="min-w-0 sm:col-span-3">
          <label htmlFor={id} className="block text-sm font-medium text-ink">{label}</label>
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 mt-1 -translate-y-1/2 text-muted" />
            <input
              ref={inputRef}
              id={id}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setOpen(true)
              }}
              onFocus={() => setOpen(true)}
              onBlur={normalizeTypedValue}
              required={required}
              className={`${INPUT_CLASS} pl-11 ${error ? 'border-red-300 bg-red-50/70' : ''}`}
              placeholder={placeholder}
              autoComplete="off"
              role="combobox"
              aria-expanded={open}
              aria-invalid={Boolean(error)}
              aria-controls={`${id}-listbox`}
            />
          </div>
          {(helper || error) && <p className={`mt-1.5 text-xs ${error ? 'text-red-700' : 'text-muted'}`}>{error || helper}</p>}
        </div>
        {topRightSlot && <div className="-mt-1 sm:col-span-5">{topRightSlot}</div>}
      </div>

      {open && (
        <div id={`${id}-listbox`} role="listbox" className="absolute left-0 right-0 z-50 mt-2 max-h-72 overflow-y-auto totsan-scrollbar rounded-2xl border border-line bg-paper/95 p-1.5 shadow-[0_24px_70px_-36px_rgba(13,35,64,0.55)] backdrop-blur-xl">
          {options.map((option) => {
            const isSelected = selectedCity?.id === option.id
            return (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectSettlement(option)}
                className={`flex w-full items-start justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm outline-none transition hover:bg-soft focus:bg-soft ${isSelected ? 'bg-accentSoft text-accentDeep' : 'text-ink'}`}
              >
                <span>
                  <span className="block font-medium">{option.name}</span>
                  <span className="mt-0.5 block text-xs text-muted">{option.oblast}</span>
                </span>
                {isSelected && <Check size={16} className="mt-0.5 shrink-0" />}
              </button>
            )
          })}
          {options.length === 0 && (
            <div className="px-3 py-4 text-sm text-muted">Няма съвпадение в избраната област.</div>
          )}
        </div>
      )}
    </div>
  )
}

export function LocationMultiCombobox({
  label = 'Райони',
  value = '',
  onChange,
  helper = '',
  bottomLeftSlot = null,
}) {
  const list = normalizeLocationList(value, { storage: 'cityWithOblast' })

  function setList(nextList) {
    onChange?.(normalizeLocationList(nextList, { storage: 'cityWithOblast' }).join(', '))
  }

  function addSpecialOption(option) {
    if (list.includes(option)) return
    setList([...list, option])
  }

  return (
    <div>
      <LocationCombobox
        key={list.join('|')}
        label={label}
        value=""
        onChange={(nextValue) => setList([...list, nextValue])}
        storageMode="cityWithOblast"
        placeholder="Избери град"
        helper={helper}
        className="mb-4"
        topRightSlot={
          <div className="flex flex-wrap gap-2">
            {SPECIAL_LOCATION_OPTIONS.map((option) => {
              const selected = list.includes(option)
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => addSpecialOption(option)}
                  disabled={selected}
                  className={`inline-flex h-11 items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-medium transition ${
                    selected
                      ? 'border-accentDeep/20 bg-accentSoft text-accentDeep'
                      : 'border-line bg-paper text-ink hover:border-ink/30 hover:bg-soft'
                  }`}
                >
                  {selected && <Check size={14} />}
                  {option}
                </button>
              )
            })}
          </div>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        {bottomLeftSlot && (
          <div className="sm:col-span-1">
            {bottomLeftSlot}
          </div>
        )}
        <div className={bottomLeftSlot ? 'sm:col-span-2' : 'sm:col-span-3'}>
          {list.length > 0 && (
            <div className="rounded-2xl bg-gradient-to-r from-accentDeep to-purple-500 p-[1.5px]">
              <div className="flex h-full flex-col gap-3 rounded-[14px] bg-paper p-4">
                <div className="flex flex-wrap gap-2">
                  {list.map((item) => (
                    <span key={locationCountKey(item) || item} className="inline-flex items-center gap-2 rounded-full border border-line bg-soft px-3 py-1.5 text-sm text-ink">
                      <MapPin size={14} className="text-accentDeep" />
                      {locationDisplayValue(item)}
                      <button type="button" onClick={() => setList(list.filter((current) => current !== item))} className="rounded-full p-0.5 text-muted transition hover:bg-paper hover:text-red-700" aria-label={`Премахни ${locationDisplayValue(item)}`}>
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
