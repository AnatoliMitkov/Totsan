import { Save } from 'lucide-react'

export default function FloatingSaveBar({
  state,
  status,
  message,
  idleMessage = 'Промените се пазят след запазване.',
  savingLabel = 'Запазва се...',
  saveLabel = 'Запази',
  disabled = false,
}) {
  const stateType = state?.status || state?.type || status || 'idle'
  const stateMessage = state?.message ?? message
  const isSaving = stateType === 'saving'
  const isError = stateType === 'error'

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center justify-center gap-3 px-4">
      {stateMessage && (
        <div
          className={`pointer-events-auto rounded-full px-4 py-2 text-sm font-medium shadow-md backdrop-blur ${
            isError
              ? 'border border-red-200 bg-red-50 text-red-700'
              : 'border border-green-200 bg-green-50 text-green-700'
          }`}
        >
          {stateMessage}
        </div>
      )}
      <button
        type="submit"
        className="pointer-events-auto btn btn-primary px-8 py-3.5 shadow-xl shadow-primary/20 transition-transform hover:scale-105"
        disabled={disabled || isSaving}
      >
        <Save size={20} />
        <span>{isSaving ? savingLabel : saveLabel}</span>
      </button>
    </div>
  )
}
