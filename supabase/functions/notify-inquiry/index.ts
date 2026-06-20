import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { buildInquiryEmail } from '../_shared/totsan-email.js'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { record } = await req.json()

    if (!record || !record.name || !record.message) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const htmlContent = buildInquiryEmail(record)

    if (!RESEND_API_KEY) {
      console.warn('RESEND_API_KEY is not set. Simulating email send.')
      console.log('Simulated Email:', htmlContent)
      return new Response(JSON.stringify({ success: true, simulated: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Totsan Inquiries <onboarding@resend.dev>', // Update this when domain is verified
        to: 'a.mitkov@totsan.com',
        subject: `Ново запитване от ${record.name}`,
        html: htmlContent,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      throw new Error(`Resend Error: ${JSON.stringify(data)}`)
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Error in notify-inquiry:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
