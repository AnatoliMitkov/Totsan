import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { LAYERS } from '../../data/layers.js'

function layerLabel(slug) {
  const layer = LAYERS.find(item => item.slug === slug)
  return layer ? `Слой ${layer.number} · ${layer.title}` : 'Проект'
}

export default function PortfolioGallery({ items = [], emptyText = 'Още няма публикувано портфолио.' }) {
  const visibleItems = useMemo(() => items.filter(Boolean), [items])
  const [activeIndex, setActiveIndex] = useState(-1)
  const activeItem = activeIndex >= 0 ? visibleItems[activeIndex] : null

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
        {visibleItems.map((item, index) => (
          <button
            key={item.id || item.title}
            type="button"
            onClick={() => setActiveIndex(index)}
            className="group w-full overflow-hidden rounded-2xl border border-line/60 bg-paper text-left transition-all duration-300 hover:-translate-y-1 hover:border-ink/35 hover:shadow-[0_12px_30px_rgba(13,35,64,0.08)]"
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-soft">
              {item.coverUrl ? (
                <img src={item.coverUrl} alt={item.title} className="img-cover transition duration-700 ease-out group-hover:scale-[1.06]" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted text-sm font-medium">Няма снимка</div>
              )}
              <div className="absolute inset-0 bg-ink/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
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
        ))}
      </div>

      {activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4" role="dialog" aria-modal="true">
          <div className="relative max-h-[92vh] w-full max-w-5xl overflow-auto rounded-3xl bg-paper">
            <button type="button" onClick={() => setActiveIndex(-1)} className="absolute right-4 top-4 z-10 rounded-full bg-paper/90 p-2 text-ink shadow" aria-label="Затвори">
              <X size={20} />
            </button>
            <div className="grid lg:grid-cols-2">
              <div className="min-h-[20rem] bg-soft">
                {activeItem.coverUrl ? <img src={activeItem.coverUrl} alt={activeItem.title} className="h-full min-h-[20rem] w-full object-cover" /> : <div className="flex min-h-[20rem] items-center justify-center text-muted">Без снимка</div>}
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

                {activeItem.media?.length > 1 && (
                  <div className="mt-6 grid grid-cols-3 gap-3">
                    {activeItem.media.slice(0, 6).map((media, mediaIndex) => (
                      <div key={`${media.url}-${mediaIndex}`} className="aspect-square overflow-hidden rounded-xl bg-soft">
                        <img src={media.url} alt={media.caption || activeItem.title} className="img-cover" />
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
