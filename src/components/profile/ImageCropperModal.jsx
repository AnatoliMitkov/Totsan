import { useCallback, useEffect, useMemo, useState } from 'react'
import Cropper from 'react-easy-crop'
import { Check, Loader2, Upload, X } from 'lucide-react'

const OUTPUT_SIZE = 512
const RECROP_MESSAGE = 'За да позиционираш тази снимка, качи я отново.'
const SAVE_ERROR_MESSAGE = 'Не успяхме да запазим снимката. Опитай отново.'

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(max, Math.max(min, numeric))
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    if (src.startsWith('http')) {
      image.crossOrigin = 'anonymous'
    }
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(RECROP_MESSAGE))
    image.src = src
  })
}

async function createCroppedImageBlob(imageSrc, pixelCrop, outputWidth, outputHeight) {
  const image = await loadImage(imageSrc)
  const canvas = document.createElement('canvas')
  canvas.width = outputWidth
  canvas.height = outputHeight

  const context = canvas.getContext('2d', { alpha: false })
  if (!context) {
    throw new Error(SAVE_ERROR_MESSAGE)
  }

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputWidth,
    outputHeight
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error(SAVE_ERROR_MESSAGE))
        return
      }
      resolve(blob)
    }, 'image/jpeg', 0.92)
  })
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Файлът не може да бъде прочетен.'))
    reader.readAsDataURL(file)
  })
}

function buildInitialCroppedArea(initialDisplayCrop, naturalSize) {
  if (!initialDisplayCrop || !naturalSize?.width || !naturalSize?.height) return undefined

  const width = naturalSize.width
  const height = naturalSize.height
  const minEdge = Math.min(width, height)
  const imageZoom = clampNumber(initialDisplayCrop.imageZoom, 1, 2.5, 1)
  const imageX = clampNumber(initialDisplayCrop.imageX, 0, 100, 50)
  const imageY = clampNumber(initialDisplayCrop.imageY, 0, 100, 50)
  const visibleSide = minEdge / imageZoom
  const maxX = Math.max(0, width - visibleSide)
  const maxY = Math.max(0, height - visibleSide)

  return {
    x: maxX > 0 ? ((maxX * imageX / 100) / width) * 100 : 0,
    y: maxY > 0 ? ((maxY * imageY / 100) / height) * 100 : 0,
    width: (visibleSide / width) * 100,
    height: (visibleSide / height) * 100,
  }
}

function buildDisplayCrop(croppedAreaPixels, naturalSize) {
  if (!croppedAreaPixels || !naturalSize?.width || !naturalSize?.height) {
    return { imageZoom: 1, imageX: 50, imageY: 50 }
  }

  const width = naturalSize.width
  const height = naturalSize.height
  const minEdge = Math.min(width, height)
  const cropSide = Math.max(1, Math.min(croppedAreaPixels.width, croppedAreaPixels.height))
  const imageZoom = clampNumber(minEdge / cropSide, 1, 2.5, 1)
  const visibleSide = minEdge / imageZoom
  const maxX = Math.max(0, width - visibleSide)
  const maxY = Math.max(0, height - visibleSide)

  return {
    imageZoom,
    imageX: maxX > 0 ? clampNumber((croppedAreaPixels.x / maxX) * 100, 0, 100, 50) : 50,
    imageY: maxY > 0 ? clampNumber((croppedAreaPixels.y / maxY) * 100, 0, 100, 50) : 50,
  }
}

