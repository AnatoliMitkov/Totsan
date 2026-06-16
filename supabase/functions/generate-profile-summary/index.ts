import { createClient } from 'npm:@supabase/supabase-js@2.49.8'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || ''
const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-4.1-mini'
const PROFILE_SUMMARY_ADMIN_SECRET = Deno.env.get('PROFILE_SUMMARY_ADMIN_SECRET') || ''
const SUMMARY_VERSION = 'partner-fit-summary-v1'

const ALLOWED_TILE_LABELS = new Set(['Работи в', 'Подходящ за', 'Как започва', 'Оферта'])
const BLOCKED_PHRASES = [
  'наличност',
  'чат на живо',
  'практична помощ',
  'помага с',
  'проверен специалист',
]

const LAYER_GUIDANCE: Record<string, string> = {
  ideya: 'Layer 01 / Idea & Vision: use practical words such as концепция, разпределение, 3D визуализации, проект, материали.',
  postroyka: 'Layer 02 / Construction: use practical words such as ремонт, изпълнение, оглед, обхват, оферта, обект.',
  materiali: 'Layer 03 / Materials: use practical words such as избор на материали, продукти, мостри, ценови клас, доставка.',
  obzavezhdane: 'Layer 04 / Furnishing: use practical words such as изработка, доставка, монтаж, мебели по поръчка, размери.',
  dekoraciya: 'Layer 05 / Decoration: use practical words such as стайлинг, текстил, осветление, декорация, финални детайли.',
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function compactText(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function toTextArray(value: unknown, limit = 8) {
  if (Array.isArray(value)) {
    return value.map(item => compactText(item)).filter(Boolean).slice(0, limit)
  }
  return String(value || '')
    .split(/[,\n;/|]+/)
    .map(item => compactText(item))
    .filter(Boolean)
    .slice(0, limit)
}

function truncate(value: unknown, maxLength = 700) {
  const text = compactText(value)
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}

async function sha256(value: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(hash)).map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function safeJsonParse(value: string) {
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null
  } catch {
    return null
  }
}

function extractOutputText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === 'string') return payload.output_text

  const output = Array.isArray(payload.output) ? payload.output : []
  const chunks: string[] = []
  for (const item of output) {
    const content = Array.isArray((item as Record<string, unknown>)?.content)
      ? (item as Record<string, unknown>).content as Record<string, unknown>[]
      : []
    for (const part of content) {
      if (typeof part.text === 'string') chunks.push(part.text)
    }
  }
  return chunks.join('\n').trim()
}

function sanitizeSummary(raw: Record<string, unknown>, fallbackName: string) {
  const eyebrow = compactText(raw.eyebrow || 'Подходящ за') || 'Подходящ за'
  const heading = compactText(raw.heading || `Кога да изберете ${fallbackName}`) || `Кога да изберете ${fallbackName}`
  const summary = compactText(raw.summary)
  if (!summary || summary.length < 80) throw new Error('AI summary is too short.')
  if (summary.length > 700) throw new Error('AI summary is too long.')

  const lowerSummary = summary.toLocaleLowerCase('bg')
  const blocked = BLOCKED_PHRASES.find(phrase => lowerSummary.includes(phrase))
  if (blocked) throw new Error(`AI summary contains blocked wording: ${blocked}.`)

  const chips = toTextArray(raw.chips, 6)
  const tiles = (Array.isArray(raw.tiles) ? raw.tiles : [])
    .map((tile) => ({
      label: compactText((tile as Record<string, unknown>)?.label),
      value: compactText((tile as Record<string, unknown>)?.value),
    }))
    .filter(tile => ALLOWED_TILE_LABELS.has(tile.label) && tile.value)
    .slice(0, 4)

  if (tiles.length < 2) throw new Error('AI summary did not return enough useful tiles.')

  return {
    version: SUMMARY_VERSION,
    eyebrow,
    heading,
    summary,
    chips,
    tiles,
  }
}

