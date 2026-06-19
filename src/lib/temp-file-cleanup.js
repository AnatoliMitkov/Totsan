// src/lib/temp-file-cleanup.js
// Automated cleanup of temporary files in Supabase buckets

import { supabase } from './supabase.js'

// ============================================================================
// TEMP FILE PATTERNS & CLEANUP RULES
// ============================================================================

export const TEMP_FILE_PATTERNS = {
  'temp_': /temp_\d+/,
  'upload-': /upload-\d+/,
  'tmp_': /tmp_\d+/,
  '.tmp': /\.tmp$/,
  'partial_': /partial_\d+/
}

export const TEMP_CLEANUP_CONFIG = {
  // Cleanup age threshold (in hours)
  maxAgeHours: 24,
  
  // Buckets to scan for temp files
  bucketsToScan: [
    'profile-images',
    'project-media',
    'portfolio-media',
    'service-media'
  ],

  // Path patterns that indicate temp/incomplete uploads
  tempPathPatterns: [
    /temp_\d+/,
    /upload-\d+/,
    /tmp_\d+/,
    /partial_\d+/,
    /\.tmp$/,
    /\.uploading$/,
    /\.incomplete$/
  ],

  // Don't touch these (whitelisted)
  whitelistPatterns: [
    /main\.jpg/,
    /main-/,
    /cover\.jpg/,
    /image-\d{3}\.jpg/,
    /before-\d{3}\.jpg/,
    /after-\d{3}\.jpg/,
    /banner\.jpg/,
    /meta\.json/
  ]
}

// ============================================================================
// DETECT TEMP FILES
// ============================================================================

export function isTempFile(filename, filePath = '') {
  // Check filename for temp patterns
  for (const pattern of TEMP_CLEANUP_CONFIG.tempPathPatterns) {
    if (pattern.test(filename) || pattern.test(filePath)) {
      // Check it's not whitelisted
      for (const whitePattern of TEMP_CLEANUP_CONFIG.whitelistPatterns) {
        if (whitePattern.test(filename)) {
          return false // Whitelisted
        }
      }
      return true
    }
  }
  return false
}

export function analyzeFileAge(createdAtString) {
  const createdAt = new Date(createdAtString)
  const now = new Date()
  const ageHours = (now - createdAt) / (1000 * 60 * 60)
  
  return {
    createdAt,
    ageHours,
    isOld: ageHours > TEMP_CLEANUP_CONFIG.maxAgeHours,
    readableAge: formatAge(ageHours)
  }
}

function formatAge(hours) {
  if (hours < 1) return `${Math.round(hours * 60)} minutes`
  if (hours < 24) return `${Math.round(hours)} hours`
  return `${Math.round(hours / 24)} days`
}

// ============================================================================
// SCAN BUCKETS FOR TEMP FILES
// ============================================================================

export async function scanBucketsForTempFiles(bucketName) {
  console.log(`[temp-cleanup] Scanning ${bucketName}...`)
  
  const { data: files, error } = await supabase.storage
    .from(bucketName)
    .list('', { limit: 10000 })

  if (error) {
    throw new Error(`Failed to list files in ${bucketName}: ${error.message}`)
  }

  const tempFiles = []
  const stats = {
    totalFiles: 0,
    tempFiles: 0,
    oldTempFiles: 0,
    totalTempSize: 0
  }

  for (const file of files || []) {
    stats.totalFiles++
    
    if (isTempFile(file.name)) {
      const age = analyzeFileAge(file.created_at)
      const fileSize = file.metadata?.size || 0

      tempFiles.push({
        name: file.name,
        bucket: bucketName,
        size: fileSize,
        sizeMB: (fileSize / 1024 / 1024).toFixed(2),
        createdAt: file.created_at,
        ageHours: age.ageHours,
        readableAge: age.readableAge,
        isOld: age.isOld
      })

      stats.tempFiles++
      stats.totalTempSize += fileSize

      if (age.isOld) {
        stats.oldTempFiles++
      }
    }
  }

  return {
    bucket: bucketName,
    tempFiles,
    stats: {
      ...stats,
      totalTempSizeMB: (stats.totalTempSize / 1024 / 1024).toFixed(2)
    }
  }
}

export async function scanAllBucketsForTempFiles() {
  const results = {}
  const aggregated = {
    totalTempFiles: 0,
    totalOldTempFiles: 0,
    totalTempSizeMB: 0,
    buckets: {}
  }

  for (const bucket of TEMP_CLEANUP_CONFIG.bucketsToScan) {
    try {
      const result = await scanBucketsForTempFiles(bucket)
      results[bucket] = result

      aggregated.totalTempFiles += result.stats.tempFiles
      aggregated.totalOldTempFiles += result.stats.oldTempFiles
      aggregated.totalTempSizeMB += parseFloat(result.stats.totalTempSizeMB)
      aggregated.buckets[bucket] = result.stats
    } catch (error) {
      console.error(`[temp-cleanup] Error scanning ${bucket}:`, error)
      results[bucket] = { error: error.message }
    }
  }

  return {
    timestamp: new Date().toISOString(),
    results,
    aggregated: {
      ...aggregated,
      totalTempSizeMB: aggregated.totalTempSizeMB.toFixed(2)
    }
  }
}

// ============================================================================
// CLEANUP TEMP FILES
// ============================================================================

