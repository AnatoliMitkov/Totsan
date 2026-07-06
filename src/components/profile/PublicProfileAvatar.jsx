import { getProfileAvatarVariant } from '../../lib/profiles.js'

export default function PublicProfileAvatar({
  src = '',
  alt = '',
  name = '',
  imageClassName = 'img-cover',
  imageStyle = undefined,
  statusTitle = '',
  fallbackIcon = null,
  fallbackClassName = 'bg-gradient-to-br from-accentSoft via-paper to-cloud text-accentDeep',
  sizeClassName = 'h-32 w-32',
  statusClassName = 'bottom-1 right-1 h-5 w-5 border-4',
  variant = 'profile',
}) {
  const FallbackIcon = fallbackIcon
  const initials = getInitials(name || alt)
  const resolvedSrc = getProfileAvatarVariant(src, variant)

  return (
    <div className="relative group">
      {resolvedSrc ? (
        <div className={`${sizeClassName} overflow-hidden rounded-3xl border-4 border-paper bg-paper shadow-md transition-transform duration-300 group-hover:scale-[1.02]`}>
          <img src={resolvedSrc} alt={alt} className={imageClassName} style={imageStyle} />
        </div>
      ) : (
        <div className={`flex ${sizeClassName} items-center justify-center rounded-3xl border-4 border-paper shadow-md transition-transform duration-300 group-hover:scale-[1.02] ${fallbackClassName}`}>
          {FallbackIcon ? <FallbackIcon size={44} /> : <span className="px-2 text-center font-display text-[clamp(1.75rem,6vw,2.25rem)] font-semibold">{initials}</span>}
        </div>
      )}
      <span className={`absolute ${statusClassName} flex rounded-full border-paper bg-trustGreen`} title={statusTitle} />
    </div>
  )
}

function getInitials(value = '') {
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase()
  return (parts[0]?.[0] || '?').toUpperCase()
}
