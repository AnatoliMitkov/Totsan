import { Save, X } from 'lucide-react'

export default function FloatingSaveBar({
  state,
  status,
  message,
  idleMessage = 'Промените се пазят след запазване.',
  savingLabel = 'Запазва се...',
  saveLabel = 'Запази',
  cancelLabel = 'Отказ',
  onCancel,
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
      <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-full border border-line bg-paper/95 p-1.5 shadow-xl shadow-primary/15 backdrop-blur">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-ghost px-5 py-3 text-muted hover:text-ink"
            disabled={disabled || isSaving}
          >
            <X size={18} />
            <span>{cancelLabel}</span>
          </button>
        )}
        <button
          type="submit"
          className="btn btn-primary px-8 py-3.5 transition-transform hover:scale-105"
          disabled={disabled || isSaving}
        >
          <Save size={20} />
          <span>{isSaving ? savingLabel : saveLabel}</span>
        </button>
      </div>
    </div>
  )
}
