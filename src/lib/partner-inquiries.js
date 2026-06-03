import { supabase } from './supabase.js'

export async function loadPartnerInquiries(targetSlug) {
  if (!targetSlug) return []
  
  const { data, error } = await supabase
    .from('inquiries')
    .select('*')
    .eq('target_slug', targetSlug)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to load partner inquiries:', error)
    throw error
  }
  
  return data || []
}

export async function updatePartnerInquiryStatus(id, status) {
  if (!id || !status) return null

  const { data, error } = await supabase
    .from('inquiries')
    .update({ status })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Failed to update inquiry status:', error)
    throw error
  }

  return data
}

export async function loadInquiryProjects(clientIds) {
  if (!clientIds || clientIds.length === 0) return []

  const { data, error } = await supabase
    .from('client_projects')
    .select('*')
    .in('user_id', clientIds)

  if (error) {
    console.error('Failed to load inquiry projects:', error)
    return []
  }

  return data || []
}
