import { createClient } from '@supabase/supabase-js'

const supabase = createClient('https://uywibfxqqcypemtrvozp.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5d2liZnhxcWN5cGVtdHJ2b3pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MzU4OTgsImV4cCI6MjA5MzExMTg5OH0.jOgYd8QDUTonSBBuNux-MQUkkPsByJ4Fb_iwhUB1VmA')

async function run() {
  const { data, error } = await supabase.from('accounts').select('id, full_name, display_name, email, avatar_url')
  console.log('Accounts:', JSON.stringify(data, null, 2))
}

run()
