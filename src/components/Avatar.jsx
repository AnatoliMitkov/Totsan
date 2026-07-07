import { useEffect, useMemo, useState } from 'react'
import { getProfileAvatarVariant } from '../lib/profiles.js'

export default function Avatar({ src, srcCandidates = [], name, size = 36, className = '', imgStyle = {}, variant = '' }) {
  const initial = getInitials(name)
  const resolvedVariant = variant || (size <= 44 ? 'tiny' : (size <= 150 ? 'card' : 'profile'))
  const resolvedSrc = getProfileAvatarVariant(src, resolvedVariant)
  const preferVariant = Boolean(variant)

  const candidates = useMemo(() => {
    const list = Array.isArray(srcCandidates) ? srcCandidates : []
    const mappedList = list.map(c => getProfileAvatarVariant(c, resolvedVariant))
    const primaryList = preferVariant
      ? [resolvedSrc, src, ...mappedList, ...list]
      : [src, resolvedSrc, ...list, ...mappedList]
    return [...new Set(primaryList.filter(Boolean))]
  }, [preferVariant, resolvedSrc, src, srcCandidates, resolvedVariant])
  const [currentIndex, setCurrentIndex] = useState(0)
  const currentSrc = candidates[currentIndex] || ''

  useEffect(() => {
    setCurrentIndex(0)
  }, [candidates])

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-gradient-to-br from-accentSoft via-paper to-cloud ${className}`}
      style={{ width: size, height: size }}
    >
      {currentSrc ? (
        <img
          key={currentSrc}
          src={currentSrc}
          alt={name || 'Аватар'}
          className="absolute inset-0 h-full w-full object-cover"
          style={imgStyle}
          onError={() => {
            setCurrentIndex((index) => {
              if (index >= candidates.length - 1) return candidates.length
              return index + 1
            })
          }}
        />
      ) : null}
      <span
        className="flex items-center justify-center font-medium text-accentDeep"
        style={{ fontSize: Math.max(10, size * 0.4), display: currentSrc ? 'none' : 'flex' }}
      >
        {initial}
      </span>
    </div>
  )
}

function getInitials(value = '') {
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase()
  return (parts[0]?.[0] || '?').toUpperCase()
}
