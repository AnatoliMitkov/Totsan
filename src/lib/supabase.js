import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabaseUrl = url || ''
export const supabasePublicKey = anonKey || ''

if (!url || !anonKey) {
  console.warn('[supabase] Липсват VITE_SUPABASE_URL и публичен Supabase key (VITE_SUPABASE_ANON_KEY или VITE_SUPABASE_PUBLISHABLE_KEY) в .env.local')
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

export const brand = {
  name: import.meta.env.VITE_BRAND_NAME || 'Totsan',
  tagline: import.meta.env.VITE_BRAND_TAGLINE || 'Reality Beyond Renders',
  email: import.meta.env.VITE_CONTACT_EMAIL || 'sales@totsan.com',
  phone: import.meta.env.VITE_CONTACT_PHONE || '+359 89 270 3058',
}
