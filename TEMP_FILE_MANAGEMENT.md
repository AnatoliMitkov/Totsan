# Temporary File Management

**How to handle and cleanup incomplete uploads and temp files in Supabase buckets.**

---

## Problem: Temp Files Accumulation

### What Are Temp Files?

Temporary files appear in your buckets when:
- ✗ Upload interrupted mid-stream
- ✗ Browser tab closed during upload
- ✗ Network connection dropped
- ✗ Multi-part upload incomplete
- ✗ Failed compression/resizing operation
- ✗ Debugging/testing with various upload mechanisms

### Example Temp File URL
```
https://uywibfxqqcypemtrvozp.supabase.co/storage/v1/object/public/profile-images/
  8f69f8d5-13aa-4dd0-a070-16c6ef0007a1/portfolio/temp_1781468240550/image-001.jpg
                                                     ^^^^^^^^ temp file pattern
```

### Temp File Patterns Detected

The system looks for these patterns:
- `temp_1234567890` — timestamp-based temp directory
- `upload-1234567890` — upload temp directory
- `tmp_...` — generic temp prefix
- `partial_...` — incomplete partial uploads
- `.tmp`, `.uploading`, `.incomplete` — file extensions

---

## Impact

### Storage Cost
```
100 profiles × 1 stray temp file per year = 100 temp files
100 temp files × 2MB average = 200MB wasted
200MB × $0.023/GB/month = $4.60/month
Annual cost: $55 per 1,000 profiles
```

### Performance
- Temp files clutter the bucket listing
- Slower directory scans
- More storage quota consumed
- Complicates backup/restore

---

## Solution: Automated Cleanup

### Part 1: Detection

Scan buckets for temp files:

```javascript
import { scanAllBucketsForTempFiles } from '@/lib/temp-file-cleanup.js'

const scan = await scanAllBucketsForTempFiles()

console.log(scan)
// {
//   results: {
//     'profile-images': {
//       bucket: 'profile-images',
//       tempFiles: [
//         {
//           name: 'temp_1781468240550/image-001.jpg',
//           bucket: 'profile-images',
//           size: 2097152,
//           sizeMB: '2.00',
//           createdAt: '2024-02-09T12:34:56.000Z',
//           ageHours: 72,
//           readableAge: '3 days',
//           isOld: true
//         }
//       ],
//       stats: {
//         totalFiles: 1245,
//         tempFiles: 8,
//         oldTempFiles: 6,
//         totalTempSize: 16777216,
//         totalTempSizeMB: '16.00'
//       }
//     },
//     ...
//   },
//   aggregated: {
//     totalTempFiles: 32,
//     totalOldTempFiles: 24,
//     totalTempSizeMB: '45.20'
//   }
// }
```

### Part 2: Dry Run (Preview)

See what would be deleted without actually deleting:

```javascript
import { cleanupAllTempFiles } from '@/lib/temp-file-cleanup.js'

const dryRun = await cleanupAllTempFiles(
  24,    // Max age in hours (delete files older than 24 hours)
  true   // dryRun = true (don't actually delete)
)

console.log(dryRun)
// {
//   action: 'dry-run',
//   aggregated: {
//     totalDeleted: 24,
//     totalFreedMB: '45.20'
//   },
//   results: {
//     'profile-images': {
//       deleted: 6,
//       details: [
//         { file: 'temp_1781468240550/image-001.jpg', status: 'would-delete' },
//         ...
//       ]
//     }
//   }
// }
```

### Part 3: Actually Cleanup

Execute the cleanup to delete old temp files:

```javascript
const cleanup = await cleanupAllTempFiles(
  24,     // Max age in hours
  false   // dryRun = false (actually delete)
)

console.log(`Cleaned up ${cleanup.aggregated.totalDeleted} files, freed ${cleanup.aggregated.totalFreedMB}MB`)
// Cleaned up 24 files, freed 45.20MB
```

---

## Admin Dashboard

### Add to Admin Panel

