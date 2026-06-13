// src/lib/image-migration-analyzer.js
// Analyze and migrate existing images to advanced hierarchical system

import { supabase } from './supabase.js'
import { ImageStoragePath } from './image-storage-schema.js'

// ============================================================================
// BUCKET ANALYZER
// ============================================================================

export async function analyzeAllBuckets() {
  const buckets = ['profile-images', 'project-media', 'portfolio-media', 'service-media']
  const analysis = {}

  for (const bucket of buckets) {
    try {
      analysis[bucket] = await analyzeBucket(bucket)
    } catch (error) {
      analysis[bucket] = { error: error.message }
    }
  }

  return analysis
}

async function analyzeBucket(bucketName) {
  const { data: files, error } = await supabase.storage.from(bucketName).list('', {
    limit: 10000,
    offset: 0
  })

  if (error) throw error

  const analysis = {
    bucket: bucketName,
    totalFiles: files?.length || 0,
    totalSize: 0,
    files: [],
    stats: {
      images: 0,
      documents: 0,
      orphaned: [],
      duplicates: [],
      unorganized: [],
      byExtension: {},
      bySize: { small: 0, medium: 0, large: 0, xlarge: 0 }
    }
  }

  for (const file of files || []) {
    if (file.id === '.emptyFolderPlaceholder') continue

    const fileInfo = {
      name: file.name,
      size: file.metadata?.size || 0,
      type: file.metadata?.mimetype || 'unknown',
      created: file.created_at,
      updated: file.updated_at
    }

    analysis.totalSize += fileInfo.size

    // Categorize
    if (fileInfo.type.startsWith('image/')) {
      analysis.stats.images++

      const ext = file.name.split('.').pop()?.toLowerCase() || 'unknown'
      analysis.stats.byExtension[ext] = (analysis.stats.byExtension[ext] || 0) + 1

      // Size categories
      const sizeKB = fileInfo.size / 1024
      if (sizeKB < 100) analysis.stats.bySize.small++
      else if (sizeKB < 500) analysis.stats.bySize.medium++
      else if (sizeKB < 2000) analysis.stats.bySize.large++
      else analysis.stats.bySize.xlarge++
    } else {
      analysis.stats.documents++
    }

    // Check if organized (has folder structure)
    const pathParts = file.name.split('/')
    if (pathParts.length === 1) {
      // Root level file - unorganized
      analysis.stats.unorganized.push(fileInfo)
    }

    analysis.files.push(fileInfo)
  }

  // Find potential duplicates (same size + same extension)
  const sizeMap = {}
  for (const file of analysis.files) {
    const key = `${file.size}-${file.type}`
    if (!sizeMap[key]) sizeMap[key] = []
    sizeMap[key].push(file.name)
  }

  for (const [key, files] of Object.entries(sizeMap)) {
    if (files.length > 1) {
      analysis.stats.duplicates.push({
        key,
        files
      })
    }
  }

  analysis.stats.totalSizeMB = Math.round(analysis.totalSize / 1024 / 1024 * 100) / 100
  analysis.stats.totalSizeGB = (analysis.totalSize / 1024 / 1024 / 1024).toFixed(2)
  analysis.stats.unorganizedCount = analysis.stats.unorganized.length
  analysis.stats.duplicateGroupCount = analysis.stats.duplicates.length

  return analysis
}

// ============================================================================
// MIGRATION PLANNER
// ============================================================================

