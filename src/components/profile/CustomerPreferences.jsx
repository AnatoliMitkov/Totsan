import { useEffect, useState } from 'react'
import { Save, X, Lock, Sparkles } from 'lucide-react'

// ─── Option definitions ─────────────────────────────────────────────────────

const INTEREST_OPTIONS = [
  'Интериорен дизайн',
  'Архитектура',
  'Строителство',
  'Обзавеждане',
  'Материали',
  'Умен дом',
  'Градина',
  'Направи си сам',
]

const STYLE_OPTIONS = [
  'Минималистичен',
  'Модерен',
  'Класически',
  'Индустриален',
  'Скандинавски',
  'Средиземноморски',
  'Еклектичен',
  'Все още не съм сигурен',
]

const CONTACT_OPTIONS = [
  'Чат',
  'Телефон',
  'Имейл',
  'Нямам предпочитание',
]

const AGE_GROUP_OPTIONS = [
  '18–24',
  '25–34',
  '35–44',
  '45–54',
  '55+',
  'Предпочитам да не казвам',
]

const GENDER_OPTIONS = [
  'Жена',
  'Мъж',
  'Друго',
  'Предпочитам да не казвам',
]

// ─── Draft builder ──────────────────────────────────────────────────────────

function makeDraft(account) {
  return {
    interests: Array.isArray(account?.interests) ? [...account.interests] : [],
    stylePreferences: Array.isArray(account?.style_preferences) ? [...account.style_preferences] : [],
    preferredContactMethod: account?.preferred_contact_method || '',
    ageGroup: account?.age_group || '',
    gender: account?.gender || '',
  }
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function MultiChipGroup({ label, options, selected, onChange, id }) {
  function toggle(value) {
    const next = selected.includes(value)
      ? selected.filter(v => v !== value)
      : [...selected, value]
    onChange(next)
  }

  return (
    <fieldset id={id} className="space-y-2">
      <legend className="text-sm font-medium text-ink">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(option => {
          const active = selected.includes(option)
          return (
            <button
              key={option}
              type="button"
              onClick={() => toggle(option)}
              className={`
                inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm
                transition-all duration-200 select-none
                ${active
                  ? 'border-accent bg-accentSoft text-accentDeep shadow-sm'
                  : 'border-line bg-paper text-muted hover:border-ink hover:text-ink hover:bg-soft'
                }
              `}
            >
              {option}
            </button>
          )
        })}
      </div>
      {selected.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink transition mt-1"
        >
          <X size={12} /> Изчисти
        </button>
      )}
    </fieldset>
  )
}

