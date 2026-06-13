// src/lib/advanced-image-manager.js
// Advanced hierarchical image management with versioning, cleanup, and optimization

import { supabase } from './supabase.js'
import { ImageStoragePath } from './image-storage-schema.js'

// ============================================================================
// COMPRESSION & VARIANT GENERATION
// ============================================================================

export async function generateImageVariants(file, category) {
  const variants = {}

  const baseVariant = await compressImage(file, {
    quality: category === 'banner' ? 82 : 85,
    maxWidth: category === 'banner' ? 1600 : 1200,
    maxHeight: category === 'banner' ? 400 : 1200
  })

  variants.main = baseVariant

  // Generate thumbnail
  if (category === 'profile') {
    variants.thumb = await compressImage(file, {
      quality: 80,
      maxWidth: 50,
      maxHeight: 50
    })

    // Generate OG image (1200x630)
    variants.og = await compressImage(file, {
      quality: 80,
      maxWidth: 1200,
      maxHeight: 630,
      aspectRatio: '1200:630'
    })
  }

  // Generate blur placeholder
  if (category === 'banner') {
    variants.blur = await compressImage(file, {
      quality: 30,
      maxWidth: 100,
      maxHeight: 25
    })

    // Tablet variant
    variants.tablet = await compressImage(file, {
      quality: 82,
      maxWidth: 1000,
      maxHeight: 250
    })

    // Mobile variant
    variants.mobile = await compressImage(file, {
      quality: 82,
      maxWidth: 500,
      maxHeight: 200
    })
  }

  return variants
}

async function compressImage(file, options = {}) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      let width = img.naturalWidth
      let height = img.naturalHeight

      // Apply aspect ratio if specified
      if (options.aspectRatio) {
        const [ratioW, ratioH] = options.aspectRatio.split(':').map(Number)
        const currentRatio = width / height
        const targetRatio = ratioW / ratioH

        if (currentRatio > targetRatio) {
          width = height * targetRatio
        } else {
          height = width / targetRatio
        }
      }

      // Resize to max dimensions
      const maxW = options.maxWidth || 1200
      const maxH = options.maxHeight || 1200

      if (width > maxW || height > maxH) {
        const ratio = Math.min(maxW / width, maxH / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      canvas.width = width
      canvas.height = height
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Compression failed'))
            return
          }

          resolve({
            blob,
            file: new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }),
            dimensions: `${width}x${height}`,
            size: blob.size,
            originalSize: file.size,
            compressionRatio: Math.round((1 - blob.size / file.size) * 100)
          })
        },
        'image/jpeg',
        options.quality || 85
      )
    }

    img.onerror = () => reject(new Error('Failed to load image'))

    const reader = new FileReader()
    reader.onload = (e) => { img.src = e.target.result }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

// ============================================================================
// UPLOAD WITH VERSIONING
// ============================================================================

