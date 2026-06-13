// src/lib/image-upload.js
// Optimized image upload with compression, validation, and CDN support
// Supports: profile-images, project-media, portfolio-media, service-media

import { supabase } from './supabase.js'

// ============================================================================
// IMAGE OPTIMIZATION SETTINGS
// ============================================================================

export const IMAGE_SETTINGS = {
  'profile-images': {
    maxSize: 5 * 1024 * 1024, // 5MB
    maxDimension: 2000,
    formats: ['image/jpeg', 'image/png', 'image/webp'],
    quality: 0.85,
    folder: (userId) => `${userId}/avatar`,
    description: 'Partner profile image'
  },
  'project-media': {
    maxSize: 10 * 1024 * 1024, // 10MB
    maxDimension: 4000,
    formats: ['image/jpeg', 'image/png', 'image/webp'],
    quality: 0.80,
    folder: (userId) => `projects/${userId}`,
    description: 'Client project photo'
  },
  'portfolio-media': {
    maxSize: 8 * 1024 * 1024, // 8MB
    maxDimension: 3000,
    formats: ['image/jpeg', 'image/png', 'image/webp'],
    quality: 0.82,
    folder: (profileId) => `${profileId}/portfolio`,
    description: 'Partner portfolio item'
  },
  'service-media': {
    maxSize: 8 * 1024 * 1024, // 8MB
    maxDimension: 3000,
    formats: ['image/jpeg', 'image/png', 'image/webp'],
    quality: 0.82,
    folder: (serviceId) => `${serviceId}/media`,
    description: 'Service showcase image'
  }
}

// ============================================================================
// VALIDATION
// ============================================================================

export function validateImageFile(file, bucket) {
  const settings = IMAGE_SETTINGS[bucket]
  if (!settings) throw new Error(`Unknown bucket: ${bucket}`)

  if (!file || typeof file !== 'object' || !file.type) {
    throw new Error('Invalid file object')
  }

  // Check MIME type
  if (!settings.formats.includes(file.type)) {
    throw new Error(
      `Invalid image format. Allowed: ${settings.formats.map(f => f.split('/')[1]).join(', ')}`
    )
  }

  // Check file size
  if (file.size > settings.maxSize) {
    const maxMB = Math.round(settings.maxSize / 1024 / 1024)
    throw new Error(`File too large. Max: ${maxMB}MB, Got: ${Math.round(file.size / 1024 / 1024)}MB`)
  }

  return true
}

// ============================================================================
// COMPRESSION
// ============================================================================

export async function compressImage(file, bucket) {
  validateImageFile(file, bucket)
  const settings = IMAGE_SETTINGS[bucket]

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      // Calculate new dimensions preserving aspect ratio
      let { width, height } = img
      const maxDim = settings.maxDimension

      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      canvas.width = width
      canvas.height = height
      ctx.drawImage(img, 0, 0, width, height)

      // Convert to blob with compression
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas compression failed'))
            return
          }

          // Create new file with compression
          const compressedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now()
          })

          resolve({
            file: compressedFile,
            originalSize: file.size,
            compressedSize: blob.size,
            ratio: Math.round((1 - blob.size / file.size) * 100),
            width,
            height
          })
        },
        'image/jpeg',
        settings.quality
      )
    }

    img.onerror = () => reject(new Error('Failed to load image'))

    // Load image
    const reader = new FileReader()
    reader.onload = (e) => {
      img.src = e.target.result
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

// ============================================================================
// UPLOAD
// ============================================================================

export async function uploadImage(file, bucket, folderId, options = {}) {
  validateImageFile(file, bucket)
  const settings = IMAGE_SETTINGS[bucket]

  // Compress by default (can be disabled)
  let uploadFile = file
  if (options.compress !== false) {
    const compressed = await compressImage(file, bucket)
    uploadFile = compressed.file
  }

  // Generate unique filename with timestamp to avoid collisions
  const timestamp = Date.now()
  const randomId = Math.random().toString(36).substring(2, 9)
  const ext = uploadFile.type === 'image/png' ? 'png' : 'jpg'
  const filename = `${timestamp}-${randomId}.${ext}`

  // Build path: folder/filename
  const folder = settings.folder(folderId)
  const path = `${folder}/${filename}`

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, uploadFile, {
      cacheControl: '3600',
      upsert: false
    })

  if (error) {
    throw new Error(`Upload failed: ${error.message}`)
  }

  // Get public URL from CDN
  const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(data.path)
  const publicUrl = publicData?.publicUrl || ''

  return {
    bucket,
    path: data.path,
    filename,
    publicUrl,
    size: uploadFile.size,
    type: uploadFile.type
  }
}

