import { createClient } from '@supabase/supabase-js'

const supabase = createClient('https://uywibfxqqcypemtrvozp.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5d2liZnhxcWN5cGVtdHJ2b3pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MzU4OTgsImV4cCI6MjA5MzExMTg5OH0.jOgYd8QDUTonSBBuNux-MQUkkPsByJ4Fb_iwhUB1VmA')

async function run() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'anatolimitkov22@gmail.com',
    password: 'password123'
  })
  if (authError) {
    console.log('Auth error:', authError.message)
    return
  }
  console.log('Logged in as:', authData.user.email)
  
  // check accounts
  const { data: accounts, error: accError } = await supabase.from('accounts').select('*')
  console.log('My Account:', accounts)

  // check services
  const { data: services, error: serError } = await supabase.from('partner_services').select('*')
  console.log('Services:', services)
}
run()
