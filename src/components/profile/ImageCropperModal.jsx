import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Cropper from 'react-easy-crop'
import { Check, Loader2, Upload, X } from 'lucide-react'

const OUTPUT_SIZE = 512
const RECROP_MESSAGE = 'За да позиционираш тази снимка, качи я отново.'
const SAVE_ERROR_MESSAGE = 'Не успяхме да запазим снимката. Опитай отново.'

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(RECROP_MESSAGE))
    image.src = src
  })
}

async function createCroppedAvatarBlob(imageSrc, pixelCrop) {
  const image = await loadImage(imageSrc)
  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_SIZE
  canvas.height = OUTPUT_SIZE

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
    OUTPUT_SIZE,
    OUTPUT_SIZE
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

export default function ImageCropperModal({
  file = null,
  imageUrl = '',
  initialFileName = 'avatar.jpg',
  onClose,
  onCropSave,
  onSelectFile,
}) {
  const [imageSrc, setImageSrc] = useState('')
  const [mediaSize, setMediaSize] = useState(null)
  const [cropAreaSize, setCropAreaSize] = useState(0)
  const [fileName, setFileName] = useState(initialFileName)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoomMultiplier, setZoomMultiplier] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isPreparingPreview, setIsPreparingPreview] = useState(false)
  const [error, setError] = useState('')
  const cropFrameRef = useRef(null)

  const hasImage = Boolean(imageSrc)
  const baseScale = useMemo(() => {
    if (!mediaSize?.width || !mediaSize?.height || !cropAreaSize) return 1
    return Math.max(cropAreaSize / mediaSize.width, cropAreaSize / mediaSize.height)
  }, [cropAreaSize, mediaSize])
  const finalScale = baseScale * zoomMultiplier

  useEffect(() => {
    let active = true

    async function prepareSource() {
      setError('')
      setCrop({ x: 0, y: 0 })
      setZoomMultiplier(1)
      setMediaSize(null)
      setCroppedAreaPixels(null)

      if (file instanceof File) {
        try {
          const nextImageSrc = await readFileAsDataUrl(file)
          const loadedImage = await loadImage(nextImageSrc)
          if (!active) return
          setImageSrc(nextImageSrc)
          setFileName(file.name || initialFileName)
          setMediaSize({
            width: loadedImage.naturalWidth || loadedImage.width,
            height: loadedImage.naturalHeight || loadedImage.height,
          })
        } catch (nextError) {
          if (!active) return
          setImageSrc('')
          setMediaSize(null)
          setError(nextError.message || 'Файлът не може да бъде прочетен.')
        }
        return
      }

      if (imageUrl) {
        try {
          const loadedImage = await loadImage(imageUrl)
          if (!active) return
          setImageSrc(imageUrl)
          setFileName(initialFileName)
          setMediaSize({
            width: loadedImage.naturalWidth || loadedImage.width,
            height: loadedImage.naturalHeight || loadedImage.height,
          })
        } catch (nextError) {
          if (!active) return
          setImageSrc('')
          setMediaSize(null)
          setError(nextError.message || RECROP_MESSAGE)
        }
        return
      }

      setImageSrc('')
      setMediaSize(null)
    }

    prepareSource()
    return () => {
      active = false
    }
  }, [file, imageUrl, initialFileName])

  useEffect(() => {
    const el = cropFrameRef.current
    if (!el) return undefined

    const updateSize = () => {
      const nextSize = Math.floor(Math.min(el.clientWidth, el.clientHeight))
      setCropAreaSize(nextSize)
    }

    updateSize()

    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(updateSize)
      observer.observe(el)
      return () => observer.disconnect()
    }

    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  useEffect(() => {
    if (!hasImage || !croppedAreaPixels) {
      setPreviewUrl('')
      return undefined
    }

    let active = true
    let objectUrl = ''

    async function buildPreview() {
      setIsPreparingPreview(true)
      try {
        const blob = await createCroppedAvatarBlob(imageSrc, croppedAreaPixels)
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setPreviewUrl((current) => {
          if (current) URL.revokeObjectURL(current)
          return objectUrl
        })
      } catch (nextError) {
        if (!active) return
        setPreviewUrl('')
        setError(nextError.message === RECROP_MESSAGE ? RECROP_MESSAGE : SAVE_ERROR_MESSAGE)
      } finally {
        if (active) setIsPreparingPreview(false)
      }
    }

    buildPreview()
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [croppedAreaPixels, hasImage, imageSrc])

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const handleCropComplete = useCallback((_, nextCroppedAreaPixels) => {
    setCroppedAreaPixels(nextCroppedAreaPixels)
  }, [])

  async function handleSave() {
    if (!hasImage || !croppedAreaPixels) return

    setIsSaving(true)
    setError('')
    try {
      const croppedBlob = await createCroppedAvatarBlob(imageSrc, croppedAreaPixels)
      const croppedFile = new File([croppedBlob], fileName || 'avatar.jpg', { type: 'image/jpeg' })
      await onCropSave(croppedFile)
      onClose()
    } catch (nextError) {
      setError(nextError.message === RECROP_MESSAGE ? RECROP_MESSAGE : SAVE_ERROR_MESSAGE)
    } finally {
      setIsSaving(false)
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/60 p-3 backdrop-blur-sm sm:p-6">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-line bg-paper shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-4 sm:px-6">
          <div>
            <h3 className="font-medium text-ink">Редактирай снимка</h3>
            <p className="mt-1 text-sm text-muted">Премести снимката и виж как ще изглежда като аватар.</p>
          </div>
          <button type="button" onClick={onClose} disabled={isSaving} className="rounded-full p-2 text-muted transition hover:bg-soft hover:text-ink">
            <X size={20} />
          </button>
        </div>

        <div className="grid gap-5 overflow-y-auto p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div>
            <div ref={cropFrameRef} className="relative h-[320px] overflow-hidden rounded-3xl border border-line bg-soft sm:h-[420px]">
              {hasImage ? (
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={finalScale}
                  aspect={1}
                  cropShape="round"
                  showGrid
                  restrictPosition
                  objectFit="cover"
                  onCropChange={setCrop}
                  onCropComplete={handleCropComplete}
                  onZoomChange={setZoomMultiplier}
                />
              ) : (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted">
                  Качи снимка, за да я позиционираш.
                </div>
              )}
            </div>

            <label className="mt-4 block text-sm font-medium text-ink">
              <span className="flex items-center justify-between gap-3">
                <span>Мащаб</span>
                <span className="text-xs text-muted">{zoomMultiplier.toFixed(1)}x</span>
              </span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoomMultiplier}
                onChange={(event) => setZoomMultiplier(Number(event.target.value))}
                className="mt-3 w-full accent-ink"
                disabled={!hasImage || isSaving}
              />
            </label>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-3xl border border-line bg-soft/70 p-4">
              <div className="text-sm font-medium text-ink">Преглед</div>
              <div className="mt-4 flex justify-center">
                <div className="relative h-36 w-36 overflow-hidden rounded-full border border-line bg-paper shadow-sm">
                  {previewUrl ? (
                    <img src={previewUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-muted">
                      {isPreparingPreview ? 'Подготвяме преглед…' : 'Няма снимка'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <label className="btn btn-ghost w-full cursor-pointer justify-center">
              <Upload size={18} />
              Качи нова
              <input type="file" accept="image/*" className="sr-only" onChange={handleFileChange} disabled={isSaving} />
            </label>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="mt-auto flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={onClose} disabled={isSaving} className="btn btn-ghost flex-1 justify-center">
                Отказ
              </button>
              <button type="button" onClick={handleSave} disabled={!hasImage || !croppedAreaPixels || isSaving} className="btn btn-primary flex-1 justify-center">
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                {isSaving ? 'Запазване…' : 'Запази'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
