import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, PlayCircle, Video, X } from 'lucide-react'
import { LAYERS } from '../../data/layers.js'

function layerLabel(slug) {
  const layer = LAYERS.find(item => item.slug === slug)
  return layer ? `Слой ${layer.number} · ${layer.title}` : 'Проект'
}

function isVideoMedia(item = {}) {
  return item.type === 'video' || item.provider === 'youtube' || item.kind === 'video'
}

function getYoutubeVideoId(url = '') {
  const value = String(url || '').trim()
  if (!value) return ''

  try {
    const parsed = new URL(value)
    if (parsed.hostname.includes('youtu.be')) return parsed.pathname.replace('/', '').split(/[?&]/)[0]
    if (parsed.hostname.includes('youtube.com')) {
      if (parsed.pathname.startsWith('/shorts/')) return parsed.pathname.split('/')[2] || ''
      if (parsed.pathname.startsWith('/embed/')) return parsed.pathname.split('/')[2] || ''
      return parsed.searchParams.get('v') || ''
    }
  } catch {
    const match = value.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([^?&/\s]+)/)
    return match?.[1] || ''
  }

  return ''
}

function normalizeVideoUrl(url = '') {
  const value = String(url || '').trim()
  if (!value) return ''
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`
  try {
    const parsed = new URL(candidate)
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : ''
  } catch {
    return ''
  }
}

function getYoutubeThumbnail(url = '') {
  const id = getYoutubeVideoId(url)
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : ''
}

function getYoutubeEmbedUrl(url = '') {
  const id = getYoutubeVideoId(url)
  return id ? `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&enablejsapi=1` : ''
}

function getMediaPreviewUrl(item = {}) {
  if (!item) return ''
  if (isVideoMedia(item)) return item.thumbnail || getYoutubeThumbnail(item.url) || ''
  return item.url || ''
}

function getPortfolioMedia(item = {}) {
  const media = Array.isArray(item.media) ? item.media.filter(Boolean) : []
  if (media.length) return media
  return item.coverUrl ? [{ type: 'image', url: item.coverUrl }] : []
}

function getProjectCover(item = {}) {
  const firstPreview = getPortfolioMedia(item).map(getMediaPreviewUrl).find(Boolean)
  return firstPreview || item.coverUrl || ''
}

export default function PortfolioGallery({ items = [], emptyText = 'Още няма публикувано портфолио.' }) {
  const visibleItems = useMemo(() => items.filter(Boolean), [items])
  const [activeIndex, setActiveIndex] = useState(-1)
  const activeItem = activeIndex >= 0 ? visibleItems[activeIndex] : null
  const activeMedia = activeItem ? getPortfolioMedia(activeItem) : []
  const activeHeroMedia = activeMedia[0] || null

  useEffect(() => {
    if (!activeItem) return undefined

    function onKeyDown(event) {
      if (event.key === 'Escape') setActiveIndex(-1)
      if (event.key === 'ArrowRight') setActiveIndex(current => (current + 1) % visibleItems.length)
      if (event.key === 'ArrowLeft') setActiveIndex(current => (current - 1 + visibleItems.length) % visibleItems.length)
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [activeItem, visibleItems.length])

  if (visibleItems.length === 0) {
    return <div className="rounded-2xl border border-line bg-soft p-6 text-sm text-muted">{emptyText}</div>
  }

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {visibleItems.map((item, index) => {
          const cover = getProjectCover(item)
          const firstMedia = getPortfolioMedia(item)[0]
          const hasVideo = getPortfolioMedia(item).some(isVideoMedia)

          return (
            <button
              key={item.id || item.title}
              type="button"
              onClick={() => setActiveIndex(index)}
              className="group w-full overflow-hidden rounded-2xl border border-line/60 bg-paper text-left transition-all duration-300 hover:-translate-y-1 hover:border-ink/35 hover:shadow-[0_12px_30px_rgba(13,35,64,0.08)]"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-soft">
                {cover ? (
                  <img src={cover} alt={item.title} className="img-cover transition duration-700 ease-out group-hover:scale-[1.06]" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted text-sm font-medium">Няма снимка</div>
                )}
                <div className="absolute inset-0 bg-ink/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                {isVideoMedia(firstMedia) && (
                  <span className="absolute inset-0 flex items-center justify-center text-paper drop-shadow">
                    <PlayCircle size={42} />
                  </span>
                )}
                {hasVideo && (
                  <span className="absolute right-3 top-3 rounded-full bg-ink/82 px-3 py-1 text-[11px] font-semibold text-paper backdrop-blur">
                    Видео
                  </span>
                )}
              </div>
              <div className="p-5">
                <span className="inline-flex items-center rounded-full bg-soft px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accentDeep">
                  {layerLabel(item.layerSlug).split(' · ')[0]}
                </span>
                <h4 className="mt-2 font-display text-xl font-semibold text-ink group-hover:text-accent transition-colors duration-200 line-clamp-1">{item.title}</h4>
                <div className="mt-2 flex items-center justify-between text-xs text-muted">
                  <span>{item.city || 'България'}</span>
                  <span>{item.year || ''}</span>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4" role="dialog" aria-modal="true">
          <div className="relative max-h-[92vh] w-full max-w-5xl overflow-auto rounded-3xl bg-paper">
            <button type="button" onClick={() => setActiveIndex(-1)} className="absolute right-4 top-4 z-10 rounded-full bg-paper/90 p-2 text-ink shadow" aria-label="Затвори">
              <X size={20} />
            </button>
            <div className="grid lg:grid-cols-2">
              <div className="min-h-[20rem] bg-soft">
                <PortfolioMediaPreview media={activeHeroMedia} title={activeItem.title} className="h-full min-h-[20rem] w-full" />
              </div>
              <div className="p-6 md:p-8">
                <div className="eyebrow">{layerLabel(activeItem.layerSlug)}</div>
                <h3 className="mt-2 font-display text-4xl leading-tight text-ink">{activeItem.title}</h3>
                <div className="mt-4 flex flex-wrap gap-2 text-sm text-muted">
                  {activeItem.city && <span className="rounded-full border border-line px-3 py-1">{activeItem.city}</span>}
                  {activeItem.year && <span className="rounded-full border border-line px-3 py-1">{activeItem.year}</span>}
                  {activeItem.budgetBand && <span className="rounded-full border border-line px-3 py-1">{activeItem.budgetBand}</span>}
                </div>
                {activeItem.description && <p className="mt-5 whitespace-pre-wrap text-muted">{activeItem.description}</p>}

                {activeMedia.length > 1 && (
                  <div className="mt-6 grid grid-cols-3 gap-3">
                    {activeMedia.slice(0, 6).map((media, mediaIndex) => (
                      <div key={`${media.url}-${mediaIndex}`} className="aspect-square overflow-hidden rounded-xl bg-soft">
                        <PortfolioMediaPreview media={media} title={media.caption || activeItem.title} compact />
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-8 flex items-center justify-between border-t border-line pt-5">
                  <button type="button" className="btn btn-ghost" onClick={() => setActiveIndex(current => (current - 1 + visibleItems.length) % visibleItems.length)}>
                    <ChevronLeft size={18} />
                    Назад
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setActiveIndex(current => (current + 1) % visibleItems.length)}>
                    Напред
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function PortfolioMediaPreview({ media, title, compact = false, className = 'h-full w-full' }) {
  if (!media) return <div className="flex h-full min-h-[20rem] items-center justify-center text-muted">Без снимка</div>

  if (isVideoMedia(media)) {
    return <LazyPortfolioVideo media={media} title={title} compact={compact} className={className} />
  }

  const preview = getMediaPreviewUrl(media)
  if (!preview) return <div className="flex h-full min-h-[20rem] items-center justify-center text-muted">Без снимка</div>
  return <img src={preview} alt={title} className={`${className} object-cover`} />
}

function LazyPortfolioVideo({ media, title, compact, className }) {
  const containerRef = useRef(null)
  const [isVisible, setIsVisible] = useState(false)
  const embedUrl = getYoutubeEmbedUrl(media.url)
  const thumbnail = getMediaPreviewUrl(media)
  const safeUrl = normalizeVideoUrl(media.url)

  useEffect(() => {
    const node = containerRef.current
    if (!node) return undefined
    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true)
      return undefined
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(Boolean(entry?.isIntersecting)),
      { threshold: 0.35 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  if (!embedUrl) {
    return (
      <div ref={containerRef} className={`${className} flex flex-col items-center justify-center gap-2 bg-[linear-gradient(135deg,rgba(13,35,64,0.92),rgba(25,84,143,0.72))] p-4 text-center text-paper`}>
        <Video size={compact ? 20 : 30} />
        <div className={compact ? 'text-xs font-semibold' : 'text-sm font-semibold'}>Видео линк</div>
        {safeUrl && !compact && (
          <a href={safeUrl} target="_blank" rel="noreferrer" className="rounded-full bg-white/16 px-3 py-1 text-xs font-semibold transition hover:bg-white/24">
            Отвори видео
          </a>
        )}
      </div>
    )
  }

  return (
    <div ref={containerRef} className={`${className} relative overflow-hidden bg-ink`}>
      {isVisible && !compact ? (
        <iframe
          key={embedUrl}
          src={embedUrl}
          title={title}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
        />
      ) : (
        <div className="relative h-full w-full">
          {thumbnail ? <img src={thumbnail} alt="" className="img-cover opacity-75" /> : <div className="h-full w-full bg-ink" />}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink/35 text-paper">
            <PlayCircle size={compact ? 26 : 40} />
            {!compact && <span className="text-xs font-semibold uppercase tracking-[0.16em]">Видео</span>}
          </div>
        </div>
      )}
    </div>
  )
}
