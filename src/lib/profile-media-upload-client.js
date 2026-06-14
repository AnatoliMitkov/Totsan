import { slugify } from './profiles.js'
import { supabase, supabasePublicKey, supabaseUrl } from './supabase.js'
import { uploadPortfolioImages, uploadServiceImages } from './advanced-image-manager.js'

const MB = 1024 * 1024
const IMAGE_MAX_BYTES = 10 * MB
const DOCUMENT_MAX_BYTES = 20 * MB
const PRECOMPRESS_THRESHOLD_BYTES = 3.5 * MB
const PRECOMPRESS_MAX_EDGE = 2200
const PRECOMPRESS_QUALITY = 0.86
const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])
const SUPPORTED_DOCUMENT_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])
const PRECOMPRESSABLE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/bmp',
])
const SUPPORTED_PROJECT_UPLOAD_TYPES = new Set([
  ...SUPPORTED_IMAGE_TYPES,
  ...SUPPORTED_DOCUMENT_TYPES,
])
const UNSUPPORTED_PROJECT_FILE_MESSAGE = 'Този тип файл не се поддържа. Можете да качите JPG, PNG, WEBP, PDF, DOC, DOCX, XLS или XLSX.'

function isImageUpload(file) {
  return SUPPORTED_IMAGE_TYPES.has(file?.type || '')
}

function isDocumentUpload(file) {
  return SUPPORTED_DOCUMENT_TYPES.has(file?.type || '')
}

function shouldVerifyStoredUpload({ file, preparedUpload, payload, verificationUrl }) {
  if (!verificationUrl || isDocumentUpload(file)) return false

  return (
    isImageUpload(file) &&
    preparedUpload.precompressed &&
    preparedUpload.file.type === 'image/webp' &&
    String(payload?.type || '').startsWith('image/')
  )
}

function validateUploadFile(file, purpose) {
  if (!(file instanceof File)) {
    throw new Error('Липсва файл за качване.')
  }

  if (purpose !== 'project') return

  if (!SUPPORTED_PROJECT_UPLOAD_TYPES.has(file.type)) {
    throw new Error(UNSUPPORTED_PROJECT_FILE_MESSAGE)
  }

  const limit = isDocumentUpload(file) ? DOCUMENT_MAX_BYTES : IMAGE_MAX_BYTES
  if (file.size > limit) {
    throw new Error(isDocumentUpload(file) ? 'Документите трябва да са до 20 MB.' : 'Снимките трябва да са до 10 MB.')
  }
}

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

function isValidWebP(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 12) return false
  return (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
}

function functionUrl() {
  if (!supabaseUrl) throw new Error('Липсва VITE_SUPABASE_URL за upload endpoint-а.')
  return `${supabaseUrl}/functions/v1/profile-media-upload`
}

async function verifyStoredUpload(url) {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error('Uploaded file could not be read after storage write.')
  }

  const bytes = new Uint8Array(await response.arrayBuffer())
  if (!isValidWebP(bytes)) {
    throw new Error('Uploaded file is corrupted after optimization.')
  }

  return bytes.length
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
  validateUploadFile(file, purpose)

  const { data } = await supabase.auth.getSession()
  const accessToken = data.session?.access_token
  if (!accessToken) {
    throw new Error('Трябва да си влязъл в акаунта си, за да качваш снимки.')
  }

  const preparedUpload = isImageUpload(file)
    ? await maybePrecompressImage(file)
    : {
        file,
        precompressed: false,
        originalBytes: file.size,
        uploadBytes: file.size,
      }

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

  const verificationUrl = payload.publicUrl || payload.signedUrl || ''
  let storedBytes = null
  if (shouldVerifyStoredUpload({ file, preparedUpload, payload, verificationUrl })) {
    storedBytes = await verifyStoredUpload(verificationUrl)
  }

  return {
    ...payload,
    precompressed: preparedUpload.precompressed,
    originalBytes: preparedUpload.originalBytes,
    uploadBytes: preparedUpload.uploadBytes,
    storedBytes,
  }
}

export async function uploadProfileMedia({ file, target = '' }) {
  const { data } = await supabase.auth.getSession()
  const userId = data.session?.user?.id
  const result = await uploadMediaViaEdge({ file, target: target || userId, purpose: 'profile' })
  if (result.bucket !== 'profile-images') {
    throw new Error('Profile media upload endpoint is not up to date. Redeploy profile-media-upload.')
  }
  return {
    publicUrl: result.publicUrl,
    path: result.path,
    bucket: result.bucket,
  }
}

export async function uploadProfileCover({ file, target = '' }) {
  const { data } = await supabase.auth.getSession()
  const userId = data.session?.user?.id
  const result = await uploadMediaViaEdge({ file, target: target || userId, purpose: 'banner' })
  if (result.bucket !== 'profile-images') {
    throw new Error('Profile media upload endpoint is not up to date. Redeploy profile-media-upload.')
  }
  return {
    publicUrl: result.publicUrl,
    path: result.path,
    bucket: result.bucket,
  }
}

export async function uploadPortfolioMedia({ file, target = '', kind = 'photo' }) {
  const { data } = await supabase.auth.getSession()
  const userId = data.session?.user?.id

  // Use a temporary ID since it's uploaded before saving the portfolio item
  const tempPortfolioId = `temp_${Date.now()}`
  const results = await uploadPortfolioImages([file], target || userId, tempPortfolioId, userId)
  const uploaded = results[0]

  return {
    publicUrl: uploaded.publicUrl,
    path: uploaded.path,
    bucket: 'profile-images'
  }
}

export async function uploadServiceMedia({ file, target = '', kind = 'service' }) {
  const { data } = await supabase.auth.getSession()
  const userId = data.session?.user?.id

  const tempServiceId = `temp_${Date.now()}`
  const results = await uploadServiceImages([file], target || userId, tempServiceId, userId)
  const uploaded = results[0]

  return {
    publicUrl: uploaded.publicUrl,
    path: uploaded.path,
    bucket: 'profile-images'
  }
}
