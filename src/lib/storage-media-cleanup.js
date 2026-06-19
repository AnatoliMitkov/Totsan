import { supabase, supabaseUrl } from './supabase.js'

const DEFAULT_MEDIA_BUCKET = 'profile-images'

function cleanText(value) {
  return String(value || '').trim()
}

function uniqueRefs(refs = []) {
  const seen = new Set()
  return refs.filter((ref) => {
    const bucket = cleanText(ref?.bucket) || DEFAULT_MEDIA_BUCKET
    const path = cleanText(ref?.path)
    if (!path) return false
    const key = `${bucket}:${path}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).map((ref) => ({
    bucket: cleanText(ref.bucket) || DEFAULT_MEDIA_BUCKET,
    path: cleanText(ref.path),
  }))
}

function storagePathFromPublicUrl(url = '', bucket = DEFAULT_MEDIA_BUCKET) {
  const value = cleanText(url)
  if (!value || !supabaseUrl) return ''

  const marker = `/storage/v1/object/public/${bucket}/`
  const markerIndex = value.indexOf(marker)
  if (markerIndex === -1) return ''

  const rawPath = value.slice(markerIndex + marker.length).split('?')[0]
  try {
    return decodeURIComponent(rawPath)
  } catch {
    return rawPath
  }
}

function expandDerivedImagePaths(ref) {
  const refs = [ref]
  const path = cleanText(ref.path)

  if (path.endsWith('/cover.jpg')) {
    refs.push({ ...ref, path: path.replace(/\/cover\.jpg$/, '/cover-thumb.jpg') })
    refs.push({ ...ref, path: path.replace(/\/cover\.jpg$/, '/image-001.jpg') })
  }

  return refs
}

export function mediaStorageRefs(media = [], fallbackBucket = DEFAULT_MEDIA_BUCKET) {
  const list = Array.isArray(media) ? media : []
  const refs = []

  list.forEach((item) => {
    if (!item || item.type === 'video' || item.provider === 'youtube' || item.kind === 'video') return

    const bucket = cleanText(item.bucket) || fallbackBucket
    const path = cleanText(item.path) || storagePathFromPublicUrl(item.url, bucket)
    if (path) refs.push(...expandDerivedImagePaths({ bucket, path }))
  })

  return uniqueRefs(refs)
}

export function mediaAndCoverStorageRefs(item = {}, fallbackBucket = DEFAULT_MEDIA_BUCKET) {
  const source = item || {}
  const refs = mediaStorageRefs(source.media, fallbackBucket)
  const coverBucket = fallbackBucket
  const coverPath = storagePathFromPublicUrl(source.coverUrl || source.cover_url, coverBucket)
  if (coverPath) refs.push(...expandDerivedImagePaths({ bucket: coverBucket, path: coverPath }))
  return uniqueRefs(refs)
}

export function diffStorageRefs(previousRefs = [], nextRefs = []) {
  const nextKeys = new Set(uniqueRefs(nextRefs).map(ref => `${ref.bucket}:${ref.path}`))
  return uniqueRefs(previousRefs).filter(ref => !nextKeys.has(`${ref.bucket}:${ref.path}`))
}

export async function deleteStorageRefs(refs = []) {
  const byBucket = new Map()
  uniqueRefs(refs).forEach((ref) => {
    const paths = byBucket.get(ref.bucket) || []
    paths.push(ref.path)
    byBucket.set(ref.bucket, paths)
  })

  for (const [bucket, paths] of byBucket.entries()) {
    if (!paths.length) continue
    const { error } = await supabase.storage.from(bucket).remove(paths)
    if (error) {
      console.warn(`[storage-cleanup] Could not delete ${paths.length} object(s) from ${bucket}:`, error.message || error)
    }
  }
}
