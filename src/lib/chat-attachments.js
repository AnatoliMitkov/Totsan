import { supabase } from './supabase.js'

export const CHAT_ATTACHMENTS_BUCKET = 'chat-attachments'
export const MAX_CHAT_ATTACHMENTS = 10
export const MAX_CHAT_ATTACHMENT_BYTES = 10 * 1024 * 1024
export const CHAT_IMAGE_MAX_EDGE = 2200
export const CHAT_IMAGE_QUALITY = 0.84

const ALLOWED_CHAT_ATTACHMENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'audio/aac',
  'audio/m4a',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
])

const OPTIMIZABLE_CHAT_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

const EXTENSION_BY_TYPE = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'audio/aac': 'aac',
  'audio/m4a': 'm4a',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/webm': 'webm',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/zip': 'zip',
}

export function isImageAttachment(attachment) {
  return String(attachment?.type || '').startsWith('image/')
}

export function isAudioAttachment(attachment) {
  return String(attachment?.type || '').startsWith('audio/')
}

export function isDeletedAttachment(attachment) {
  return Boolean(attachment?.deleted_at || attachment?.retention?.deleted)
}

export function formatAttachmentSize(bytes = 0) {
  const value = Number(bytes) || 0
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  return `${(value / 1024 / 1024).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`
}

export function validateChatAttachmentFile(file) {
  if (!(file instanceof File)) throw new Error('Invalid file.')
  if (!ALLOWED_CHAT_ATTACHMENT_TYPES.has(file.type)) {
    throw new Error('This file type is not supported in chat yet.')
  }
  if (file.size > MAX_CHAT_ATTACHMENT_BYTES) {
    throw new Error(`File is too large. Max size is ${formatAttachmentSize(MAX_CHAT_ATTACHMENT_BYTES)}.`)
  }
  return true
}

export function normalizeAttachmentFiles(files) {
  const fileList = Array.from(files || []).filter(Boolean)
  if (fileList.length > MAX_CHAT_ATTACHMENTS) {
    throw new Error(`You can attach up to ${MAX_CHAT_ATTACHMENTS} files at once.`)
  }
  fileList.forEach(validateChatAttachmentFile)
  return fileList
}

function safeName(value = '') {
  const fallback = 'file'
  const cleaned = String(value || fallback)
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
  return cleaned || fallback
}

function extensionFor(file) {
  const fromType = EXTENSION_BY_TYPE[file.type]
  if (fromType) return fromType
  const match = String(file.name || '').match(/\.([a-z0-9]{1,8})$/i)
  return match ? match[1].toLowerCase() : 'bin'
}

function replaceExtension(fileName, nextExtension) {
  const baseName = String(fileName || 'image').replace(/\.[^.]+$/, '') || 'image'
  return `${baseName}.${nextExtension}`
}

function getVoiceFileMeta(file) {
  const meta = file?.__chatVoiceMeta || {}
  const duration = Number(meta.duration || 0)
  const waveform = Array.isArray(meta.waveform)
    ? meta.waveform.map(Number).filter(Number.isFinite).map((level) => Math.max(0.04, Math.min(1, level))).slice(0, 80)
    : []

  return {
    duration: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null,
    waveform: waveform.length >= 8 ? waveform : null,
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

  if (typeof document === 'undefined') {
    throw new Error('Image optimization is not available in this browser.')
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await new Promise((resolve, reject) => {
      const nextImage = new Image()
      nextImage.onload = () => resolve(nextImage)
      nextImage.onerror = () => reject(new Error('Image cannot be loaded for optimization.'))
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

async function prepareChatAttachmentFile(file) {
  if (!OPTIMIZABLE_CHAT_IMAGE_TYPES.has(file.type) || typeof document === 'undefined') {
    return {
      file,
      optimized: false,
      originalSize: file.size,
      originalType: file.type,
      originalName: file.name,
    }
  }

  try {
    const source = await loadRasterSource(file)
    try {
      const nextSize = constrainSize(source.width, source.height, CHAT_IMAGE_MAX_EDGE)
      const canvas = document.createElement('canvas')
      canvas.width = nextSize.width
      canvas.height = nextSize.height
      const context = canvas.getContext('2d')
      if (!context) {
        return {
          file,
          optimized: false,
          originalSize: file.size,
          originalType: file.type,
          originalName: file.name,
          width: source.width,
          height: source.height,
        }
      }

      source.draw(context, nextSize.width, nextSize.height)
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', CHAT_IMAGE_QUALITY))
      if (!blob || blob.size >= file.size) {
        return {
          file,
          optimized: false,
          originalSize: file.size,
          originalType: file.type,
          originalName: file.name,
          width: source.width,
          height: source.height,
        }
      }

      return {
        file: new File([blob], replaceExtension(file.name, 'webp'), { type: 'image/webp' }),
        optimized: true,
        originalSize: file.size,
        originalType: file.type,
        originalName: file.name,
        width: nextSize.width,
        height: nextSize.height,
      }
    } finally {
      source.cleanup()
    }
  } catch {
    return {
      file,
      optimized: false,
      originalSize: file.size,
      originalType: file.type,
      originalName: file.name,
    }
  }
}

function attachmentPath({ conversationId, userId, file }) {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const extension = extensionFor(file)
  return `conversations/${conversationId}/${userId}/${id}-${safeName(file.name).replace(/\.[^.]+$/, '')}.${extension}`
}

export async function uploadChatAttachments({ conversationId, userId, files }) {
  if (!conversationId || !userId) throw new Error('Missing chat upload context.')
  const fileList = normalizeAttachmentFiles(files)
  const uploads = []

  for (const file of fileList) {
    const prepared = await prepareChatAttachmentFile(file)
    const uploadFile = prepared.file
    const voiceMeta = isAudioAttachment({ type: uploadFile.type }) ? getVoiceFileMeta(file) : { duration: null, waveform: null }
    const path = attachmentPath({ conversationId, userId, file: uploadFile })
    const { data, error } = await supabase.storage
      .from(CHAT_ATTACHMENTS_BUCKET)
      .upload(path, uploadFile, {
        cacheControl: '3600',
        contentType: uploadFile.type,
        upsert: false,
      })

    if (error) throw new Error(`Upload failed: ${error.message}`)

    uploads.push({
      bucket: CHAT_ATTACHMENTS_BUCKET,
      path: data.path,
      name: file.name,
      size: uploadFile.size,
      type: uploadFile.type,
      kind: isImageAttachment({ type: uploadFile.type }) ? 'image' : (isAudioAttachment({ type: uploadFile.type }) ? 'audio' : 'file'),
      original_name: prepared.originalName,
      original_size: prepared.originalSize,
      original_type: prepared.originalType,
      optimized: prepared.optimized,
      width: prepared.width || null,
      height: prepared.height || null,
      duration: voiceMeta.duration,
      waveform: voiceMeta.waveform,
    })
  }

  return uploads
}

export async function createChatAttachmentSignedUrl(attachment, expiresIn = 60 * 10) {
  if (!attachment?.path) return ''
  const bucket = attachment.bucket || CHAT_ATTACHMENTS_BUCKET
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(attachment.path, expiresIn)
  if (error) return ''
  return data?.signedUrl || ''
}