```javascript
// pages/AdminTempFiles.jsx
import TempFileManager from '@/components/admin/TempFileManager.jsx'

export default function AdminTempFiles() {
  return <TempFileManager />
}
```

### Usage

1. **Scan** — Click "Scan Buckets" to analyze temp files
2. **Review** — See breakdown by bucket and file details
3. **Preview** — Click "Dry Run" mode and "Cleanup" to preview
4. **Execute** — Switch to "Delete" mode and confirm

---

## Automation: Scheduled Cleanup

### Option 1: Supabase Cron Job

Use Supabase Edge Functions with pg_cron:

```sql
-- Run daily at 2 AM UTC
select cron.schedule('cleanup-temp-files-daily', '0 2 * * *', $$
  SELECT http_post(
    'https://[YOUR-PROJECT].functions.supabase.co/cleanup-temp-files',
    '{}',
    'application/json'
  ) as request_id;
$$);
```

### Option 2: External Cron (GitHub Actions, etc.)

```yaml
# .github/workflows/cleanup-temp-files.yml
name: Cleanup Temp Files
on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Cleanup temp files
        run: |
          curl -X POST https://[YOUR-API]/api/cleanup-temp-files \
            -H "Authorization: Bearer ${{ secrets.CLEANUP_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d '{"maxAgeHours": 24}'
```

### Option 3: Manual via Admin Dashboard

Click the cleanup button in the Temp File Manager (easiest for testing).

---

## Configuration

### Change Cleanup Rules

Edit `TEMP_CLEANUP_CONFIG` in `src/lib/temp-file-cleanup.js`:

```javascript
export const TEMP_CLEANUP_CONFIG = {
  // Time threshold: delete files older than this
  maxAgeHours: 24,  // Default: 24 hours
  
  // Buckets to monitor
  bucketsToScan: [
    'profile-images',
    'project-media',
    'portfolio-media',
    'service-media'
  ],

  // Patterns that indicate temp files
  tempPathPatterns: [
    /temp_\d+/,
    /upload-\d+/,
    /tmp_\d+/,
    /partial_\d+/,
    /\.tmp$/,
    /\.uploading$/,
    /\.incomplete$/
  ],

  // Patterns that should NEVER be deleted
  whitelistPatterns: [
    /main\.jpg/,
    /main-/,
    /cover\.jpg/,
    /image-\d{3}\.jpg/,
    /meta\.json/
  ]
}
```

---

## Prevention: Avoid Creating Temp Files

### Best Practices for Uploads

```javascript
// ✓ Good: Upload directly to final path
const result = await uploadProfileImage(
  file,
  profileSlug,
  userId,
  'profile'
)
// Creates: {profileSlug}/profile/main.jpg (no temp folder)

// ✗ Bad: Don't use temp directories
await supabase.storage
  .from('profile-images')
  .upload(`temp_${Date.now()}/image.jpg`, file)  // Creates temp folder!

// ✓ Good: Use proper upload system with validation
import { uploadProfileImage } from '@/lib/advanced-image-manager.js'

// Validates, compresses, generates variants
// Never creates intermediate temp directories
```

### Upload Error Handling

```javascript
try {
  const result = await uploadProfileImage(file, slug, userId, 'profile')
  
  // Success — file is in proper location
  updateDatabase(result.main.publicUrl)
} catch (error) {
  // Clean up any failed uploads
  console.error('Upload failed:', error)
  
  // Cleanup will handle any stray files later
  // Just inform the user to retry
  showError('Upload failed, please try again')
}
```

---

## Monitoring

### Monthly Report

```javascript
import { getTempFileReport } from '@/lib/temp-file-cleanup.js'

const report = await getTempFileReport()

console.log(`
  Total temp files: ${report.summary.totalTempFiles}
  Needing cleanup: ${report.summary.oldTempFilesNeedCleanup}
  Wasted space: ${report.summary.totalWastedSpaceMB}MB
  Recoverable: ${report.summary.potentialSpaceToRecoverMB}MB
