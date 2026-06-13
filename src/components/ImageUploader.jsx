// src/components/ImageUploader.jsx
// Reusable image upload component with compression, validation, and preview

import { useState } from 'react'
import { Upload, X, CheckCircle2, AlertCircle } from 'lucide-react'
import { uploadImage, validateImageFile } from '../lib/image-upload.js'

export default function ImageUploader({
  bucket,
  folderId,
  onUpload,
  onError,
  maxFiles = 1,
  showPreview = true,
  disabled = false,
  className = ''
}) {
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files || [])
    setError(null)

    // Validate each file
    for (const file of selected) {
      try {
        validateImageFile(file, bucket)
      } catch (err) {
        setError(err.message)
        return
      }
    }

    // Limit number of files
    if (files.length + selected.length > maxFiles) {
      setError(`Max ${maxFiles} file(s) allowed`)
      return
    }

    setFiles([...files, ...selected])
  }

  const handleRemoveFile = (index) => {
    setFiles(files.filter((_, i) => i !== index))
    setError(null)
  }

  const handleUpload = async () => {
    if (!files.length) {
      setError('No files selected')
      return
    }

    setUploading(true)
    setError(null)

    try {
      for (const file of files) {
        const result = await uploadImage(file, bucket, folderId)
        onUpload?.(result)
      }
      setFiles([])
    } catch (err) {
      const errorMsg = err.message || 'Upload failed'
      setError(errorMsg)
      onError?.(errorMsg)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload Area */}
      <label
        className={`
          border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer
          transition-all
          ${disabled || uploading ? 'opacity-50 cursor-not-allowed' : 'hover:border-accent'}
          ${error ? 'border-red-300 bg-red-50' : 'border-line'}
        `}
      >
        <input
          type="file"
          multiple={maxFiles > 1}
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          disabled={disabled || uploading}
          className="hidden"
        />
        <div className="flex flex-col items-center gap-2">
          <Upload size={32} className="text-muted" strokeWidth={1.5} />
          <p className="text-sm font-medium">Click to upload or drag and drop</p>
          <p className="text-xs text-muted">PNG, JPG, WebP — up to 10MB</p>
        </div>
      </label>

      {/* File List with Preview */}
      {files.length > 0 && (
        <div className="space-y-3">
          {files.map((file, idx) => (
            <FilePreview
              key={idx}
              file={file}
              onRemove={() => handleRemoveFile(idx)}
              showPreview={showPreview}
            />
          ))}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Upload Button */}
      {files.length > 0 && (
        <button
          onClick={handleUpload}
          disabled={uploading || disabled}
          className="w-full btn btn-primary disabled:opacity-50"
        >
          {uploading ? 'Uploading...' : `Upload ${files.length} file${files.length > 1 ? 's' : ''}`}
        </button>
      )}
    </div>
  )
}

function FilePreview({ file, onRemove, showPreview }) {
  const [preview, setPreview] = useState(null)

  if (showPreview) {
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target.result)
    reader.readAsDataURL(file)
  }

  const sizeKB = Math.round(file.size / 1024)

  return (
    <div className="flex gap-3 items-center p-3 rounded-xl border border-line bg-paper">
      {preview && (
        <img
          src={preview}
          alt={file.name}
          className="w-12 h-12 rounded-lg object-cover"
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{file.name}</p>
        <p className="text-xs text-muted">{sizeKB} KB</p>
      </div>
      <button
        onClick={onRemove}
        className="p-1 text-muted hover:text-ink hover:bg-soft rounded transition-all"
      >
        <X size={16} />
      </button>
    </div>
  )
}
