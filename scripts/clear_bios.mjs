import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const envStr = fs.readFileSync('.env.local', 'utf8')
const env = envStr.split('\n').reduce((acc, line) => {
  const [k, ...vParts] = line.split('=')
  if (k && vParts.length > 0) {
    acc[k.trim()] = vParts.join('=').trim()
  }
  return acc
}, {})

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY)

async function run() {
  const { data, error } = await supabase.from('profiles').select('id, name, bio, description_long')
  if (error) {
    console.error('Error fetching profiles', error)
    return
  }
  console.log(`Found ${data.length} profiles.`)
  let count = 0
  for (const p of data) {
    if (p.bio?.includes('реализирани проекта') || p.bio?.includes('работи в') || p.description_long?.includes('реализирани проекта')) {
      await supabase.from('profiles').update({ bio: null, description_long: null }).eq('id', p.id)
      console.log(`Cleared for ${p.name}`)
      count++
    }
  }
  console.log(`Updated ${count} profiles.`)
}

run()
