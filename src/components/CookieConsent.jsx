import { useEffect, useRef, useState } from 'react'
import {
  createConsentPreferences,
  getStoredConsent,
  saveConsent,
  updateConsentFromPreferences,
} from '../utils/consentMode.js'

const OPEN_COOKIE_SETTINGS_EVENT = 'totsan:open-cookie-settings'

function preferenceFromStored() {
  const stored = getStoredConsent()
  return {
    analytics: stored?.analytics === true,
    marketing: stored?.marketing === true,
  }
}

export function openCookieSettings() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT))
}

export default function CookieConsent() {
  const [isReady, setIsReady] = useState(false)
  const [showBanner, setShowBanner] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [preferences, setPreferences] = useState({ analytics: false, marketing: false })
  const modalRef = useRef(null)
  const previousFocusRef = useRef(null)

  useEffect(() => {
    const stored = getStoredConsent()

    if (stored) {
      updateConsentFromPreferences(stored)
      setPreferences({ analytics: stored.analytics, marketing: stored.marketing })
      setShowBanner(false)
    } else {
      setPreferences({ analytics: false, marketing: false })
      setShowBanner(true)
    }

    setIsReady(true)
  }, [])

  useEffect(() => {
    const openSettings = () => {
      previousFocusRef.current = document.activeElement
      setPreferences(preferenceFromStored())
      setShowBanner(false)
      setShowSettings(true)
    }

    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, openSettings)
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, openSettings)
  }, [])

  useEffect(() => {
    if (!showSettings) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusableSelector = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',')

    const focusFirstControl = () => {
      const focusable = modalRef.current?.querySelectorAll(focusableSelector)
      focusable?.[0]?.focus()
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowSettings(false)
        if (!getStoredConsent()) setShowBanner(true)
        return
      }

      if (event.key !== 'Tab') return

      const focusable = Array.from(modalRef.current?.querySelectorAll(focusableSelector) || [])
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.setTimeout(focusFirstControl, 0)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      previousFocusRef.current?.focus?.()
    }
  }, [showSettings])

  function persist(nextPreferences) {
    saveConsent(createConsentPreferences(nextPreferences))
    setPreferences(nextPreferences)
    setShowBanner(false)
    setShowSettings(false)
  }

  function acceptAll() {
    persist({ analytics: true, marketing: true })
  }

  function rejectOptional() {
    persist({ analytics: false, marketing: false })
  }

  function openSettingsFromBanner() {
    previousFocusRef.current = document.activeElement
    setShowBanner(false)
    setShowSettings(true)
  }

  if (!isReady) return null

  return (
    <>
      {showBanner && (
        <section
          className="cookie-consent"
          aria-label="Избор за бисквитки"
        >
          <div className="cookie-consent__content">
            <div className="cookie-consent__copy">
              <h2>Бисквитки в Totsan</h2>
              <p>
                Използваме необходими бисквитки за работата и сигурността на сайта.
                С ваше съгласие използваме и аналитични и маркетинг бисквитки, за да
                подобряваме услугата и кампаниите си.
              </p>
            </div>
            <div className="cookie-consent__actions">
              <button type="button" className="btn btn-primary" onClick={acceptAll}>
                Приемам всички
              </button>
              <button type="button" className="btn btn-ghost" onClick={rejectOptional}>
                Отказвам незадължителните
              </button>
              <button type="button" className="cookie-consent__link" onClick={openSettingsFromBanner}>
                Настройки
              </button>
            </div>
          </div>
        </section>
      )}

      {showSettings && (
        <div className="cookie-modal" role="presentation">
          <button
            type="button"
            className="cookie-modal__backdrop"
            aria-label="Затвори настройките за бисквитки"
            onClick={() => {
              setShowSettings(false)
              if (!getStoredConsent()) setShowBanner(true)
            }}
          />
          <section
            ref={modalRef}
            className="cookie-modal__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cookie-modal-title"
            aria-describedby="cookie-modal-description"
          >
            <div className="cookie-modal__header">
              <div>
                <p className="eyebrow">Поверителност</p>
                <h2 id="cookie-modal-title">Настройки за бисквитки</h2>
              </div>
              <button
                type="button"
                className="cookie-modal__close"
                aria-label="Затвори"
                onClick={() => {
                  setShowSettings(false)
                  if (!getStoredConsent()) setShowBanner(true)
                }}
              >
                ×
              </button>
            </div>

            <p id="cookie-modal-description" className="cookie-modal__description">
              Можете да управлявате незадължителните категории. Необходимите бисквитки
              са винаги активни, защото поддържат основната работа и сигурността на сайта.
            </p>

            <div className="cookie-modal__options">
              <CookieOption
                title="Необходими"
                description="Вход, сигурност, запазване на основни настройки и стабилна работа на сайта."
                checked
                disabled
              />
              <CookieOption
                title="Аналитични"
                description="Помагат ни да разбираме кои страници се използват и как да подобрим Totsan."
                checked={preferences.analytics}
                onChange={(checked) => setPreferences((current) => ({ ...current, analytics: checked }))}
              />
              <CookieOption
                title="Маркетинг"
                description="Позволяват измерване на кампании и бъдещи рекламни пиксели само след съгласие."
                checked={preferences.marketing}
                onChange={(checked) => setPreferences((current) => ({ ...current, marketing: checked }))}
              />
            </div>

            <div className="cookie-modal__actions">
              <button type="button" className="btn btn-ghost" onClick={rejectOptional}>
                Отказвам незадължителните
              </button>
              <button type="button" className="btn btn-primary" onClick={() => persist(preferences)}>
                Запази избора
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}

function CookieOption({ title, description, checked, disabled = false, onChange }) {
  const id = `cookie-${title.toLowerCase().replace(/\s+/g, '-')}`

  return (
    <label className={`cookie-option ${disabled ? 'cookie-option--disabled' : ''}`} htmlFor={id}>
      <span className="cookie-option__text">
        <span className="cookie-option__title">{title}</span>
        <span className="cookie-option__description">{description}</span>
      </span>
      <span className="cookie-option__control">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange?.(event.target.checked)}
        />
        <span className="cookie-option__switch" aria-hidden="true" />
      </span>
    </label>
  )
}
