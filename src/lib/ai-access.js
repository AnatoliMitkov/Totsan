// src/lib/ai-access.js
// AI Agents can use this with service role key for full Supabase access
// No RLS restrictions apply

import { createClient } from '@supabase/supabase-js'

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const url = process.env.SUPABASE_API_URL || import.meta.env.VITE_SUPABASE_URL

export const supabaseAdmin = (serviceKey && url)
  ? createClient(url, serviceKey, {
      auth: { persistSession: false },
      global: {
        headers: {
          'User-Agent': 'Totsan-AI-Agent/1.0'
        }
      }
    })
  : null

// Verify admin access is available
if (!supabaseAdmin) {
  console.warn('[ai-access] Service role key not configured. AI agents cannot access full DB.')
}

// ============================================================================
// HELPERS FOR AI AGENTS
// ============================================================================

export async function ensureAdminUser(email) {
  if (!supabaseAdmin) throw new Error('Admin access not available')
  
  const { data, error } = await supabaseAdmin
    .from('accounts')
    .update({ role: 'admin' })
    .eq('email', email)
    .select()
  
  if (error) throw new Error(`Failed to promote admin: ${error.message}`)
  return data?.[0] || null
}

export async function syncAllProfiles() {
  if (!supabaseAdmin) throw new Error('Admin access not available')
  
  // Get all auth users without an accounts row
  const { data: users, error: usersError } = await supabaseAdmin
    .from('auth.users')
    .select('id, email, raw_user_meta_data')
  
  if (usersError) throw new Error(`Failed to fetch users: ${usersError.message}`)
  
  // Create missing accounts
  const { data: created, error: createError } = await supabaseAdmin
    .from('accounts')
    .upsert(
      (users || []).map(u => ({
        id: u.id,
        email: u.email,
        full_name: u.raw_user_meta_data?.full_name || u.raw_user_meta_data?.name,
        display_name: u.raw_user_meta_data?.display_name || u.raw_user_meta_data?.name || u.email.split('@')[0],
        role: 'user'
      })),
      { onConflict: 'id' }
    )
    .select()
  
  if (createError) throw new Error(`Failed to sync accounts: ${createError.message}`)
  return { synced: created?.length || 0, total: users?.length || 0 }
}

export async function getFullDatabaseSchema() {
  if (!supabaseAdmin) throw new Error('Admin access not available')
  
  // Get all tables and their columns
  const { data, error } = await supabaseAdmin
    .rpc('get_schema_info') // Requires custom RPC
    .catch(() => null)
  
  if (!data) {
    return {
      note: 'Full schema available via schema.sql in ./supabase/',
      tables: [
        'accounts', 'profiles', 'inquiries', 'partner_applications',
        'partner_services', 'partner_service_packages', 'partner_service_faq',
        'orders', 'order_events', 'payment_transactions',
        'conversations', 'messages', 'offers',
        'client_projects', 'client_project_media',
        'reviews', 'review_reports',
        'audit_log', 'subscribers',
        'profile_portfolio', 'app_private_secrets'
      ]
    }
  }
  
  return data
}

export async function getAdminDashboardStats() {
  if (!supabaseAdmin) throw new Error('Admin access not available')
  
  const { data, error } = await supabaseAdmin
    .from('vw_admin_dashboard')
    .select('*')
    .single()
  
  if (error) throw new Error(`Failed to fetch dashboard: ${error.message}`)
  return data
}

export async function getAccountByEmail(email) {
  if (!supabaseAdmin) throw new Error('Admin access not available')
  
  const { data, error } = await supabaseAdmin
    .from('accounts')
    .select('*')
    .eq('email', email)
    .single()
  
  if (error) throw new Error(`Account not found: ${error.message}`)
  return data
}

export async function getProfilesByUserId(userId) {
  if (!supabaseAdmin) throw new Error('Admin access not available')
  
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
  
  if (error) throw new Error(`Failed to fetch profiles: ${error.message}`)
  return data || []
}

export async function updateAccountStatus(email, status, note = '') {
  if (!supabaseAdmin) throw new Error('Admin access not available')
  if (!['active', 'banned'].includes(status)) throw new Error('Invalid status')
  
  const { data, error } = await supabaseAdmin
    .from('accounts')
    .update({
      account_status: status,
      admin_note: note,
      last_admin_action_at: new Date().toISOString()
    })
    .eq('email', email)
    .select()
  
  if (error) throw new Error(`Failed to update account: ${error.message}`)
  return data?.[0] || null
}

export async function getPendingApplications() {
  if (!supabaseAdmin) throw new Error('Admin access not available')
  
  const { data, error } = await supabaseAdmin
    .from('partner_applications')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  
  if (error) throw new Error(`Failed to fetch applications: ${error.message}`)
  return data || []
}

export async function getInquiriesByStatus(status) {
  if (!supabaseAdmin) throw new Error('Admin access not available')
  
  const { data, error } = await supabaseAdmin
    .from('inquiries')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })
  
  if (error) throw new Error(`Failed to fetch inquiries: ${error.message}`)
  return data || []
}

export async function getAuditLog(limit = 50) {
  if (!supabaseAdmin) throw new Error('Admin access not available')
  
  const { data, error } = await supabaseAdmin
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  
  if (error) throw new Error(`Failed to fetch audit log: ${error.message}`)
  return data || []
}

export async function compareProjectWithDatabase(projectSchema) {
  if (!supabaseAdmin) throw new Error('Admin access not available')
  
  // Compare local project schema with DB
  // Returns mismatches, missing tables, extra columns
  return {
    status: 'To be implemented',
    hint: 'Run validation queries in SUPABASE_SYNC_REPORT.md'
  }
}