export default function ImageCropperModal({
  file = null,
  imageUrl = '',
  initialFileName = 'avatar.jpg',
  fileName: legacyFileName = '',
  onClose,
  onCropSave,
  onSave,
  onSelectFile,
  title = 'Редактирай снимка',
  description = '',
  aspect = 1,
  cropShape = 'round',
  objectFit = 'contain',
  outputWidth = OUTPUT_SIZE,
  outputHeight = OUTPUT_SIZE,
  minZoom = 1,
  maxZoom = 3,
  zoomStep = 0.1,
  initialDisplayCrop = null,
  emptyStateLabel = 'Качи снимка, за да я позиционираш.',
}) {
  const [imageSrc, setImageSrc] = useState('')
  const [naturalSize, setNaturalSize] = useState(null)
  const [fileName, setFileName] = useState(legacyFileName || initialFileName)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const saveHandler = onCropSave || onSave

  const hasImage = Boolean(imageSrc)
  const initialCroppedArea = useMemo(
    () => buildInitialCroppedArea(initialDisplayCrop, naturalSize),
    [initialDisplayCrop, naturalSize]
  )

  useEffect(() => {
    let active = true

    async function prepareSource() {
      setError('')
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setCroppedAreaPixels(null)
      setNaturalSize(null)

      if (file instanceof File) {
        try {
          const nextImageSrc = await readFileAsDataUrl(file)
          const image = await loadImage(nextImageSrc)
          if (!active) return
          setNaturalSize({ width: image.naturalWidth || image.width, height: image.naturalHeight || image.height })
          setImageSrc(nextImageSrc)
          setFileName(file.name || legacyFileName || initialFileName)
        } catch (nextError) {
          if (!active) return
          setImageSrc('')
          setError(nextError.message || 'Файлът не може да бъде прочетен.')
        }
        return
      }

      if (imageUrl) {
        try {
          const image = await loadImage(imageUrl)
          if (!active) return
          setNaturalSize({ width: image.naturalWidth || image.width, height: image.naturalHeight || image.height })
          setImageSrc(imageUrl)
          setFileName(legacyFileName || initialFileName)
        } catch (nextError) {
          if (!active) return
          setImageSrc('')
          setError(nextError.message || RECROP_MESSAGE)
        }
        return
      }

      setImageSrc('')
    }

    prepareSource()
    return () => {
      active = false
    }
  }, [file, imageUrl, initialFileName, legacyFileName])

  const handleCropComplete = useCallback((_, nextCroppedAreaPixels) => {
    setCroppedAreaPixels(nextCroppedAreaPixels)
  }, [])

  async function handleSave() {
    if (!hasImage || !croppedAreaPixels) return

    setIsSaving(true)
    setError('')
    let shouldClose = false
    try {
      const croppedBlob = await createCroppedImageBlob(imageSrc, croppedAreaPixels, outputWidth, outputHeight)
      const croppedFile = new File([croppedBlob], fileName || 'avatar.jpg', { type: 'image/jpeg' })
      await saveHandler?.(croppedFile, {
        originalFile: file instanceof File ? file : null,
        croppedAreaPixels,
        naturalSize,
        displayCrop: buildDisplayCrop(croppedAreaPixels, naturalSize),
      })
      shouldClose = true
    } catch (nextError) {
      setError(nextError.message === RECROP_MESSAGE ? RECROP_MESSAGE : SAVE_ERROR_MESSAGE)
    } finally {
      setIsSaving(false)
      if (shouldClose) onClose()
    }
  }

  async function handleFileChange(event) {
    const nextFile = event.target.files?.[0]
    event.target.value = ''
    if (!nextFile) return

    setError('')
    await onSelectFile?.(nextFile)
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/60 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-line bg-paper shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-4 sm:px-6">
          <div>
            <h3 className="font-medium text-ink">{title}</h3>
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          <button type="button" onClick={onClose} disabled={isSaving} className="rounded-full p-2 text-muted transition hover:bg-soft hover:text-ink">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-5 overflow-y-auto p-4 sm:p-6">
          <div className="relative h-[50vh] min-h-[300px] w-full overflow-hidden rounded-3xl border border-line bg-soft">
            {hasImage ? (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                minZoom={minZoom}
                maxZoom={maxZoom}
                aspect={aspect}
                cropShape={cropShape}
                showGrid
                restrictPosition
                objectFit={objectFit}
                initialCroppedAreaPercentages={initialCroppedArea}
                onCropChange={setCrop}
                onCropComplete={handleCropComplete}
                onZoomChange={setZoom}
              />
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted">
                {emptyStateLabel}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="btn btn-ghost w-full cursor-pointer justify-center sm:w-auto">
              <Upload size={18} />
              Качи нова
              <input type="file" accept=".jpg,.jpeg,.png,.webp" className="sr-only" onChange={handleFileChange} disabled={isSaving} />
            </label>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button type="button" onClick={handleSave} disabled={!hasImage || !croppedAreaPixels || isSaving || !saveHandler} className="btn btn-primary w-full justify-center sm:w-auto">
              {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              {isSaving ? 'Запазване…' : 'Запази'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
