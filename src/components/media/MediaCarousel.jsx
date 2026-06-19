import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Image as ImageIcon, Maximize2, X } from 'lucide-react'

export function getExtension(value = '') {
  const match = String(value).toLowerCase().match(/\.([a-z0-9]+)(?:\?|#|$)/)
  return match?.[1] || ''
}

export function getMediaUrl(item) {
  return item?.url || item?.signedUrl || item?.publicUrl || ''
}

export function getYoutubeId(url) {
  if (!url) return null
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/)
  return match?.[1] || null
}

export function isYoutubeVideo(item) {
  return !!getYoutubeId(item?.url || item?.publicUrl)
}

export function isImageMedia(item) {
  return String(item?.type || '').startsWith('image/')
    || ['jpg', 'jpeg', 'png', 'webp'].includes(getExtension(item?.fileName || item?.path || getMediaUrl(item)))
}

export function isValidMedia(item) {
  return isImageMedia(item) || isYoutubeVideo(item)
}

export function getThumbnailUrl(item) {
  const ytId = getYoutubeId(item?.url || item?.publicUrl)
  if (ytId) return `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`
  return getMediaUrl(item)
}

export default function MediaCarousel({ 
  images = [], 
  eyebrow = 'Снимки и визуален контекст', 
  title = 'Project moodboard',
  emptyText = 'Не са добавени снимки.',
  bgClasses = 'bg-[linear-gradient(135deg,rgba(244,247,250,0.98),rgba(224,232,226,0.56))]'
}) {
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [carouselDirection, setCarouselDirection] = useState('next')
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const totalImages = images.length
  const safeActiveImageIndex = totalImages ? Math.min(activeImageIndex, totalImages - 1) : 0
  const activeImage = totalImages ? images[safeActiveImageIndex] : null
  const previousImage = totalImages > 1 ? images[(safeActiveImageIndex - 1 + totalImages) % totalImages] : null
  const nextImage = totalImages > 1 ? images[(safeActiveImageIndex + 1) % totalImages] : null

  useEffect(() => {
    if (!lightboxOpen || typeof document === 'undefined') return undefined
    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setLightboxOpen(false)
    }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [lightboxOpen])

  function goToPreviousImage() {
    if (totalImages < 2) return
    setCarouselDirection('prev')
    setActiveImageIndex((current) => (current - 1 + totalImages) % totalImages)
  }

  function goToNextImage() {
    if (totalImages < 2) return
    setCarouselDirection('next')
    setActiveImageIndex((current) => (current + 1) % totalImages)
  }

  function selectImage(index) {
    if (index === safeActiveImageIndex) return
    setCarouselDirection(index > safeActiveImageIndex ? 'next' : 'prev')
    setActiveImageIndex(index)
  }

  if (!totalImages || !activeImage) {
    return (
      <section className={`relative left-1/2 my-8 w-screen -translate-x-1/2 overflow-hidden border-y border-line ${bgClasses} px-4 py-16 md:px-6`}>
        <div className="container-page">
          <div className="mx-auto max-w-2xl rounded-[2rem] border border-dashed border-line bg-paper/80 p-8 text-center shadow-[0_18px_50px_rgba(13,35,64,0.05)]">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-soft text-accentDeep">
              <ImageIcon size={22} />
            </div>
            <h3 className="mt-4 font-display text-3xl font-semibold text-ink">{title}</h3>
            <p className="mt-2 text-sm text-muted">{emptyText}</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <>
      <section
        className={`relative left-1/2 my-8 min-h-[72svh] w-screen -translate-x-1/2 overflow-hidden border-y border-line ${bgClasses} px-4 py-10 md:px-6 lg:min-h-[84svh] lg:py-14`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.9),transparent_28%),radial-gradient(circle_at_82%_70%,rgba(47,143,116,0.13),transparent_32%)]" />
        <div className="container-page relative z-10 flex min-h-[calc(72svh-5rem)] flex-col justify-center lg:min-h-[calc(84svh-7rem)]">
          {(eyebrow || title) && (
            <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                {eyebrow && <div className="eyebrow">{eyebrow}</div>}
                {title && <h3 className="mt-2 font-display text-4xl font-semibold text-ink">{title}</h3>}
              </div>
              <div className="flex w-fit items-center gap-3 rounded-full border border-line bg-paper/85 px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted shadow-sm backdrop-blur">
                <ImageIcon size={14} />
                {safeActiveImageIndex + 1} / {totalImages}
              </div>
            </div>
          )}

          <div className="relative mx-auto flex w-full max-w-7xl items-center justify-center py-4 lg:min-h-[34rem]">
            {previousImage && (
              <button
                type="button"
                onClick={goToPreviousImage}
                className="absolute left-0 hidden h-[16rem] w-[36%] max-w-[30rem] overflow-hidden rounded-[1.75rem] border border-paper/80 bg-soft shadow-[0_24px_70px_rgba(13,35,64,0.14)] opacity-55 blur-[0.2px] transition hover:opacity-75 lg:block"
                aria-label="Покажи предишната снимка"
              >
                <img src={getThumbnailUrl(previousImage)} alt="" className="h-full w-full object-cover" aria-hidden="true" />
                <div className="absolute inset-0 bg-paper/35" />
              </button>
            )}

            {nextImage && (
              <button
                type="button"
                onClick={goToNextImage}
                className="absolute right-0 hidden h-[16rem] w-[36%] max-w-[30rem] overflow-hidden rounded-[1.75rem] border border-paper/80 bg-soft shadow-[0_24px_70px_rgba(13,35,64,0.14)] opacity-55 blur-[0.2px] transition hover:opacity-75 lg:block"
                aria-label="Покажи следващата снимка"
              >
                <img src={getThumbnailUrl(nextImage)} alt="" className="h-full w-full object-cover" aria-hidden="true" />
                <div className="absolute inset-0 bg-paper/35" />
              </button>
            )}

            <div
              key={activeImage.id || getMediaUrl(activeImage)}
              className={`relative z-10 w-full max-w-4xl ${carouselDirection === 'prev' ? 'shared-project-carousel-card--from-left' : 'shared-project-carousel-card--from-right'}`}
            >
              <div className="group relative block w-full overflow-hidden rounded-[2rem] border border-paper bg-ink shadow-[0_30px_90px_rgba(13,35,64,0.22)]">
                {isYoutubeVideo(activeImage) ? (
                  <div className="aspect-[16/10] w-full bg-ink">
                    <iframe
                      src={`https://www.youtube.com/embed/${getYoutubeId(getMediaUrl(activeImage))}?autoplay=0&rel=0`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="h-full w-full border-0"
                      title="YouTube video player"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setLightboxOpen(true)}
                    className="block w-full text-left focus:outline-none"
                    aria-label="Отвори снимката на цял екран"
                  >
                    <img
                      src={getMediaUrl(activeImage)}
                      alt={activeImage.caption || 'Снимка към проекта'}
                      className="aspect-[16/10] w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                    />
                    <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-ink/62 via-transparent to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between pointer-events-none">
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-paper/70">Качена снимка</div>
                        <p className="mt-1 line-clamp-2 text-sm font-medium text-paper">
                          {activeImage.caption || 'Натисни за преглед на цял екран'}
                        </p>
                      </div>
                      <span className="inline-flex w-fit items-center gap-2 rounded-full border border-paper/25 bg-paper/12 px-3 py-2 text-xs font-semibold text-paper backdrop-blur">
                        <Maximize2 size={15} />
                        Цял екран
                      </span>
                    </div>
                  </button>
                )}
              </div>

              {totalImages > 1 && (
                <div className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-between px-3">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      goToPreviousImage()
                    }}
                    className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-paper/40 bg-ink/55 text-paper shadow-lg backdrop-blur transition hover:bg-ink/75"
                    aria-label="Предишна снимка"
                  >
                    <ChevronLeft size={21} />
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      goToNextImage()
                    }}
                    className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-paper/40 bg-ink/55 text-paper shadow-lg backdrop-blur transition hover:bg-ink/75"
                    aria-label="Следваща снимка"
                  >
                    <ChevronRight size={21} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {totalImages > 1 && (
            <div className="mx-auto mt-6 flex max-w-full gap-2 overflow-x-auto rounded-full border border-line bg-paper/80 p-2 shadow-sm backdrop-blur">
              {images.map((item, index) => (
                <button
                  key={item.id || `${getMediaUrl(item)}-${index}`}
                  type="button"
                  onClick={() => selectImage(index)}
                  className={`h-12 w-16 shrink-0 overflow-hidden rounded-full border transition ${index === safeActiveImageIndex ? 'border-ink opacity-100' : 'border-transparent opacity-55 hover:opacity-90'}`}
                  aria-label={`Покажи снимка ${index + 1}`}
                >
                  <img src={getThumbnailUrl(item)} alt="" className="h-full w-full object-cover" aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {lightboxOpen && activeImage && (
        <div
          className="fixed inset-0 z-[999] bg-ink/94 px-4 py-5 text-paper backdrop-blur-xl sm:px-6"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute right-4 top-4 z-20 flex h-12 w-12 items-center justify-center rounded-full border border-paper bg-paper text-ink shadow-[0_18px_50px_rgba(0,0,0,0.35)] transition hover:scale-105"
            aria-label="Затвори снимката"
          >
            <X size={20} />
          </button>
          <div className="mx-auto flex h-full max-w-7xl flex-col justify-center" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between gap-4 text-xs font-bold uppercase tracking-wider text-paper/65">
              <span>Снимка {safeActiveImageIndex + 1} / {totalImages}</span>
              <span className="text-right">Клик извън снимката или Escape за затваряне</span>
            </div>
            <div className="relative min-h-0 flex-1">
              {isYoutubeVideo(activeImage) ? (
                <div className="flex h-full w-full items-center justify-center">
                  <iframe
                    src={`https://www.youtube.com/embed/${getYoutubeId(getMediaUrl(activeImage))}?autoplay=1&rel=0`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="h-[80vh] w-full max-w-5xl rounded-[1.5rem] border-0"
                    title="YouTube video player"
                  />
                </div>
              ) : (
                <img
                  src={getMediaUrl(activeImage)}
                  alt={activeImage.caption || 'Снимка към проекта'}
                  className="h-full w-full rounded-[1.5rem] object-contain"
                />
              )}
              {totalImages > 1 && (
                <>
                  <button
                    type="button"
                    onClick={goToPreviousImage}
                    className="absolute left-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-paper/25 bg-ink/55 text-paper backdrop-blur transition hover:bg-ink/75"
                    aria-label="Предишна снимка"
                  >
                    <ChevronLeft size={22} />
                  </button>
                  <button
                    type="button"
                    onClick={goToNextImage}
                    className="absolute right-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-paper/25 bg-ink/55 text-paper backdrop-blur transition hover:bg-ink/75"
                    aria-label="Следваща снимка"
                  >
                    <ChevronRight size={22} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
