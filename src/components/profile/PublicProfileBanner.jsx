export default function PublicProfileBanner({
  imageSrc = '',
  imageAlt = '',
  imageStyle = undefined,
  heightClass = 'aspect-[1600/520]',
  className = '',
  onClick = undefined,
  onMouseEnter = undefined,
  onMouseLeave = undefined,
  onFocus = undefined,
  onBlur = undefined,
  placeholderLabel = '',
  placeholderClassName = '',
  editHintTitle = '',
  editHintText = '',
  children = null,
}) {
  function handleKeyDown(event) {
    if (!onClick || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    onClick(event)
  }

  return (
    <section
      onClick={onClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? (placeholderLabel || 'Редактирай банера') : undefined}
      className={`relative w-full overflow-hidden bg-soft ${heightClass} ${className}`}
    >
      {imageSrc ? (
        <img src={imageSrc} alt={imageAlt} className="img-cover" style={imageStyle} />
      ) : (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.8),_transparent_45%),linear-gradient(135deg,_rgba(217,230,244,0.95),_rgba(245,247,250,0.92)_55%,_rgba(228,236,244,0.98))]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(13,35,64,0.04),rgba(13,35,64,0.16))]" />
          {placeholderLabel && (
            <div className={`absolute inset-0 grid place-items-center px-4 py-20 text-center sm:px-6 sm:py-24 ${placeholderClassName}`.trim()}>
              <div className="max-w-[min(100%,20rem)] rounded-3xl border border-white/70 bg-paper/65 px-5 py-3 text-sm font-medium text-muted shadow-sm backdrop-blur">
                {placeholderLabel}
              </div>
            </div>
          )}
        </>
      )}
      {onClick && editHintText && (
        <div className="pointer-events-none absolute bottom-5 right-5 z-20 hidden max-w-xs translate-y-5 rounded-2xl border border-white/20 bg-ink/92 p-4 text-left text-paper opacity-0 shadow-[0_22px_60px_-24px_rgba(13,35,64,0.72)] backdrop-blur-md transition-all duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus:translate-y-0 group-focus:opacity-100 md:block">
          {editHintTitle && (
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-paper">{editHintTitle}</div>
          )}
          <p className="mt-1 text-sm leading-6 text-paper/90">{editHintText}</p>
        </div>
      )}
      {children}
    </section>
  )
}
