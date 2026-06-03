import { useEffect, useMemo, useState } from 'react'

function uniqueSources(sources = []) {
  return sources
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index)
}

export default function FallbackImage({
  sources = [],
  alt = '',
  className = '',
  style,
  loading,
  decoding,
  ...props
}) {
  const candidates = useMemo(() => uniqueSources(sources), [sources])
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex(0)
  }, [candidates])

  const src = candidates[index] || ''
  if (!src) return null

  return (
    <img
      {...props}
      src={src}
      alt={alt}
      className={className}
      style={style}
      loading={loading}
      decoding={decoding}
      onError={() => {
        setIndex((current) => (current + 1 < candidates.length ? current + 1 : current))
      }}
    />
  )
}
