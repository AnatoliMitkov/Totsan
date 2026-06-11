import { User } from 'lucide-react'

export default function PublicProfileAvatar({
  src = '',
  alt = '',
  imageClassName = 'img-cover',
  imageStyle = undefined,
  statusTitle = '',
  fallbackIcon = User,
  fallbackClassName = 'bg-accentSoft/70 text-accentDeep',
}) {
  const FallbackIcon = fallbackIcon

  return (
    <div className="relative group">
      {src ? (
        <div className="h-32 w-32 overflow-hidden rounded-3xl border-4 border-paper bg-paper shadow-md transition-transform duration-300 group-hover:scale-[1.02]">
          <img src={src} alt={alt} className={imageClassName} style={imageStyle} />
        </div>
      ) : (
        <div className={`flex h-32 w-32 items-center justify-center rounded-3xl border-4 border-paper shadow-md transition-transform duration-300 group-hover:scale-[1.02] ${fallbackClassName}`}>
          <FallbackIcon size={44} />
        </div>
      )}
      <span className="absolute bottom-1 right-1 flex h-5 w-5 rounded-full border-4 border-paper bg-trustGreen" title={statusTitle} />
    </div>
  )
}
