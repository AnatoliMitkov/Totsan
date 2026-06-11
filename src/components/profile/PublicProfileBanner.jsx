export default function PublicProfileBanner({
  imageSrc = '',
  imageAlt = '',
  imageStyle = undefined,
  heightClass = 'h-64 md:h-80',
  children = null,
}) {
  return (
    <section className={`relative w-full overflow-hidden bg-soft ${heightClass}`}>
      {imageSrc ? (
        <img src={imageSrc} alt={imageAlt} className="img-cover" style={imageStyle} />
      ) : (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.8),_transparent_45%),linear-gradient(135deg,_rgba(217,230,244,0.95),_rgba(245,247,250,0.92)_55%,_rgba(228,236,244,0.98))]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(13,35,64,0.04),rgba(13,35,64,0.16))]" />
        </>
      )}
      {children}
    </section>
  )
}
