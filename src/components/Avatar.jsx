export default function Avatar({ src, name, size = 36, className = '', imgStyle = {} }) {
  const initial = (name || '?')[0].toUpperCase()

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full border border-line bg-soft flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {src ? (
        <img
          src={src}
          alt={name || 'Аватар'}
          className="absolute inset-0 h-full w-full object-cover"
          style={imgStyle}
          onError={(e) => {
            e.currentTarget.style.display = 'none'
            if (e.currentTarget.nextElementSibling) {
              e.currentTarget.nextElementSibling.style.display = 'flex'
            }
          }}
        />
      ) : null}
      <span
        className="flex items-center justify-center font-medium text-ink/70"
        style={{ fontSize: Math.max(10, size * 0.4), display: src ? 'none' : 'flex' }}
      >
        {initial}
      </span>
    </div>
  )
}
