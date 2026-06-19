// src/components/admin/TempFileManager.jsx
// Manage and cleanup temporary files in Supabase buckets

import { useState } from 'react'
import { Trash2, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import {
  scanAllBucketsForTempFiles,
  cleanupAllTempFiles,
  getTempFileReport
} from '@/lib/temp-file-cleanup.js'

export default function TempFileManager() {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [dryRun, setDryRun] = useState(true)
  const [maxAgeHours, setMaxAgeHours] = useState(24)

  const handleScan = async () => {
    setLoading(true)
    try {
      const data = await getTempFileReport()
      setReport(data)
    } catch (error) {
      console.error('Scan failed:', error)
      alert('Failed to scan temp files: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCleanup = async () => {
    if (!window.confirm(`${dryRun ? '[DRY RUN] ' : ''}Delete ${report.summary.oldTempFilesNeedCleanup} temp files and recover ${report.summary.potentialSpaceToRecoverMB}MB?`)) {
      return
    }

    setLoading(true)
    try {
      const data = await cleanupAllTempFiles(maxAgeHours, dryRun)
      
      if (dryRun) {
        setReport({
          ...report,
          dryRunResults: data
        })
      } else {
        alert(`Cleaned up ${data.aggregated.totalDeleted} temp files, freed ${data.aggregated.totalFreedMB}MB`)
        await handleScan() // Refresh report
      }
    } catch (error) {
      console.error('Cleanup failed:', error)
      alert('Cleanup failed: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="h-display">Temporary Files Manager</h1>
        <p className="text-muted mt-2">Scan and cleanup incomplete uploads and temp files</p>
      </div>

      {/* Controls */}
      <div className="border border-line rounded-2xl p-6 bg-paper space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-muted block mb-2">Max Age (hours)</label>
            <input
              type="number"
              value={maxAgeHours}
              onChange={(e) => setMaxAgeHours(parseInt(e.target.value) || 24)}
              min="1"
              max="720"
              className="w-full px-4 py-2 rounded-xl border border-line focus:border-accent outline-none"
            />
            <p className="text-xs text-muted mt-1">Only delete files older than this</p>
          </div>

          <div>
            <label className="text-sm font-medium text-muted block mb-2">Mode</label>
            <select
              value={dryRun ? 'dry-run' : 'delete'}
              onChange={(e) => setDryRun(e.target.value === 'dry-run')}
              className="w-full px-4 py-2 rounded-xl border border-line focus:border-accent outline-none"
            >
              <option value="dry-run">Dry Run (preview only)</option>
              <option value="delete">Actually Delete</option>
            </select>
            <p className="text-xs text-muted mt-1">{dryRun ? '✓ Safe' : '⚠️ Will delete files'}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleScan}
            disabled={loading}
            className="btn btn-ghost flex-1"
          >
            {loading ? 'Scanning...' : 'Scan Buckets'}
          </button>
          <button
            onClick={handleCleanup}
            disabled={loading || !report || report.summary.oldTempFilesNeedCleanup === 0}
            className="btn btn-primary flex-1"
          >
            <Trash2 size={16} />
            {loading ? 'Processing...' : 'Cleanup'}
          </button>
        </div>
      </div>

      {/* Report */}
      {report && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid md:grid-cols-3 gap-4">
            <StatCard
              icon={Clock}
              title="Total Temp Files"
              value={report.summary.totalTempFiles}
              color="blue"
            />
            <StatCard
              icon={AlertCircle}
              title="Need Cleanup"
              value={report.summary.oldTempFilesNeedCleanup}
              color={report.summary.oldTempFilesNeedCleanup > 0 ? 'red' : 'green'}
            />
            <StatCard
              icon={Trash2}
              title="Space to Recover"
              value={`${report.summary.potentialSpaceToRecoverMB}MB`}
              color="orange"
            />
          </div>

          {/* By Bucket */}
          <div className="border border-line rounded-2xl p-6 bg-paper space-y-4">
            <h2 className="font-display text-lg">By Bucket</h2>
            {Object.entries(report.byBucket).map(([bucket, data]) => (
              <BucketRow key={bucket} bucket={bucket} data={data} />
            ))}
          </div>

          {/* Dry Run Results */}
          {report.dryRunResults && (
            <div className="border border-line rounded-2xl p-6 bg-green-50 space-y-4">
              <h2 className="font-display text-lg text-green-700">Dry Run Results</h2>
              <div className="text-sm text-green-700 space-y-2">
                <p>Would delete: {report.dryRunResults.aggregated.totalDeleted} files</p>
                <p>Would recover: {report.dryRunResults.aggregated.totalFreedMB}MB</p>
              </div>
              {Object.entries(report.dryRunResults.results).map(([bucket, result]) => (
                result.details && result.details.length > 0 && (
                  <div key={bucket}>
                    <h3 className="font-medium text-sm mb-2">{bucket}</h3>
                    <div className="space-y-1 text-xs">
                      {result.details.slice(0, 5).map((detail, idx) => (
                        <div key={idx} className="flex gap-2">
                          <span className="text-green-700">→</span>
                          <span>{detail.file} ({detail.age}, {detail.size}MB)</span>
                        </div>
                      ))}
                      {result.details.length > 5 && (
                        <p className="text-green-600">... and {result.details.length - 5} more</p>
                      )}
                    </div>
                  </div>
                )
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, title, value, color = 'blue' }) {
  const colors = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    red: 'text-red-600',
    orange: 'text-orange-600'
  }

  return (
    <div className="border border-line rounded-2xl p-4 bg-paper space-y-2">
      <Icon size={20} className={colors[color]} strokeWidth={1.5} />
      <p className="text-xs text-muted">{title}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  )
}

function BucketRow({ bucket, data }) {
  if (data.error) {
    return (
      <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-sm text-red-700">
        <strong>{bucket}:</strong> {data.error}
      </div>
    )
  }

  return (
    <div className="p-4 rounded-xl border border-line bg-soft space-y-2">
      <div className="flex justify-between items-center">
        <h3 className="font-medium">{bucket}</h3>
        <div className="text-right">
          <p className="text-sm font-bold">{data.stats.tempFiles} temp files</p>
          <p className="text-xs text-muted">{data.stats.totalTempSizeMB}MB total</p>
        </div>
      </div>

      {data.stats.oldTempFiles > 0 && (
        <div className="text-xs bg-red-50 text-red-700 p-2 rounded border border-red-200">
          {data.stats.oldTempFiles} need cleanup ({Math.round((data.stats.oldTempFiles / data.stats.tempFiles) * 100)}%)
        </div>
      )}

      {data.tempFiles && data.tempFiles.length > 0 && (
        <div className="text-xs space-y-1 mt-3 max-h-48 overflow-y-auto">
          {data.tempFiles.slice(0, 5).map((file, idx) => (
            <div key={idx} className="flex justify-between gap-2 p-1 rounded bg-paper">
              <span className="truncate">{file.name}</span>
              <span className="text-muted whitespace-nowrap">{file.readableAge}</span>
            </div>
          ))}
          {data.tempFiles.length > 5 && (
            <p className="text-muted">... and {data.tempFiles.length - 5} more</p>
          )}
        </div>
      )}
    </div>
  )
}