function SingleChipGroup({ label, options, selected, onChange, id, isPrivate }) {
  return (
    <fieldset id={id} className="space-y-2">
      <legend className="text-sm font-medium text-ink flex items-center gap-1.5">
        {label}
        {isPrivate && (
          <span className="inline-flex items-center gap-1 rounded-full bg-soft border border-line px-2 py-0.5 text-[0.65rem] uppercase tracking-wider text-muted font-normal">
            <Lock size={10} /> лично
          </span>
        )}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map(option => {
          const active = selected === option
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(active ? '' : option)}
              className={`
                inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm
                transition-all duration-200 select-none
                ${active
                  ? 'border-accent bg-accentSoft text-accentDeep shadow-sm'
                  : 'border-line bg-paper text-muted hover:border-ink hover:text-ink hover:bg-soft'
                }
              `}
            >
              {option}
            </button>
          )
        })}
      </div>
      {selected && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink transition mt-1"
        >
          <X size={12} /> Изчисти
        </button>
      )}
    </fieldset>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function CustomerPreferences({ account, session, onSave }) {
  const [draft, setDraft] = useState(() => makeDraft(account))
  const [status, setStatus] = useState({ type: 'idle', message: '' })

  useEffect(() => {
    setDraft(makeDraft(account))
  }, [account])

  function updateMulti(key, value) {
    setDraft(current => ({ ...current, [key]: value }))
  }

  function updateSingle(key, value) {
    setDraft(current => ({ ...current, [key]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    setStatus({ type: 'saving', message: 'Запазваме предпочитанията…' })
    try {
      // Merge draft preferences with existing account personal data
      // so we don't wipe out existing fields when saving preferences.
      const merged = {
        fullName: account?.full_name || '',
        displayName: account?.display_name || '',
        phone: account?.phone || '',
        avatarUrl: account?.avatar_url || '',
        city: account?.city || '',
        country: account?.country || 'BG',
        bio: account?.bio || '',
        locale: account?.locale || 'bg',
        marketingOptIn: Boolean(account?.marketing_opt_in),
        ...draft,
      }
      await onSave(merged)
      setStatus({ type: 'saved', message: 'Предпочитанията са запазени.' })
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Записът не успя.' })
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5 lg:grid-cols-12">
      <div className="lg:col-span-8 rounded-3xl border border-line bg-paper p-5 md:p-7 space-y-6">
        {/* Header */}
        <div>
          <div className="eyebrow">Предпочитания</div>
          <h2 className="mt-2 font-display text-3xl text-ink">Какво те интересува?</h2>
          <p className="mt-2 text-sm text-muted max-w-xl">
            Използваме тези предпочитания, за да показваме по-подходящи специалисти, услуги и съдържание.
          </p>
        </div>

        {/* Interests */}
        <MultiChipGroup
          id="pref-interests"
          label="Интереси"
          options={INTEREST_OPTIONS}
          selected={draft.interests}
          onChange={value => updateMulti('interests', value)}
        />

        {/* Style */}
        <MultiChipGroup
          id="pref-style"
          label="Стилови предпочитания"
          options={STYLE_OPTIONS}
          selected={draft.stylePreferences}
          onChange={value => updateMulti('stylePreferences', value)}
        />

        {/* Contact method */}
        <SingleChipGroup
          id="pref-contact"
          label="Предпочитан начин за контакт"
          options={CONTACT_OPTIONS}
          selected={draft.preferredContactMethod}
          onChange={value => updateSingle('preferredContactMethod', value)}
        />

        {/* Divider for private section */}
        <div className="border-t border-line" />

        {/* Age group — private */}
        <SingleChipGroup
          id="pref-age"
          label="Възрастова група"
          options={AGE_GROUP_OPTIONS}
          selected={draft.ageGroup}
          onChange={value => updateSingle('ageGroup', value)}
          isPrivate
        />

        {/* Gender — private */}
        <SingleChipGroup
          id="pref-gender"
          label="Пол"
          options={GENDER_OPTIONS}
          selected={draft.gender}
          onChange={value => updateSingle('gender', value)}
          isPrivate
        />

        {/* Save bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <div className={`text-sm ${status.type === 'error' ? 'text-red-700' : 'text-muted'}`}>
            {status.message || 'Всички полета са по желание.'}
          </div>
          <button className="btn btn-primary" disabled={status.type === 'saving'}>
            <Save size={18} />
            {status.type === 'saving' ? 'Запазва се…' : 'Запази'}
          </button>
        </div>
      </div>

      {/* Sidebar info card */}
      <aside className="lg:col-span-4">
        <div className="rounded-3xl border border-line bg-paper p-5 md:p-6 lg:sticky lg:top-24 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-accent" />
            <div className="eyebrow">Защо питаме?</div>
          </div>
          <p className="text-sm text-muted leading-relaxed">
            Тези данни ни помагат да ти предложим по-подходящи специалисти и
            съдържание. Нищо не е задължително — споделяш само каквото пожелаеш.
          </p>
          <div className="rounded-2xl border border-line bg-soft p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-ink">
              <Lock size={14} className="text-muted" />
              Лични данни
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Възрастова група и пол не се показват публично — използват
              се единствено за статистика и по-добри препоръки.
            </p>
          </div>
        </div>
      </aside>
    </form>
  )
}