export async function createMigrationPlan() {
  const analysis = await analyzeAllBuckets()
  const plan = {
    timestamp: new Date().toISOString(),
    analysis,
    recommendations: [],
    migrations: [],
    potentialSpaceSavings: 0
  }

  // Profile images analysis
  if (analysis['profile-images']?.totalFiles > 0) {
    const profileAnalysis = analysis['profile-images']

    // Check for unorganized files
    if (profileAnalysis.stats.unorganizedCount > 0) {
      plan.recommendations.push({
        bucket: 'profile-images',
        priority: 'high',
        issue: 'Unorganized files at root level',
        count: profileAnalysis.stats.unorganizedCount,
        action: 'Reorganize into {profile-slug}/profile/ and {profile-slug}/banner/ folders',
        estimatedTimeSavings: `${profileAnalysis.stats.unorganizedCount * 2} minutes`
      })
    }

    // Check for large uncompressed files
    const largeFiles = profileAnalysis.files.filter(f => f.size > 2 * 1024 * 1024)
    if (largeFiles.length > 0) {
      const potentialSavings = largeFiles.reduce((sum, f) => {
        // Estimate 70% compression ratio
        return sum + (f.size * 0.7)
      }, 0)

      plan.recommendations.push({
        bucket: 'profile-images',
        priority: 'high',
        issue: `${largeFiles.length} large uncompressed images (>2MB)`,
        count: largeFiles.length,
        action: 'Compress to JPEG 85% quality and resize to max 300px',
        estimatedSavings: Math.round(potentialSavings / 1024 / 1024) + 'MB',
        potentialSavingBytes: potentialSavings
      })

      plan.potentialSpaceSavings += potentialSavings
    }

    // Check for duplicate candidates
    if (profileAnalysis.stats.duplicateGroupCount > 0) {
      plan.recommendations.push({
        bucket: 'profile-images',
        priority: 'medium',
        issue: `${profileAnalysis.stats.duplicateGroupCount} potential duplicate image groups`,
        action: 'Manual review and cleanup of duplicates',
        note: 'Same size + extension detected'
      })
    }

    // No version history
    plan.recommendations.push({
      bucket: 'profile-images',
      priority: 'medium',
      issue: 'No version history system in place',
      action: 'After migration, enable automatic version history (keep last 10)',
      benefit: 'Users can rollback to previous profile pictures'
    })

    // No responsive variants
    plan.recommendations.push({
      bucket: 'profile-images',
      priority: 'medium',
      issue: 'No responsive variants (mobile, tablet, OG)',
      action: 'After migration, generate automatically for all images',
      benefit: 'Better mobile UX, social sharing, SEO'
    })
  }

  // Project media analysis
  if (analysis['project-media']?.totalFiles > 0) {
    const projectAnalysis = analysis['project-media']

    if (projectAnalysis.totalSize > 500 * 1024 * 1024) {
      plan.recommendations.push({
        bucket: 'project-media',
        priority: 'high',
        issue: `Large storage usage: ${projectAnalysis.stats.totalSizeMB}MB`,
        action: 'Implement 30-day auto-cleanup for old uploads',
        estimatedSavings: `${Math.round(projectAnalysis.stats.totalSizeMB * 0.3)}MB`
      })

      plan.potentialSpaceSavings += projectAnalysis.stats.totalSizeMB * 0.3 * 1024 * 1024
    }
  }

  // Portfolio media analysis
  if (analysis['portfolio-media']?.totalFiles > 0) {
    const portfolioAnalysis = analysis['portfolio-media']

    const xlargFiles = portfolioAnalysis.files.filter(f => f.size > 3 * 1024 * 1024)
    if (xlargFiles.length > 0) {
      plan.recommendations.push({
        bucket: 'portfolio-media',
        priority: 'high',
        issue: `${xlargFiles.length} very large portfolio images (>3MB)`,
        action: 'Compress and resize to max 1200x1200px',
        estimatedSavings: Math.round(xlargFiles.reduce((sum, f) => sum + (f.size * 0.6), 0) / 1024 / 1024) + 'MB'
      })
    }
  }

  plan.recommendations.sort((a, b) => {
    const priorityMap = { high: 1, medium: 2, low: 3 }
    return priorityMap[a.priority] - priorityMap[b.priority]
  })

  const totalSize = Object.values(analysis).reduce((sum, b) => sum + (b.totalSize || 0), 0)
  plan.summary = {
    totalFiles: Object.values(analysis).reduce((sum, b) => sum + (b.totalFiles || 0), 0),
    totalSize: totalSize,
    totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100,
    recommendationCount: plan.recommendations.length,
    potentialSavingsMB: Math.round(plan.potentialSpaceSavings / 1024 / 1024),
    percentSavings: totalSize > 0 ? Math.round((plan.potentialSpaceSavings / totalSize) * 100) : 0
  }

  return plan
}

// ============================================================================
// MIGRATION EXECUTOR
// ============================================================================