// ============================================================================
// GET PUBLIC URL (with CDN caching)
// ============================================================================

export function getImageUrl(bucket, path, options = {}) {
  if (!path) return null

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  let url = data?.publicUrl || ''

  // Add CDN parameters for optimization
  if (options.width || options.height) {
    const params = new URLSearchParams()
    if (options.width) params.set('w', options.width)
    if (options.height) params.set('h', options.height)
    if (options.quality) params.set('q', options.quality)
    url += `?${params.toString()}`
  }

  return url
}

// ============================================================================
// DELETE IMAGE
// ============================================================================

export async function deleteImage(bucket, path) {
  if (!path) return

  const { error } = await supabase.storage.from(bucket).remove([path])
  if (error) {
    console.error(`[image-delete] Failed to delete ${path}:`, error)
    throw error
  }

  return true
}

// ============================================================================
// BATCH DELETE
// ============================================================================

export async function deleteImages(bucket, paths) {
  if (!paths || paths.length === 0) return

  const { error } = await supabase.storage.from(bucket).remove(paths)
  if (error) {
    console.error(`[image-batch-delete] Failed to delete ${paths.length} images:`, error)
    throw error
  }

  return true
}

// ============================================================================
// MIGRATE TO OPTIMIZED BUCKET (e.g., from profile-images to profile-images-optimized)
// ============================================================================

export async function migrateImageBucket(sourcePath, sourceBucket, destBucket) {
  // Download from source
  const { data: imageData, error: downloadError } = await supabase.storage
    .from(sourceBucket)
    .download(sourcePath)

  if (downloadError) throw downloadError

  // Compress
  const compressedBlob = await compressImageBlob(imageData, destBucket)

  // Upload to destination
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(destBucket)
    .upload(sourcePath, compressedBlob, {
      cacheControl: '3600',
      upsert: true
    })

  if (uploadError) throw uploadError

  // Delete from source
  await deleteImage(sourceBucket, sourcePath)

  const { data: publicData } = supabase.storage.from(destBucket).getPublicUrl(uploadData.path)
  return publicData?.publicUrl || ''
}

async function compressImageBlob(blob, bucket) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      const settings = IMAGE_SETTINGS[bucket]
      let { width, height } = img
      const maxDim = settings.maxDimension

      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      canvas.width = width
      canvas.height = height
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (result) => result ? resolve(result) : reject(new Error('Compression failed')),
        'image/jpeg',
        settings.quality
      )
    }

    img.onerror = () => reject(new Error('Failed to load image'))

    const reader = new FileReader()
    reader.onload = (e) => {
      img.src = e.target.result
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(blob)
  })
}

// ============================================================================
// HELPERS FOR COMPONENTS
// ============================================================================

export function useImageUpload(bucket) {
  const [uploading, setUploading] = React.useState(false)
  const [error, setError] = React.useState(null)
  const [progress, setProgress] = React.useState(0)

  const upload = async (file, folderId, options = {}) => {
    try {
      setUploading(true)
      setError(null)
      setProgress(0)

      setProgress(30)
      const result = await uploadImage(file, bucket, folderId, options)
      setProgress(100)

      setTimeout(() => setProgress(0), 500)
      return result
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setUploading(false)
    }
  }

  return { upload, uploading, error, progress }
}
