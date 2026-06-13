export default function PublicProfileBanner({
  imageSrc = '',
  imageAlt = '',
  imageStyle = undefined,
  heightClass = 'aspect-[1600/520]',
  className = '',
  onClick = undefined,
  placeholderLabel = '',
  placeholderClassName = '',
  children = null,
}) {
  return (
    <section onClick={onClick} className={`relative w-full overflow-hidden bg-soft ${heightClass} ${className}`}>
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
      {children}
    </section>
  )
}
