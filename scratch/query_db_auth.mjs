import { createClient } from '@supabase/supabase-js'

const supabase = createClient('https://uywibfxqqcypemtrvozp.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5d2liZnhxcWN5cGVtdHJ2b3pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MzU4OTgsImV4cCI6MjA5MzExMTg5OH0.jOgYd8QDUTonSBBuNux-MQUkkPsByJ4Fb_iwhUB1VmA')

async function run() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'anatolimitkov22@gmail.com', // wait, do I know his email? Or I can use service_role?
    password: 'password123'
  })
  if (authError) {
    console.log('Auth error:', authError.message)
    // Try service role key instead to just see if the data exists.
  }
}
run()