export async function uploadProfileImage(file, profileSlug, userId, category) {
  const path = new ImageStoragePath(profileSlug)
  const variants = await generateImageVariants(file, category)

  // Get current version number
  const currentVersionNum = await getCurrentVersionNumber(profileSlug, category)
  const nextVersionNum = currentVersionNum + 1

  const uploads = []

  // Upload main variant and create versions
  try {
    // Main image
    const mainPath = category === 'profile'
      ? path.profilePicture('main')
      : path.banner('main')

    const mainResult = await uploadImageFile(
      variants.main.file,
      mainPath,
      category === 'profile' ? 'profile-images' : 'profile-images'
    )
    uploads.push(mainResult)

    // Archive old version
    if (currentVersionNum > 0) {
      const oldVersionPath = category === 'profile'
        ? path.profilePictureVersion(currentVersionNum)
        : mainPath // For banner, just overwrite

      // Move current main to version history
      if (category === 'profile') {
        const currentMain = await getCurrentImagePath(profileSlug, category)
        if (currentMain) {
          await archiveAsVersion(
            profileSlug,
            currentMain,
            currentVersionNum,
            category
          )
        }
      }
    }

    // Upload thumbnails/variants
    if (variants.thumb) {
      const thumbPath = path.profilePicture('thumb')
      const thumbResult = await uploadImageFile(
        variants.thumb.file,
        thumbPath,
        'profile-images'
      )
      uploads.push(thumbResult)
    }

    if (variants.og) {
      const ogPath = path.profilePicture('og')
      const ogResult = await uploadImageFile(
        variants.og.file,
        ogPath,
        'profile-images'
      )
      uploads.push(ogResult)
    }

    // Upload banner variants
    if (variants.blur) {
      const blurPath = path.banner('blur')
      const blurResult = await uploadImageFile(
        variants.blur.file,
        blurPath,
        'profile-images'
      )
      uploads.push(blurResult)
    }

    if (variants.tablet) {
      const tabletPath = path.banner('tablet')
      const tabletResult = await uploadImageFile(
        variants.tablet.file,
        tabletPath,
        'profile-images'
      )
      uploads.push(tabletResult)
    }

    if (variants.mobile) {
      const mobilePath = path.banner('mobile')
      const mobileResult = await uploadImageFile(
        variants.mobile.file,
        mobilePath,
        'profile-images'
      )
      uploads.push(mobileResult)
    }

    // Track in database
    await trackImageMetadata(
      userId,
      profileSlug,
      category,
      mainResult.publicUrl,
      mainResult.path,
      variants.main.dimensions,
      file.name,
      nextVersionNum
    )

    // Log cleanup action
    await logCleanupAction(userId, 'upload_new_version', mainResult.path, `Version ${nextVersionNum}`)

    return {
      success: true,
      category,
      version: nextVersionNum,
      main: mainResult,
      variants: uploads,
      totalSize: uploads.reduce((sum, u) => sum + (u.size || 0), 0)
    }
  } catch (error) {
    console.error(`[image-upload] Error uploading ${category}:`, error)
    throw error
  }
}

async function uploadImageFile(file, path, bucket) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true // Replace if exists
    })

  if (error) throw error

  const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(data.path)

  return {
    bucket,
    path: data.path,
    publicUrl: publicData?.publicUrl || '',
    size: file.size
  }
}

// ============================================================================
// PORTFOLIO & SERVICE IMAGES
// ============================================================================

export async function uploadPortfolioImages(files, profileSlug, portfolioId, userId) {
  const path = new ImageStoragePath(profileSlug)
  const results = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const index = i + 1

    // Generate variants for portfolio item
    const variants = await generateImageVariants(file, 'portfolio')

    // Upload main image
    const imagePath = path.portfolioItem(portfolioId, 'image', index)
    const imageResult = await uploadImageFile(
      variants.main.file,
      imagePath,
      'profile-images'
    )

    results.push({
      index,
      path: imageResult.path,
      publicUrl: imageResult.publicUrl,
      size: imageResult.size
    })

    // Track in database
    await trackImageMetadata(
      userId,
      profileSlug,
      'portfolio',
      imageResult.publicUrl,
      imageResult.path,
      variants.main.dimensions,
      file.name,
      index,
      portfolioId
    )
  }

  // Generate and upload cover from first image
  if (files.length > 0) {
    const coverVariants = await generateImageVariants(files[0], 'portfolio_cover')
    
    const coverPath = path.portfolioItem(portfolioId, 'cover')
    const coverResult = await uploadImageFile(
      coverVariants.main.file,
      coverPath,
      'profile-images'
    )

    // Thumbnail
    const thumbPath = path.portfolioItem(portfolioId, 'thumb')
    const thumbResult = await uploadImageFile(
      await compressImage(files[0], { quality: 80, maxWidth: 200, maxHeight: 200 }),
      thumbPath,
      'profile-images'
    )

    results.unshift({
      type: 'cover',
      path: coverResult.path,
      publicUrl: coverResult.publicUrl,
      size: coverResult.size
    })
  }

  return results
}

