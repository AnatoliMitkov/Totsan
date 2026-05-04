import { slugify } from './profiles.js'
import { supabase, supabasePublicKey, supabaseUrl } from './supabase.js'

const MB = 1024 * 1024
const PRECOMPRESS_THRESHOLD_BYTES = 3.5 * MB
const PRECOMPRESS_MAX_EDGE = 2200
const PRECOMPRESS_QUALITY = 0.86
const PRECOMPRESSABLE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/bmp',
])

function constrainSize(width, height, maxEdge) {
  const largestEdge = Math.max(width, height)
  if (largestEdge <= maxEdge) return { width, height }
  const scale = maxEdge / largestEdge
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

function replaceExtension(fileName, nextExtension) {
  const baseName = fileName.replace(/\.[^.]+$/, '') || 'upload'
  return `${baseName}.${nextExtension}`
}

function functionUrl() {
  if (!supabaseUrl) throw new Error('Липсва VITE_SUPABASE_URL за upload endpoint-а.')
  return `${supabaseUrl}/functions/v1/profile-media-upload`
}

async function loadRasterSource(file) {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file)
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw(context, width, height) {
        context.drawImage(bitmap, 0, 0, width, height)
      },
      cleanup() {
        bitmap.close()
      },
    }
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await new Promise((resolve, reject) => {
      const nextImage = new Image()
      nextImage.onload = () => resolve(nextImage)
      nextImage.onerror = () => reject(new Error('Снимката не може да се зареди за предварителна компресия.'))
      nextImage.src = objectUrl
    })

    return {
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      draw(context, width, height) {
        context.drawImage(image, 0, 0, width, height)
      },
      cleanup() {
        URL.revokeObjectURL(objectUrl)
      },
    }
  } catch (error) {
    URL.revokeObjectURL(objectUrl)
    throw error
  }
}

async function maybePrecompressImage(file) {
  if (!PRECOMPRESSABLE_TYPES.has(file.type) || file.size <= PRECOMPRESS_THRESHOLD_BYTES) {
    return {
      file,
      precompressed: false,
      originalBytes: file.size,
      uploadBytes: file.size,
    }
  }

  const source = await loadRasterSource(file)
  try {
    const nextSize = constrainSize(source.width, source.height, PRECOMPRESS_MAX_EDGE)
    const canvas = document.createElement('canvas')
    canvas.width = nextSize.width
    canvas.height = nextSize.height
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) {
      return {
        file,
        precompressed: false,
        originalBytes: file.size,
        uploadBytes: file.size,
      }
    }

    source.draw(context, nextSize.width, nextSize.height)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', PRECOMPRESS_QUALITY))
    if (!blob || blob.size >= file.size) {
      return {
        file,
        precompressed: false,
        originalBytes: file.size,
        uploadBytes: file.size,
      }
    }

    return {
      file: new File([blob], replaceExtension(file.name, 'webp'), { type: 'image/webp' }),
      precompressed: true,
      originalBytes: file.size,
      uploadBytes: blob.size,
    }
  } finally {
    source.cleanup()
  }
}

export function resolveProfileUploadTarget({ userId = '', slug = '', name = '' }) {
  return userId.trim() || slugify(slug.trim() || name.trim())
}

export async function uploadMediaViaEdge({ file, target = '', purpose = 'profile', projectId = '', kind = 'photo' }) {
  if (!(file instanceof File)) {
    throw new Error('Липсва файл за качване.')
  }

  const { data } = await supabase.auth.getSession()
  const accessToken = data.session?.access_token
  if (!accessToken) {
    throw new Error('Трябва да си влязъл в акаунта си, за да качваш снимки.')
  }

  const preparedUpload = await maybePrecompressImage(file)
  const formData = new FormData()
  formData.append('file', preparedUpload.file)
  formData.append('purpose', purpose)
  if (projectId.trim()) {
    formData.append('projectId', projectId.trim())
  }
  if (kind.trim()) {
    formData.append('kind', kind.trim())
  }
  if (target.trim()) {
    formData.append('target', target.trim())
  }

  const headers = {
    Authorization: `Bearer ${accessToken}`,
  }
  if (supabasePublicKey) {
    headers.apikey = supabasePublicKey
  }

  const response = await fetch(functionUrl(), {
    method: 'POST',
    headers,
    body: formData,
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.error || 'Качването не успя.')
  }

  return {
    ...payload,
    precompressed: preparedUpload.precompressed,
    originalBytes: preparedUpload.originalBytes,
    uploadBytes: preparedUpload.uploadBytes,
  }
}

export async function uploadProfileMedia({ file, target = '' }) {
  return uploadMediaViaEdge({ file, target, purpose: 'profile' })
}

export async function uploadPortfolioMedia({ file, target = '', kind = 'photo' }) {
  return uploadMediaViaEdge({ file, target, purpose: 'portfolio', kind })
}

export async function uploadServiceMedia({ file, target = '', kind = 'service' }) {
  return uploadMediaViaEdge({ file, target, purpose: 'service', kind })
}