export async function cleanupOldTempFiles(bucketName, maxAgeHours = 24, dryRun = true) {
  console.log(`[temp-cleanup] ${dryRun ? 'DRY RUN - ' : ''}Cleaning ${bucketName} (max age: ${maxAgeHours}h)`)

  const scan = await scanBucketsForTempFiles(bucketName)
  const toDelete = scan.tempFiles.filter(f => f.ageHours > maxAgeHours)

  if (toDelete.length === 0) {
    return {
      bucket: bucketName,
      action: dryRun ? 'dry-run' : 'cleanup',
      deleted: 0,
      freedBytes: 0,
      freedMB: 0,
      details: []
    }
  }

  const details = []
  let totalFreed = 0

  for (const file of toDelete) {
    try {
      if (!dryRun) {
        const { error } = await supabase.storage
          .from(bucketName)
          .remove([file.name])

        if (error) throw error

        // Log to cleanup table if it exists
        try {
          await supabase.from('image_cleanup_log').insert({
            action: 'cleanup_temp',
            path: file.name,
            reason: `Temp file older than ${maxAgeHours}h`,
            freed_bytes: file.size
          }).catch(() => {}) // Silently fail if table doesn't exist
        } catch (e) {
          // Table might not exist yet, that's OK
        }
      }

      totalFreed += file.size
      details.push({
        file: file.name,
        age: file.readableAge,
        size: file.sizeMB,
        status: dryRun ? 'would-delete' : 'deleted'
      })
    } catch (error) {
      details.push({
        file: file.name,
        age: file.readableAge,
        size: file.sizeMB,
        status: 'error',
        error: error.message
      })
    }
  }

  return {
    bucket: bucketName,
    action: dryRun ? 'dry-run' : 'cleanup',
    deleted: toDelete.filter(d => d.status === 'deleted').length,
    freedBytes: totalFreed,
    freedMB: (totalFreed / 1024 / 1024).toFixed(2),
    details
  }
}

export async function cleanupAllTempFiles(maxAgeHours = 24, dryRun = true) {
  const results = {}
  const aggregated = {
    totalDeleted: 0,
    totalFreedMB: 0,
    buckets: {}
  }

  for (const bucket of TEMP_CLEANUP_CONFIG.bucketsToScan) {
    try {
      const result = await cleanupOldTempFiles(bucket, maxAgeHours, dryRun)
      results[bucket] = result

      aggregated.totalDeleted += result.deleted
      aggregated.totalFreedMB += parseFloat(result.freedMB)
      aggregated.buckets[bucket] = {
        deleted: result.deleted,
        freedMB: result.freedMB
      }
    } catch (error) {
      console.error(`[temp-cleanup] Error cleaning ${bucket}:`, error)
      results[bucket] = { error: error.message }
    }
  }

  return {
    timestamp: new Date().toISOString(),
    action: dryRun ? 'dry-run' : 'cleanup',
    results,
    aggregated: {
      ...aggregated,
      totalFreedMB: aggregated.totalFreedMB.toFixed(2)
    }
  }
}

// ============================================================================
// PREVENT TEMP FILES FROM BEING CREATED
// ============================================================================

export function generateCleanFilePath(baseDir, filename, shouldAvoidTemp = true) {
  // Don't create temp_ prefixed files
  if (shouldAvoidTemp) {
    return `${baseDir}/${filename}`
  }
  return `${baseDir}/${filename}`
}

// ============================================================================
// SCHEDULED CLEANUP (For Cron Jobs)
// ============================================================================

export async function scheduleCleanup() {
  // This should be called by a Supabase cron job or external scheduler
  // Example cron: Run daily at 2 AM
  
  console.log('[temp-cleanup] Starting scheduled cleanup...')
  
  try {
    // First, dry run to see what would be deleted
    const dryRunResults = await cleanupAllTempFiles(24, true) // 24 hours old
    console.log('[temp-cleanup] Dry run results:', dryRunResults)

    // If dry run shows files to delete, execute cleanup
    if (dryRunResults.aggregated.totalDeleted > 0) {
      console.log(`[temp-cleanup] Found ${dryRunResults.aggregated.totalDeleted} temp files to delete`)
      
      const realResults = await cleanupAllTempFiles(24, false) // Actually delete
      console.log('[temp-cleanup] Cleanup completed:', realResults)
      
      return realResults
    }

    return dryRunResults
  } catch (error) {
    console.error('[temp-cleanup] Scheduled cleanup failed:', error)
    throw error
  }
}

// ============================================================================
// REPORTING
// ============================================================================

export async function getTempFileReport() {
  const scan = await scanAllBucketsForTempFiles()

  return {
    timestamp: scan.timestamp,
    summary: {
      totalTempFiles: scan.aggregated.totalTempFiles,
      oldTempFilesNeedCleanup: scan.aggregated.totalOldTempFiles,
      totalWastedSpaceMB: scan.aggregated.totalTempSizeMB,
      potentialSpaceToRecoverMB: scan.aggregated.totalOldTempFiles > 0
        ? (scan.aggregated.totalTempSizeMB * (scan.aggregated.totalOldTempFiles / scan.aggregated.totalTempFiles)).toFixed(2)
        : '0'
    },
    byBucket: scan.results,
    nextAction: scan.aggregated.totalOldTempFiles > 0
      ? `Run cleanupAllTempFiles(24, false) to delete ${scan.aggregated.totalOldTempFiles} old temp files`
      : 'No cleanup needed'
  }
}