export async function migrateProfileImages() {
  const { data: files, error } = await supabase.storage
    .from('profile-images')
    .list('', { limit: 10000 })

  if (error) throw error

  const migrationLog = {
    startTime: new Date().toISOString(),
    totalFiles: files?.length || 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    results: []
  }

  for (const file of files || []) {
    if (file.id === '.emptyFolderPlaceholder') {
      migrationLog.skipped++
      continue
    }

    try {
      // Check if already migrated (has proper folder structure)
      const parts = file.name.split('/')
      if (parts.length >= 2 && ['profile', 'banner', 'portfolio', 'services'].includes(parts[1])) {
        migrationLog.skipped++
        migrationLog.results.push({
          file: file.name,
          status: 'skipped',
          reason: 'Already organized'
        })
        continue
      }

      // Need to migrate: file is at root or in wrong structure
      // Infer category from filename or size
      const category = inferCategory(file.name, file.metadata?.size || 0)

      // For now, just log that it needs migration
      migrationLog.results.push({
        file: file.name,
        status: 'needs_migration',
        inferredCategory: category,
        size: file.metadata?.size || 0,
        action: 'Manual review needed'
      })

      migrationLog.failed++
    } catch (err) {
      migrationLog.failed++
      migrationLog.results.push({
        file: file.name,
        status: 'error',
        error: err.message
      })
    }
  }

  migrationLog.endTime = new Date().toISOString()
  return migrationLog
}

function inferCategory(filename, fileSize) {
  // Heuristics to infer image category
  const lower = filename.toLowerCase()

  if (lower.includes('profile') || lower.includes('avatar') || lower.includes('user')) {
    return 'profile'
  }
  if (lower.includes('banner') || lower.includes('cover') || lower.includes('header')) {
    return 'banner'
  }
  if (lower.includes('portfolio') || lower.includes('work')) {
    return 'portfolio'
  }
  if (lower.includes('service')) {
    return 'service'
  }

  // Fallback: use size heuristics
  // Profile pics tend to be smaller
  if (fileSize < 500 * 1024) {
    return 'profile'
  }
  // Banners are wider (larger but still not huge)
  if (fileSize < 2000 * 1024) {
    return 'banner'
  }

  return 'unknown'
}

// ============================================================================
// OPTIMIZATION RECOMMENDATIONS
// ============================================================================

export async function getOptimizationReport() {
  const plan = await createMigrationPlan()

  const report = {
    generated: new Date().toISOString(),
    summary: plan.summary,
    recommendations: plan.recommendations,
    nextSteps: [
      {
        step: 1,
        title: 'Review Current State',
        action: 'Run analyzeAllBuckets() to see current organization',
        expectedOutput: 'Detailed breakdown of all buckets'
      },
      {
        step: 2,
        title: 'Run Migration Plan',
        action: 'Execute createMigrationPlan() to identify what needs fixing',
        expectedOutput: 'List of recommendations with priority'
      },
      {
        step: 3,
        title: 'Address High Priority Items',
        action: 'Compress large files, reorganize unorganized images, remove duplicates',
        expectedOutput: `Potential space savings: ${plan.summary.potentialSavingsMB}MB`
      },
      {
        step: 4,
        title: 'Set Up New System',
        action: 'Deploy advanced image management system',
        expectedOutput: 'Automatic versioning, responsive variants, cleanup'
      },
      {
        step: 5,
        title: 'Migrate to Hierarchical',
        action: 'Use uploadProfileImage() for new uploads, move existing to hierarchy',
        expectedOutput: 'All images organized by profile/category'
      }
    ],
    timelineEstimate: {
      analysis: '5 minutes',
      highPriorityFixes: '1-2 hours',
      systemSetup: '30 minutes',
      totalMigration: '2-3 hours'
    },
    expectedBenefits: [
      `Save ${plan.summary.potentialSavingsMB}MB storage (${plan.summary.percentSavings}%)`,
      'Automatic version history (rollback capability)',
      'Responsive image variants (better mobile UX)',
      'Auto-cleanup of old/temp files',
      'Better organization and tracking',
      'Improved CDN caching strategy'
    ]
  }

  return report
}

// ============================================================================
// DETAILED BUCKET HEALTH CHECK
// ============================================================================