export async function uploadServiceImages(files, profileSlug, serviceId, userId) {
  const path = new ImageStoragePath(profileSlug)
  const results = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const index = i + 1

    const variants = await generateImageVariants(file, 'service')

    const imagePath = path.serviceImage(serviceId, 'image', index)
    const imageResult = await uploadImageFile(
      variants.main.file,
      imagePath,
      'profile-images'
    )

    results.push({
      index,
      path: imageResult.path,
      publicUrl: imageResult.publicUrl,
      size: imageResult.size
    })

    await trackImageMetadata(
      userId,
      profileSlug,
      'service',
      imageResult.publicUrl,
      imageResult.path,
      variants.main.dimensions,
      file.name,
      index,
      serviceId
    )
  }

  return results
}

// ============================================================================
// VERSION MANAGEMENT & CLEANUP
// ============================================================================

export async function getCurrentVersionNumber(profileSlug, category) {
  const { data, error } = await supabase
    .from('image_metadata')
    .select('version_number')
    .eq('profile_id', profileSlug)
    .eq('category', category)
    .eq('is_current', true)
    .order('version_number', { ascending: false })
    .limit(1)

  if (error || !data?.length) return 0
  return data[0].version_number || 0
}

async function getCurrentImagePath(profileSlug, category) {
  const { data } = await supabase
    .from('image_metadata')
    .select('path')
    .eq('profile_id', profileSlug)
    .eq('category', category)
    .eq('is_current', true)
    .limit(1)

  return data?.[0]?.path || null
}

async function archiveAsVersion(profileSlug, currentPath, versionNum, category) {
  // Download current
  const { data: fileData, error: downloadError } = await supabase.storage
    .from('profile-images')
    .download(currentPath)

  if (downloadError) throw downloadError

  // Upload as version
  const path = new ImageStoragePath(profileSlug)
  const versionPath = path.profilePictureVersion(versionNum)

  const { error: uploadError } = await supabase.storage
    .from('profile-images')
    .upload(versionPath, fileData, { cacheControl: '3600', upsert: false })

  if (uploadError) throw uploadError

  // Mark old version in DB
  await supabase
    .from('image_metadata')
    .update({ is_current: false, is_deleted_from_db: true })
    .eq('path', currentPath)
}

export async function cleanupOldVersions(profileSlug, category, keepVersions = 10) {
  const { data, error } = await supabase
    .from('image_metadata')
    .select('id, path, version_number, file_size')
    .eq('profile_id', profileSlug)
    .eq('category', category)
    .order('version_number', { ascending: false })
    .limit(100)

  if (error || !data?.length) return { deleted: 0 }

  const toDelete = data.slice(keepVersions) // Keep X versions
  let totalFreed = 0

  for (const item of toDelete) {
    try {
      await supabase.storage.from('profile-images').remove([item.path])

      await supabase
        .from('image_metadata')
        .delete()
        .eq('id', item.id)

      await logCleanupAction(
        profileSlug,
        'cleanup_old_version',
        item.path,
        `Kept last ${keepVersions} versions`,
        item.file_size
      )

      totalFreed += item.file_size || 0
    } catch (err) {
      console.error(`Failed to delete version: ${item.path}`, err)
    }
  }

  return {
    deleted: toDelete.length,
    freedBytes: totalFreed,
    freedMB: Math.round(totalFreed / 1024 / 1024 * 100) / 100
  }
}

export async function deleteImage(profileSlug, category, refId = null) {
  const path = new ImageStoragePath(profileSlug)

  // Get metadata for image
  const { data, error } = await supabase
    .from('image_metadata')
    .select('path, file_size, id')
    .eq('profile_id', profileSlug)
    .eq('category', category)
    .eq('is_current', true)
    .limit(1)

  if (error || !data?.length) return { deleted: 0 }

  const imagePath = data[0].path
  const fileSize = data[0].file_size

  // Delete from storage
  try {
    await supabase.storage.from('profile-images').remove([imagePath])

    // Mark as deleted in DB
    await supabase
      .from('image_metadata')
      .update({ is_deleted_from_db: true, deleted_at: new Date().toISOString() })
      .eq('id', data[0].id)

    await logCleanupAction(
      profileSlug,
      'delete',
      imagePath,
      `Deleted ${category}`,
      fileSize
    )

    return {
      deleted: 1,
      freedBytes: fileSize,
      freedMB: Math.round(fileSize / 1024 / 1024 * 100) / 100
    }
  } catch (err) {
    console.error('Delete failed:', err)
    throw err
  }
}