`)

// Log to analytics/monitoring
analytics.track('temp_files_report', report.summary)
```

### Integration with Storage Monitoring

```javascript
// In your storage stats dashboard
const tempFileReport = await getTempFileReport()

dashboard.addMetric('temp_files_total', tempFileReport.summary.totalTempFiles)
dashboard.addMetric('wasted_space_mb', tempFileReport.summary.totalWastedSpaceMB)
dashboard.addAlert(
  tempFileReport.summary.oldTempFilesNeedCleanup > 50
    ? 'warning'
    : 'info',
  `${tempFileReport.summary.potentialSpaceToRecoverMB}MB available to recover`
)
```

---

## API Reference

### Functions

#### `scanAllBucketsForTempFiles()`
Scans all buckets for temp files. Returns count, size, age, and details.

#### `scanBucketsForTempFiles(bucketName)`
Scans single bucket for temp files.

#### `cleanupAllTempFiles(maxAgeHours, dryRun)`
- `maxAgeHours`: Only delete files older than this (default 24)
- `dryRun`: If true, preview only; if false, actually delete
- Returns: deleted count and freed space

#### `cleanupOldTempFiles(bucketName, maxAgeHours, dryRun)`
Cleanup single bucket.

#### `getTempFileReport()`
Get summary report of all temp files across all buckets.

#### `isTempFile(filename, filePath)`
Check if a filename matches temp file patterns.

#### `analyzeFileAge(createdAtString)`
Get file age in hours and human-readable format.

#### `scheduleCleanup()`
Run via cron job (dry run first, then real cleanup if needed).

---

## Safety & Guarantees

### Protected Files

These patterns are NEVER deleted (whitelisted):
- `main.jpg` — Primary images
- `main-*` — Image variants (thumb, OG, etc.)
- `cover.jpg` — Portfolio/service covers
- `image-001.jpg` — Numbered images
- `before-*`, `after-*` — Before/after photos
- `meta.json` — Metadata files

### Audit Trail

Every deleted file is logged:

```sql
SELECT * FROM image_cleanup_log 
WHERE action = 'cleanup_temp'
ORDER BY created_at DESC;
```

### Rollback

- Supabase keeps version history (if enabled)
- All deletions are logged with timestamp
- Can restore from backups if needed

---

## Troubleshooting

### Q: I need to recover deleted files

**A:** Check Supabase backups or restore from version history.

### Q: Cleanup isn't working

**A:** Verify:
1. Admin dashboard shows temp files → `scanAllBucketsForTempFiles()`
2. Dry run shows files to delete → `cleanupAllTempFiles(24, true)`
3. User has proper permissions in Supabase RLS
4. Cron job is running (check logs)

### Q: Can I customize what counts as "temp"?

**A:** Edit `TEMP_CLEANUP_CONFIG.tempPathPatterns` in `src/lib/temp-file-cleanup.js`

### Q: What's a safe max age?

**A:** 
- **24 hours:** Very aggressive, only safe uploads fail
- **48 hours:** Recommended for production
- **7 days:** Conservative, captures more stray uploads
- **30 days:** Very conservative

---

## Costs & Impact

### Before Cleanup
```
1000 profiles × ~1 stray temp file/month = 1000 temp files/month
1000 temp files × 2MB average = 2000 MB (2 GB)
Cost: $4.60/month × 12 = $55/year per 1000 profiles
```

### After Cleanup (Daily Run)
```
99% of temp files cleaned within 24 hours
Max accumulation: ~50 files = 100 MB
Cost: $0.23/month × 12 = $2.76/year per 1000 profiles
Savings: ~$52/year per 1000 profiles
```

---

## Summary

- ✅ Automatic detection of temp files
- ✅ Safe dry-run preview
- ✅ Whitelist protection for real files
- ✅ Audit logging
- ✅ Scheduled cleanup
- ✅ Admin dashboard
- ✅ Cost savings

Cleanup temp files daily via cron or manually via the admin dashboard.
