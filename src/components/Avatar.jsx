import { useEffect, useMemo, useState } from 'react'

export default function Avatar({ src, srcCandidates = [], name, size = 36, className = '', imgStyle = {} }) {
  const initial = (name || '?')[0].toUpperCase()
  const candidates = useMemo(() => {
    const list = Array.isArray(srcCandidates) ? srcCandidates : []
    return [...new Set([src, ...list].filter(Boolean))]
  }, [src, srcCandidates])
  const [currentIndex, setCurrentIndex] = useState(0)
  const currentSrc = candidates[currentIndex] || ''

  useEffect(() => {
    setCurrentIndex(0)
  }, [candidates])

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-soft ${className}`}
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
        className="flex items-center justify-center font-medium text-ink/70"
        style={{ fontSize: Math.max(10, size * 0.4), display: currentSrc ? 'none' : 'flex' }}
      >
        {initial}
      </span>
    </div>
  )
}
