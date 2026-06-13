// src/lib/storage-monitoring.js
// Monitor and optimize Supabase Storage usage, cleanup old files

import { supabase } from './supabase.js'

// ============================================================================
// STORAGE USAGE
// ============================================================================

export async function getStorageStats() {
  const buckets = ['profile-images', 'project-media', 'portfolio-media', 'service-media']
  const stats = {}

  for (const bucket of buckets) {
    try {
      const { data, error } = await supabase.storage.from(bucket).list()

      if (error) {
        stats[bucket] = { error: error.message, files: 0, size: 0 }
        continue
      }

      const files = data || []
      let totalSize = 0

      // Recursively count files and size
      const walkDir = async (path) => {
        const { data: items } = await supabase.storage.from(bucket).list(path)
        let size = 0
        for (const item of items || []) {
          if (item.metadata?.mimetype?.startsWith('image/')) {
            size += item.metadata?.size || 0
          }
          if (item.id && item.name.includes('.')) {
            // It's a file
            size += item.metadata?.size || 0
          }
        }
        return size
      }

      totalSize = await walkDir('')

      stats[bucket] = {
        files: files.length,
        size: totalSize,
        sizeKB: Math.round(totalSize / 1024),
        sizeMB: Math.round(totalSize / 1024 / 1024),
        sizeGB: (totalSize / 1024 / 1024 / 1024).toFixed(2)
      }
    } catch (err) {
      stats[bucket] = { error: err.message }
    }
  }

  return stats
}

// ============================================================================
// CLEANUP OLD FILES
// ============================================================================

export async function deleteOldFiles(bucket, daysOld = 90) {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000)

  try {
    const { data: files, error } = await supabase.storage.from(bucket).list()

    if (error) throw error

    const filesToDelete = []

    for (const file of files || []) {
      if (!file.created_at) continue

      const createdAt = new Date(file.created_at)
      if (createdAt < cutoffDate) {
        filesToDelete.push(file.name)
      }
    }

    if (filesToDelete.length === 0) {
      return { deleted: 0, bucket, daysOld }
    }

    const { error: deleteError } = await supabase.storage
      .from(bucket)
      .remove(filesToDelete)

    if (deleteError) throw deleteError

    return {
      deleted: filesToDelete.length,
      bucket,
      daysOld,
      files: filesToDelete
    }
  } catch (err) {
    console.error(`[storage-cleanup] Error in ${bucket}:`, err)
    throw err
  }
}

// ============================================================================
// CLEANUP ORPHANED FILES (not referenced in database)
// ============================================================================

export async function deleteOrphanedFiles(bucket) {
  const { data: session } = await supabase.auth.getSession()
  if (!session?.user) throw new Error('Not authenticated')

  try {
    const { data: files, error } = await supabase.storage.from(bucket).list()
    if (error) throw error

    const filesToDelete = []
    const orphanedPaths = []

    for (const file of files || []) {
      const fullPath = file.name
      let isReferenced = false

      // Check if file is referenced in database tables based on bucket
      if (bucket === 'profile-images') {
        const { data } = await supabase
          .from('accounts')
          .select('avatar_url')
          .ilike('avatar_url', `%${fullPath}%`)
          .limit(1)
        isReferenced = data?.length > 0
      } else if (bucket === 'project-media') {
        const { data } = await supabase
          .from('client_project_media')
          .select('path')
          .eq('path', fullPath)
          .limit(1)
        isReferenced = data?.length > 0
      } else if (bucket === 'portfolio-media') {
        const { data } = await supabase
          .from('profile_portfolio')
          .select('media')
          .ilike('media', `%${fullPath}%`)
          .limit(1)
        isReferenced = data?.length > 0
      }

      if (!isReferenced) {
        filesToDelete.push(fullPath)
        orphanedPaths.push(fullPath)
      }
    }

    if (filesToDelete.length === 0) {
      return { deleted: 0, bucket, orphaned: [] }
    }

    const { error: deleteError } = await supabase.storage
      .from(bucket)
      .remove(filesToDelete)

    if (deleteError) throw deleteError

    return {
      deleted: filesToDelete.length,
      bucket,
      orphaned: orphanedPaths
    }
  } catch (err) {
    console.error(`[storage-cleanup-orphaned] Error in ${bucket}:`, err)
    throw err
  }
}

// ============================================================================
// DUPLICATE DETECTION (files with same content)
// ============================================================================

export async function findDuplicateFiles(bucket) {
  try {
    const { data: files, error } = await supabase.storage.from(bucket).list()
    if (error) throw error

    const hashes = {}
    const duplicates = {}

    for (const file of files || []) {
      if (!file.name || !file.metadata?.size) continue

      // Simple hash: size + name
      const hash = `${file.metadata.size}-${file.name.split('.').pop()}`

      if (!hashes[hash]) {
        hashes[hash] = []
      }
      hashes[hash].push(file.name)
    }

    // Filter to only show groups with duplicates
    for (const [hash, files] of Object.entries(hashes)) {
      if (files.length > 1) {
        duplicates[hash] = files
      }
    }

    return {
      bucket,
      duplicateGroups: Object.keys(duplicates).length,
      duplicates,
      recommendation: 'Review and delete redundant copies manually or use cleanup functions'
    }
  } catch (err) {
    console.error(`[storage-duplicates] Error in ${bucket}:`, err)
    throw err
  }
}

