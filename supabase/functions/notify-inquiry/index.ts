import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

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

    const htmlContent = `
      <h2>Ново запитване от: ${record.name}</h2>
      <p><strong>Контакт:</strong> ${record.contact}</p>
      <p><strong>Източник:</strong> ${record.source}</p>
      ${record.layer_slug ? `<p><strong>Слой:</strong> ${record.layer_slug}</p>` : ''}
      ${record.target_slug ? `<p><strong>Насочено към:</strong> ${record.target_slug}</p>` : ''}
      <hr />
      <h3>Съобщение:</h3>
      <p style="white-space: pre-wrap;">${record.message}</p>
    `

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
