import { supabase } from './supabase.js'

const PROJECT_CONTEXT_SOURCES = new Set(['start_brief', 'guided_project_brief'])

export function inquirySupportsProjectContext(inquiry) {
  return PROJECT_CONTEXT_SOURCES.has(String(inquiry?.source || '').trim())
}

export function getInquiryStatusLabel(status = '') {
  const value = String(status || '').trim()
  if (value === 'new') return 'Нова'
  if (value === 'seen') return 'Видяна'
  if (value === 'replied') return 'Отговорено'
  if (value === 'closed') return 'Приключена'
  return value || 'Получена'
}

export function getInquirySourceLabel(source = '') {
  const value = String(source || '').trim()
  if (value === 'pro_inquiry') return 'Директно запитване'
  if (value === 'start_brief') return 'Проектен бриф'
  if (value === 'guided_project_brief') return 'Guided brief'
  if (value === 'contact_form') return 'Контактна форма'
  if (value === 'product_inquiry') return 'Запитване за услуга'
  return value || 'Запитване'
}

export async function loadPartnerInquiries(targetSlug, partnerId) {
  if (!targetSlug && !partnerId) return []

  let query = supabase
    .from('inquiries')
    .select('*')

  if (partnerId && targetSlug) {
    query = query.or(`assigned_partner_id.eq.${partnerId},target_slug.eq.${targetSlug}`)
  } else if (partnerId) {
    query = query.eq('assigned_partner_id', partnerId)
  } else {
    query = query.eq('target_slug', targetSlug)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

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