export async function healthCheckBucket(bucketName) {
  const analysis = await analyzeBucket(bucketName)

  const health = {
    bucket: bucketName,
    timestamp: new Date().toISOString(),
    status: 'analyzing',
    issues: [],
    scores: {
      organization: 0,
      compression: 0,
      cleanliness: 0,
      overall: 0
    }
  }

  // Organization score
  const organizationScore = analysis.files.length > 0 
    ? (analysis.files.length - analysis.stats.unorganizedCount) / analysis.files.length * 100 
    : 100;
  health.scores.organization = Math.round(organizationScore)

  if (organizationScore < 50 && analysis.files.length > 0) {
    health.issues.push({
      severity: 'high',
      issue: 'Poor file organization',
      files: analysis.stats.unorganizedCount,
      percentage: Math.round((analysis.stats.unorganizedCount / analysis.files.length) * 100),
      recommendation: 'Reorganize into hierarchical structure'
    })
  }

  // Compression score (estimate based on size)
  const avgSize = analysis.totalSize / analysis.files.length
  let compressionScore = 100

  if (avgSize > 1.5 * 1024 * 1024) {
    compressionScore = 60
    health.issues.push({
      severity: 'high',
      issue: 'Large average file size',
      avgSizeMB: Math.round(avgSize / 1024 / 1024 * 100) / 100,
      recommendation: 'Compress and resize images'
    })
  } else if (avgSize > 800 * 1024) {
    compressionScore = 80
    health.issues.push({
      severity: 'medium',
      issue: 'Moderate average file size',
      avgSizeMB: Math.round(avgSize / 1024 / 1024 * 100) / 100,
      recommendation: 'Consider compression optimization'
    })
  }

  health.scores.compression = Math.round(compressionScore)

  // Cleanliness score
  let cleanlinessScore = 100
  if (analysis.stats.duplicateGroupCount > 0) {
    cleanlinessScore -= analysis.stats.duplicateGroupCount * 5
    health.issues.push({
      severity: 'medium',
      issue: 'Potential duplicates detected',
      duplicateGroups: analysis.stats.duplicateGroupCount,
      recommendation: 'Review and remove duplicate files'
    })
  }

  // Check for old files
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const oldFiles = analysis.files.filter(f => new Date(f.created) < thirtyDaysAgo)
  if (oldFiles.length > analysis.files.length * 0.3) {
    cleanlinessScore -= 10
    health.issues.push({
      severity: 'low',
      issue: 'Many old files (>30 days)',
      oldFileCount: oldFiles.length,
      percentage: Math.round((oldFiles.length / analysis.files.length) * 100),
      recommendation: 'Consider cleanup policy for unused files'
    })
  }

  health.scores.cleanliness = Math.round(Math.max(0, cleanlinessScore))

  // Overall score
  health.scores.overall = Math.round(
    (health.scores.organization + health.scores.compression + health.scores.cleanliness) / 3
  )

  health.status = health.scores.overall >= 80 ? 'healthy' : health.scores.overall >= 50 ? 'warning' : 'critical'

  health.summary = {
    totalFiles: analysis.totalFiles,
    totalSizeMB: analysis.stats.totalSizeMB,
    unorganizedFiles: analysis.stats.unorganizedCount,
    duplicateGroups: analysis.stats.duplicateGroupCount,
    largeFiles: analysis.files.filter(f => f.size > 2 * 1024 * 1024).length,
    recommendationCount: health.issues.length
  }

  return health
}

// ============================================================================
// EXPORT FOR DASHBOARD
// ============================================================================

export async function getBucketDashboard() {
  const buckets = ['profile-images', 'project-media', 'portfolio-media', 'service-media']
  const dashboard = {
    timestamp: new Date().toISOString(),
    buckets: {},
    aggregated: {
      totalFiles: 0,
      totalSizeMB: 0,
      healthyBuckets: 0,
      criticalBuckets: 0,
      recommendations: 0
    }
  }

  for (const bucket of buckets) {
    dashboard.buckets[bucket] = await healthCheckBucket(bucket)
    dashboard.aggregated.totalFiles += dashboard.buckets[bucket].summary.totalFiles
    dashboard.aggregated.totalSizeMB += dashboard.buckets[bucket].summary.totalSizeMB

    if (dashboard.buckets[bucket].status === 'healthy') {
      dashboard.aggregated.healthyBuckets++
    } else if (dashboard.buckets[bucket].status === 'critical') {
      dashboard.aggregated.criticalBuckets++
    }

    dashboard.aggregated.recommendations += dashboard.buckets[bucket].issues.length
  }

  return dashboard
}
