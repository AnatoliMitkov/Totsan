import { avatarFor } from '../data/images.js'

function normalizeUrl(value) {
  return String(value || '').trim()
}

function preferStableCoverUrl(service) {
  const coverUrl = normalizeUrl(service?.coverUrl || service?.cover_url)
  if (!coverUrl) return ''

  try {
    const url = new URL(coverUrl)
    if (/^encrypted-tbn\d*\.gstatic\.com$/i.test(url.hostname)) {
      return ''
    }
  } catch {
    return coverUrl
  }

  return coverUrl
}

export function getPartnerServiceCoverCandidates(service, profile = null) {
  const mediaUrl = normalizeUrl(service?.media?.[0]?.url)
  const coverUrl = preferStableCoverUrl(service)
  const profileImage = normalizeUrl(profile?.imageUrl || profile?.image_url || service?.profile?.image_url)
  const avatar = avatarFor(profile?.name || service?.profile?.name || service?.title || 'Totsan')

  return [mediaUrl, coverUrl, profileImage, avatar].filter(Boolean)
}
