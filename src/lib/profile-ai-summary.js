import { supabase } from './supabase.js'

export function hasUsableAiFitSummary(summary) {
  return Boolean(summary && typeof summary === 'object' && !Array.isArray(summary) && String(summary.summary || '').trim())
}

export function normalizeAiFitSummary(summary) {
  if (!hasUsableAiFitSummary(summary)) return null

  const chips = Array.isArray(summary.chips)
    ? summary.chips.map(item => String(item || '').trim()).filter(Boolean).slice(0, 6)
    : []
  const tiles = Array.isArray(summary.tiles)
    ? summary.tiles
      .map((tile) => ({
        label: String(tile?.label || '').trim(),
        value: String(tile?.value || '').trim(),
      }))
      .filter(tile => tile.label && tile.value)
      .slice(0, 4)
    : []

  return {
    eyebrow: String(summary.eyebrow || 'Подходящ за').trim(),
    heading: String(summary.heading || '').trim(),
    summary: String(summary.summary || '').trim(),
    chips,
    tiles,
  }
}

export async function refreshProfileAiSummary(profileId, options = {}) {
  if (!profileId) return null

  const { data, error } = await supabase.functions.invoke('generate-profile-summary', {
    body: {
      profileId,
      force: Boolean(options.force),
    },
  })

  if (error) throw error
  return data || null
}