// ============================================================================
// MIGRATION: CONSOLIDATE BUCKETS
// ============================================================================

export async function migrateFilesToOptimizedBucket(sourceBucket, destBucket) {
  try {
    const { data: files, error } = await supabase.storage.from(sourceBucket).list()
    if (error) throw error

    const migrated = []
    const failed = []

    for (const file of files || []) {
      try {
        // Download from source
        const { data: fileData, error: downloadError } = await supabase.storage
          .from(sourceBucket)
          .download(file.name)

        if (downloadError) throw downloadError

        // Upload to destination
        const { error: uploadError } = await supabase.storage
          .from(destBucket)
          .upload(file.name, fileData, { upsert: true })

        if (uploadError) throw uploadError

        // Delete from source
        await supabase.storage.from(sourceBucket).remove([file.name])

        migrated.push(file.name)
      } catch (err) {
        failed.push({ file: file.name, error: err.message })
      }
    }

    return {
      sourceBucket,
      destBucket,
      migrated: migrated.length,
      failed: failed.length,
      details: { migrated, failed }
    }
  } catch (err) {
    console.error(`[storage-migration] Error:`, err)
    throw err
  }
}

// ============================================================================
// COMPRESS OLD IMAGES (re-optimize if quality is degraded)
// ============================================================================

export async function recompressImages(bucket, olderThanDays = 30) {
  const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000)
  const recompressed = []
  const failed = []

  try {
    const { data: files, error } = await supabase.storage.from(bucket).list()
    if (error) throw error

    for (const file of files || []) {
      if (!file.created_at || !file.name.match(/\.(jpg|jpeg|png)$/i)) {
        continue
      }

      const createdAt = new Date(file.created_at)
      if (createdAt > cutoffDate) continue

      try {
        // Download
        const { data: fileData, error: downloadError } = await supabase.storage
          .from(bucket)
          .download(file.name)

        if (downloadError) throw downloadError

        // In real scenario, would re-compress here using Canvas or image processing library
        // For now, just track which files would be recompressed

        recompressed.push({
          file: file.name,
          originalSize: file.metadata?.size,
          createdAt: file.created_at,
          wouldCompress: true
        })
      } catch (err) {
        failed.push({ file: file.name, error: err.message })
      }
    }

    return {
      bucket,
      olderThanDays,
      candidates: recompressed.length,
      failed: failed.length,
      recommendation: 'Use server-side image processing for production recompression',
      details: { recompressed, failed }
    }
  } catch (err) {
    console.error(`[storage-recompress] Error:`, err)
    throw err
  }
}

// ============================================================================
// HEALTH CHECK & REPORTS
// ============================================================================

export async function getStorageHealthReport() {
  const stats = await getStorageStats()
  const report = {
    timestamp: new Date().toISOString(),
    buckets: stats,
    summary: {
      totalBuckets: Object.keys(stats).length,
      healthyBuckets: 0,
      issuesFound: []
    }
  }

  for (const [bucket, data] of Object.entries(stats)) {
    if (data.error) {
      report.summary.issuesFound.push(`${bucket}: ${data.error}`)
      continue
    }

    report.summary.healthyBuckets++

    // Check for potential issues
    if (data.sizeGB > 1) {
      report.summary.issuesFound.push(`${bucket}: Over 1GB, consider cleanup`)
    }
    if (data.files > 10000) {
      report.summary.issuesFound.push(`${bucket}: Over 10k files, consider archiving`)
    }
  }

  report.summary.recommendation = report.summary.issuesFound.length === 0
    ? 'Storage is healthy'
    : 'Review issues and run cleanup if needed'

  return report
}

// ============================================================================
// AUDIT TRAIL (track who uploaded what when)
// ============================================================================

export async function logStorageAction(action, bucket, path, details = {}) {
  const { data: session } = await supabase.auth.getSession()

  return supabase.from('audit_log').insert({
    action,
    entity_type: 'storage',
    entity_id: null,
    payload: {
      bucket,
      path,
      actor_email: session?.user?.email,
      ...details
    }
  })
}

// ============================================================================
// EXPORT FOR ADMIN DASHBOARD
// ============================================================================

export async function getAdminStorageDashboard() {
  const stats = await getStorageStats()
  const health = await getStorageHealthReport()

  return {
    stats,
    health,
    actions: {
      cleanup30Days: 'deleteOldFiles(bucket, 30)',
      cleanupOrphaned: 'deleteOrphanedFiles(bucket)',
      findDuplicates: 'findDuplicateFiles(bucket)',
      recompress: 'recompressImages(bucket, 30)'
    },
    recommendations: [
      'Run cleanup monthly to free unused storage',
      'Check for orphaned files when deleting data from DB',
      'Review duplicates in portfolio and service media',
      'Enable auto-compression for large batches'
    ]
  }
}