// ============================================================================
// DATABASE TRACKING
// ============================================================================

async function trackImageMetadata(
  userId,
  profileSlug,
  category,
  publicUrl,
  path,
  dimensions,
  originalFilename,
  versionNumber = null,
  referenceId = null
) {
  const hash = await hashFile(publicUrl)

  await supabase.from('image_metadata').upsert({
    profile_id: profileSlug,
    user_id: userId,
    bucket: 'profile-images',
    path,
    category,
    type: category,
    reference_id: referenceId,
    reference_type: referenceId ? (category === 'portfolio' ? 'portfolio' : 'service') : null,
    version_number: versionNumber,
    original_filename: originalFilename,
    dimensions,
    mime_type: 'image/jpeg',
    hash,
    is_current: true
  }, { onConflict: 'path' })
}

async function hashFile(url) {
  // Simple hash - in production use crypto.subtle
  return Math.random().toString(36).substring(2, 15)
}

async function logCleanupAction(profileSlug, action, path, reason, freedBytes = 0) {
  try {
    const { error } = await supabase.from('image_cleanup_log').insert({
      profile_id: profileSlug,
      action,
      path,
      reason,
      freed_bytes: freedBytes
    })
    if (error) {
      console.error('Cleanup log failed:', error)
    }
  } catch (err) {
    console.error('Cleanup log failed:', err)
  }
}

// ============================================================================
// BULK CLEANUP
// ============================================================================

export async function cleanupTempUploads() {
  const { data, error } = await supabase
    .from('image_metadata')
    .select('id, path, file_size')
    .eq('category', 'temp')
    .lt('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())

  if (error || !data?.length) return { cleaned: 0 }

  let totalFreed = 0

  for (const item of data) {
    try {
      await supabase.storage.from('profile-images').remove([item.path])
      await supabase.from('image_metadata').delete().eq('id', item.id)
      totalFreed += item.file_size || 0
    } catch (err) {
      console.error(`Temp cleanup failed: ${item.path}`, err)
    }
  }

  return {
    cleaned: data.length,
    freedBytes: totalFreed,
    freedMB: Math.round(totalFreed / 1024 / 1024 * 100) / 100
  }
}

export async function cleanupOrphanedFiles(profileSlug) {
  const { data, error } = await supabase
    .from('image_metadata')
    .select('id, path, file_size, reference_id, reference_type')
    .eq('profile_id', profileSlug)

  if (error || !data?.length) return { cleaned: 0 }

  const toDelete = []

  for (const item of data) {
    if (!item.reference_id && item.reference_type) {
      // Check if reference still exists
      const table = item.reference_type === 'portfolio' ? 'profile_portfolio' : 'partner_services'
      const { data: ref } = await supabase
        .from(table)
        .select('id')
        .eq('id', item.reference_id)

      if (!ref?.length) {
        toDelete.push(item)
      }
    }
  }

  let totalFreed = 0

  for (const item of toDelete) {
    try {
      await supabase.storage.from('profile-images').remove([item.path])
      await supabase.from('image_metadata').delete().eq('id', item.id)
      totalFreed += item.file_size || 0
    } catch (err) {
      console.error(`Orphan cleanup failed: ${item.path}`, err)
    }
  }

  return {
    cleaned: toDelete.length,
    freedBytes: totalFreed,
    freedMB: Math.round(totalFreed / 1024 / 1024 * 100) / 100
  }
}
