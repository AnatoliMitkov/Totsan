import { createClient } from '@supabase/supabase-js'

const token = "eyJhbGciOiJFUzI1NiIsImtpZCI6IjYyZmY1NDg0LTllZWQtNGFjMy05MGE3LWEwNDc2ZTU4NDc3MCIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3V5d2liZnhxcWN5cGVtdHJ2b3pwLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiIzZDQ5Nzc3Mi0xMzM4LTQwZTYtOWM4ZC02ZjA4NGUyNmM0M2UiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzgxODgwNzI1LCJpYXQiOjE3NTE4NzcxMjUsImVtYWlsIjoiYS5taXRrb3ZAdG90c2FuLmNvbSIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZGlzcGxheV9uYW1lIjoiVG90c2FuIERlc2lnbiIsImVtYWlsIjoiYS5taXRrb3ZAdG90c2FuLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJmdWxsX25hbWUiOiLQkNC90LDRgtC-0LvQuCDQnNC40YLQutC-0LIiLCJwaG9uZV92ZXJpZmllZCI6ZmFsc2UsInJlcXVpcmVfcGFzc2tleV92ZXJpZmljYXRpb24iOnRydWUsInJvbGUiOiJ1c2VyIiwic3ViIjoiM2Q0OTc3NzItMTMzOC00MGU2LTljOGQtNmYwODRlMjZjNDNlIn0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjE3ODE4NzM2MjV9XSwic2Vzc2lvbl9pZCI6ImJjMzNiNWIxLWZlOTgtNGMzMy1hNGQ3LWRkZmZkOGY4M2ExMyIsImlzX2Fub255bW91cyI6ZmFsc2V9.bAqJK92t2-cLC4Xo33GN5-xRYXXSPlevXoM8GZgNF-QTWJHEqS4AiB-57XYqu_WmLGntlkJPeLg0eZEXFrUvhw";

const supabase = createClient('https://uywibfxqqcypemtrvozp.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5d2liZnhxcWN5cGVtdHJ2b3pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MzU4OTgsImV4cCI6MjA5MzExMTg5OH0.jOgYd8QDUTonSBBuNux-MQUkkPsByJ4Fb_iwhUB1VmA', {
  global: {
    headers: {
      Authorization: `Bearer ${token}`
    }
  }
})

async function run() {
  const { data: audit, error: auditError } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(20)
  console.log('Audit Log:', audit, auditError)

  const { data: cleanup, error: cleanupError } = await supabase.from('image_cleanup_log').select('*').order('created_at', { ascending: false }).limit(20)
  console.log('Image Cleanup Log:', cleanup, cleanupError)
}

run()
