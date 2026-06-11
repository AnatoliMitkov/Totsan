export default function PublicProfilePanel({ className = '', children }) {
  return (
    <div className={`rounded-3xl border border-line bg-paper p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)] md:p-8 ${className}`.trim()}>
      {children}
    </div>
  )
}
