# Temp File Cleanup - Quick Reference

**Fast answers for managing temporary files in Supabase buckets**

---

## What Are Temp Files?

Temp files like `temp_1781468240550/` appear when:
- Upload fails mid-stream
- Browser crashes during upload
- Network interruption
- Multi-part upload incomplete
- Debugging/testing

**Example:** `profile-images/8f69f8d5-13aa/portfolio/temp_1781468240550/image-001.jpg`

---

## Quick Actions

### Check If You Have Temp Files

```javascript
import { getTempFileReport } from '@/lib/temp-file-cleanup.js'

const report = await getTempFileReport()
console.log(`Total temp files: ${report.summary.totalTempFiles}`)
console.log(`Space wasted: ${report.summary.totalWastedSpaceMB}MB`)
```

### Preview What Would Be Deleted

```javascript
import { cleanupAllTempFiles } from '@/lib/temp-file-cleanup.js'

const preview = await cleanupAllTempFiles(24, true)  // 24 hours, dry run
console.log(`Would delete: ${preview.aggregated.totalDeleted} files`)
console.log(`Would free: ${preview.aggregated.totalFreedMB}MB`)
```

### Actually Clean Them Up

```javascript
const cleanup = await cleanupAllTempFiles(24, false)  // Actually delete
console.log(`Deleted: ${cleanup.aggregated.totalDeleted} files`)
console.log(`Freed: ${cleanup.aggregated.totalFreedMB}MB`)
```

---

## Admin Dashboard

### Add to Admin Panel (2 minutes)

```javascript
// pages/AdminTempFiles.jsx
import TempFileManager from '@/components/admin/TempFileManager.jsx'

export default function AdminTempFiles() {
  return <TempFileManager />
}
```

### Use Dashboard

1. Click "Scan Buckets"
2. Review findings
3. Set max age (24h, 48h, 7d)
4. Try "Dry Run" mode first
5. Switch to "Delete" mode
6. Confirm

---

## Automate Cleanup

### Daily via Cron Job

```sql
-- Run at 2 AM daily
select cron.schedule('cleanup-temp-files', '0 2 * * *', $$
  SELECT http_post(
    'https://[PROJECT].functions.supabase.co/cleanup',
    '{"maxAgeHours": 24}'
  );
$$);
```

### Via GitHub Actions

```yaml
name: Cleanup Temp Files
on:
  schedule:
    - cron: '0 2 * * *'
jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -X POST https://[API]/cleanup \
            -H "Authorization: Bearer ${{ secrets.TOKEN }}" \
            -d '{"maxAgeHours": 24}'
```

---

## Configuration

### Adjust Temp File Age Threshold

Edit `src/lib/temp-file-cleanup.js`:

```javascript
export const TEMP_CLEANUP_CONFIG = {
  maxAgeHours: 24,  // Delete files older than 24 hours
                    // Change to 48 for conservative cleanup
                    // Change to 12 for aggressive cleanup
  ...
}
```

### Add More Temp Patterns

```javascript
tempPathPatterns: [
  /temp_\d+/,
  /upload-\d+/,
  /tmp_\d+/,
  /partial_\d+/,
  /\.tmp$/,
  /my-custom-temp-pattern/  // Add custom patterns
]
```

---

## Cost Impact

### Without Cleanup
```
100 uploads/month with 2% failure rate = 2 stray temp files/month
2 files × 2 MB average = 4 MB/month
Over 1 year: 48 MB
Cost: $1.10/year per 1000 profiles
```

### With Daily Cleanup
```
Max accumulation before cleanup: ~50 temp files
50 × 2 MB = 100 MB (recovered daily)
Cost: $0.15/month × 12 = $1.80/year
Savings: Negligible but keeps bucket clean
```

---

## Frequently Asked Questions

**Q: Is it safe to cleanup temp files?**
A: Yes. They're incomplete/failed uploads. Safe to delete after 24+ hours.

**Q: What if I delete a temp file I need?**
A: Temp files are by definition incomplete. They're not usable anyway.

**Q: How often should I run cleanup?**
A: Daily via cron is ideal. Or weekly via admin dashboard.

**Q: Can I set different ages per bucket?**
A: Currently no, but you can wrap `cleanupOldTempFiles()` in a loop.

**Q: What's a safe age threshold?**
A: 24 hours is standard. Goes up to 48 hours for safety, down to 12 for aggressive.

**Q: Will this affect real images?**
A: No. Temp files have these patterns: `temp_`, `upload-`, `tmp_`, `partial_`
Real images (main.jpg, image-001.jpg, etc.) are whitelisted.

**Q: Can I preview which files would be deleted?**
A: Yes. Use dry run mode: `cleanupAllTempFiles(24, true)`

---

## API Reference

### Scan Functions

```javascript
// Scan all buckets
const scan = await scanAllBucketsForTempFiles()

// Scan one bucket
const scan = await scanBucketsForTempFiles('profile-images')

// Get summary report
const report = await getTempFileReport()
```

### Cleanup Functions

```javascript
// Cleanup all buckets (dry run)
const dryRun = await cleanupAllTempFiles(24, true)

// Cleanup all buckets (actually delete)
const cleanup = await cleanupAllTempFiles(24, false)

// Cleanup one bucket
const cleanup = await cleanupOldTempFiles('profile-images', 24, false)

// Scheduled cleanup (for cron jobs)
const scheduled = await scheduleCleanup()
```

### Utility Functions

```javascript
// Check if file is temp
const isTemp = isTempFile('filename.jpg', 'temp_1234567890/filename.jpg')

// Get file age
const age = analyzeFileAge('2024-02-09T12:34:56.000Z')
// Returns: { ageHours, createdAt, isOld, readableAge }
```

---

## Integration Examples

### React Component

```javascript
import { getTempFileReport } from '@/lib/temp-file-cleanup.js'

export function StorageStats() {
  const [report, setReport] = useState(null)

  useEffect(() => {
    getTempFileReport().then(setReport)
  }, [])

  return (
    <div>
      <p>Temp files: {report?.summary.totalTempFiles}</p>
      <p>Wasted: {report?.summary.totalWastedSpaceMB}MB</p>
    </div>
  )
}
```

### Scheduled Function

```javascript
// Supabase Edge Function
import { scheduleCleanup } from '@/lib/temp-file-cleanup.js'

export default async (req) => {
  const result = await scheduleCleanup()
  return new Response(JSON.stringify(result), { status: 200 })
}
```

### Monitoring

```javascript
const report = await getTempFileReport()

if (report.summary.totalWastedSpaceMB > 100) {
  // Alert: More than 100MB of temp files
  notifyAdmin(`${report.summary.totalWastedSpaceMB}MB of temp files found`)
}
```

---

## Files Included

- `src/lib/temp-file-cleanup.js` — Core cleanup logic
- `src/components/admin/TempFileManager.jsx` — Admin dashboard
- `TEMP_FILE_MANAGEMENT.md` — Full documentation

---

## Troubleshooting

**Cleanup isn't working?**
1. Check browser console for errors
2. Verify Supabase permissions
3. Try dry run first: `cleanupAllTempFiles(24, true)`
4. Check RLS policies aren't blocking access

**Can't see temp files in dashboard?**
1. Refresh browser
2. Click "Scan Buckets" again
3. Check network tab for errors
4. Verify you're admin user

**Want to keep some temp files?**
1. Don't run cleanup (they'll stay)
2. Or adjust patterns to exclude them
3. Or increase maxAgeHours to 48+

---

Done! Your temp files are under control. 🎉
