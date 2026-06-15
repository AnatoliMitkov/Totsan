import { supabase } from './supabase.js'
import { locationCountKey } from './locations.js'

const EMPTY_STATS = {
  publishedServices: 0,
  completedProjects: 0,
  verifiedSpecialists: 0,
  coveredCities: 0,
}

async function countCompletedOrders() {
  const { count, error } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'completed')

  if (error) {
    console.warn('Completed orders count unavailable:', error)
    return 0
  }

  return count || 0
}

export async function loadHomepageStats() {
  const [{ data: services, count: servicesCount, error: servicesError }, completedProjects] = await Promise.all([
    supabase
      .from('partner_services')
      .select('profile_id, delivery_areas, profile:profiles(city, is_published)', { count: 'exact' })
      .eq('is_published', true)
      .eq('moderation_status', 'approved'),
    countCompletedOrders(),
  ])

  if (servicesError) {
    console.warn('Homepage public service stats unavailable:', servicesError)
    return { ...EMPTY_STATS, completedProjects }
  }

  const publicServices = services || []
  const verifiedProfileIds = new Set()
  const coveredCityKeys = new Set()

  publicServices.forEach((service) => {
    if (service.profile_id && service.profile?.is_published !== false) {
      verifiedProfileIds.add(service.profile_id)
    }

    const areas = [
      service.profile?.city,
      ...(Array.isArray(service.delivery_areas) ? service.delivery_areas : []),
    ]

    areas.forEach((area) => {
      const key = locationCountKey(area)
      if (key) coveredCityKeys.add(key)
    })
  })

  return {
    publishedServices: servicesCount || publicServices.length,
    completedProjects,
    verifiedSpecialists: verifiedProfileIds.size,
    coveredCities: coveredCityKeys.size,
  }
}