async function writeGenerationError(adminClient: ReturnType<typeof createClient>, profileId: string, message: string) {
  const { error } = await adminClient
    .from('profiles')
    .update({
      ai_fit_summary_status: 'error',
      ai_fit_summary_error: message.slice(0, 500),
    })
    .eq('id', profileId)
  if (error) console.error('generate-profile-summary write error failed', error)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Only POST is supported.' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authorization = req.headers.get('Authorization') || ''
  const isInternalRequest = Boolean(
    PROFILE_SUMMARY_ADMIN_SECRET &&
    req.headers.get('x-profile-summary-secret') === PROFILE_SUMMARY_ADMIN_SECRET
  )

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse(500, { error: 'Missing Supabase environment variables.' })
  }

  if (!OPENAI_API_KEY) {
    return jsonResponse(503, { error: 'OPENAI_API_KEY is not configured.' })
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey)

  let user: { id: string } | null = null
  if (!isInternalRequest) {
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
    })
    const { data: authData } = await userClient.auth.getUser()
    user = authData?.user ? { id: authData.user.id } : null
    if (!user) return jsonResponse(401, { error: 'Authentication required.' })
  }

  let body: { profileId?: string; slug?: string; force?: boolean; dryRun?: boolean }
  try {
    body = await req.json()
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body.' })
  }

  const profileId = compactText(body.profileId)
  const slug = compactText(body.slug)
  if (!profileId && !slug) return jsonResponse(400, { error: 'profileId or slug is required.' })

  const profileQuery = adminClient
    .from('profiles')
    .select(`
      id,
      slug,
      user_id,
      layer_slug,
      name,
      tag,
      headline,
      bio,
      description_long,
      city,
      service_areas,
      years_experience,
      response_time_hours,
      accepts_remote,
      pricing_note,
      layer01_meta,
      ai_fit_summary,
      ai_fit_summary_status,
      ai_fit_summary_source_hash
    `)

  const { data: profile, error: profileError } = profileId
    ? await profileQuery.eq('id', profileId).maybeSingle()
    : await profileQuery.eq('slug', slug).maybeSingle()

  if (profileError) return jsonResponse(500, { error: profileError.message })
  if (!profile) return jsonResponse(404, { error: 'Profile not found.' })

  if (!isInternalRequest) {
    const { data: actorAccount } = await adminClient
      .from('accounts')
      .select('id, role')
      .eq('id', user!.id)
      .maybeSingle()

    const isOwner = profile.user_id === user!.id
    const isAdmin = actorAccount?.role === 'admin'
    if (!isOwner && !isAdmin) return jsonResponse(403, { error: 'You cannot refresh this profile summary.' })
  }

  try {
    const [{ data: services }, { data: portfolio }] = await Promise.all([
      adminClient
        .from('partner_services')
        .select('title, subtitle, description_md, tags, delivery_areas, is_published, moderation_status')
        .eq('profile_id', profile.id)
        .eq('is_published', true)
        .eq('moderation_status', 'approved')
        .order('updated_at', { ascending: false })
        .limit(8),
      adminClient
        .from('profile_portfolio')
        .select('title, description, city, budget_band, layer_slug, is_published')
        .eq('profile_id', profile.id)
        .eq('is_published', true)
        .order('updated_at', { ascending: false })
        .limit(6),
    ])

    const sourcePayload = {
      version: SUMMARY_VERSION,
      layer: {
        slug: profile.layer_slug || '',
        guidance: LAYER_GUIDANCE[profile.layer_slug || ''] || '',
      },
      profile: {
        name: truncate(profile.name, 120),
        tag: truncate(profile.tag, 140),
        headline: truncate(profile.headline, 180),
        bio: truncate(profile.bio, 700),
        descriptionLong: truncate(profile.description_long, 900),
        city: truncate(profile.city, 100),
        serviceAreas: toTextArray(profile.service_areas, 8),
        yearsExperience: profile.years_experience ?? null,
        responseTimeHours: profile.response_time_hours ?? null,
        acceptsRemote: Boolean(profile.accepts_remote),
        pricingNote: truncate(profile.pricing_note, 180),
        layer01Meta: profile.layer01_meta && typeof profile.layer01_meta === 'object' ? profile.layer01_meta : {},
      },
      services: (services || []).map((service) => ({
        title: truncate(service.title, 140),
        subtitle: truncate(service.subtitle, 180),
        description: truncate(service.description_md, 500),
        tags: toTextArray(service.tags, 8),
        deliveryAreas: toTextArray(service.delivery_areas, 8),
      })),
      portfolio: (portfolio || []).map((item) => ({
        title: truncate(item.title, 140),
        description: truncate(item.description, 350),
        city: truncate(item.city, 100),
        budgetBand: truncate(item.budget_band, 80),
        layerSlug: truncate(item.layer_slug, 80),
      })),
    }

    const sourceHash = await sha256(JSON.stringify(sourcePayload))
    if (!body.force && profile.ai_fit_summary_status === 'ready' && profile.ai_fit_summary_source_hash === sourceHash) {
      return jsonResponse(200, {
        ok: true,
        skipped: true,
        reason: 'Source has not changed.',
        summary: profile.ai_fit_summary || null,
      })
    }

    const fallbackName = compactText(profile.name) || 'този специалист'
    const prompt = [
      'Generate a Bulgarian client-facing fit summary for a public specialist profile in Totsan.',
      'Use only the provided JSON data. Do not invent certifications, guarantees, national coverage, prices, years of experience, response times, services, locations, or claims.',
      'Avoid marketing-heavy phrasing and avoid these Bulgarian phrases: "наличност", "чат на живо", "практична помощ", "помага с", "Проверен специалист".',
      'If the location is missing, omit the location tile. Do not use "България" as a fallback unless it is explicitly present in the source data.',
      'Keep the summary practical: what the partner does, suitable project/object types, where they work if known, how the client should start the inquiry, and what information to send.',
      'Return concise Bulgarian text. Heading should be "Кога да изберете {name}" or "Кога да изберете този специалист" if the name is missing.',
      LAYER_GUIDANCE[profile.layer_slug || ''] || '',
    ].filter(Boolean).join('\n')

    const openAiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: [
          {
            role: 'system',
            content: [{ type: 'input_text', text: prompt }],
          },
          {
            role: 'user',
            content: [{ type: 'input_text', text: JSON.stringify(sourcePayload) }],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'partner_fit_summary',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['eyebrow', 'heading', 'summary', 'chips', 'tiles'],
              properties: {
                eyebrow: { type: 'string' },
                heading: { type: 'string' },
                summary: { type: 'string' },
                chips: {
                  type: 'array',
                  maxItems: 6,
                  items: { type: 'string' },
                },
                tiles: {
                  type: 'array',
                  minItems: 2,
                  maxItems: 4,
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['label', 'value'],
                    properties: {
                      label: { type: 'string', enum: ['Работи в', 'Подходящ за', 'Как започва', 'Оферта'] },
                      value: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
        max_output_tokens: 900,
      }),
    })

    const openAiPayload = await openAiResponse.json()
    if (!openAiResponse.ok) {
      throw new Error(openAiPayload?.error?.message || 'OpenAI summary generation failed.')
    }

    const outputText = extractOutputText(openAiPayload)
    const parsed = safeJsonParse(outputText)
    if (!parsed) throw new Error('OpenAI returned invalid JSON.')

    const summary = sanitizeSummary(parsed, fallbackName)
    if (body.dryRun) {
      return jsonResponse(200, { ok: true, dryRun: true, sourceHash, summary })
    }

    const generatedAt = new Date().toISOString()
    const { error: updateError } = await adminClient
      .from('profiles')
      .update({
        ai_fit_summary: summary,
        ai_fit_summary_status: 'ready',
        ai_fit_summary_generated_at: generatedAt,
        ai_fit_summary_source_hash: sourceHash,
        ai_fit_summary_error: null,
      })
      .eq('id', profile.id)

    if (updateError) throw updateError

    return jsonResponse(200, {
      ok: true,
      profileId: profile.id,
      generatedAt,
      sourceHash,
      summary,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Summary generation failed.'
    await writeGenerationError(adminClient, profile.id, message)
    return jsonResponse(500, { error: message })
  }
})
