import { createClient } from 'npm:@supabase/supabase-js@2.49.8'
import {
  ImageMagick,
  initializeImageMagick,
  MagickFormat,
} from 'npm:@imagemagick/magick-wasm@0.0.40'

const MB = 1024 * 1024
const MAX_UPLOAD_BYTES = 5 * MB
const PROFILE_MAX_EDGE = 1600
const PROFILE_IMAGE_QUALITY = 82
const OPTIMIZED_BUCKET = 'profile-images-optimized'
const PROJECT_MEDIA_BUCKET = 'project-media'
const PORTFOLIO_MEDIA_BUCKET = 'portfolio-media'
const SERVICE_MEDIA_BUCKET = 'service-media'
const SIGNED_URL_TTL_SECONDS = 60 * 60
const PROJECT_MEDIA_KINDS = new Set(['photo', 'plan', 'inspiration', 'document'])
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/heic',
  'image/heif',
  'image/bmp',
  'image/tiff',
])

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const wasmBytes = await Deno.readFile(
  new URL('magick.wasm', import.meta.resolve('npm:@imagemagick/magick-wasm@0.0.40')),
)
await initializeImageMagick(wasmBytes)

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function sanitizeTarget(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
}

function sanitizeKind(value: string) {
  const kind = sanitizeTarget(value || 'photo')
  return PROJECT_MEDIA_KINDS.has(kind) ? kind : 'photo'
}

function fileExtension(file: File) {
  const fromName = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '')
  return fromName || 'bin'
}

function isAllowedImage(file: File) {
  return ALLOWED_IMAGE_TYPES.has(file.type) || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'heic', 'heif', 'bmp', 'tif', 'tiff'].includes(fileExtension(file))
}

function decodeJwtPayload(token: string) {
  const payload = token.split('.')[1]
  if (!payload) return null
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=')
    return JSON.parse(atob(padded)) as { sub?: string; email?: string }
  } catch {
    return null
  }
}

async function sha256Hex(bytes: Uint8Array) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hashBuffer)).map((part) => part.toString(16).padStart(2, '0')).join('')
}

function constrainSize(width: number, height: number, maxEdge: number) {
  const largestEdge = Math.max(width, height)
  if (largestEdge <= maxEdge) return { width, height }
  const scale = maxEdge / largestEdge
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

function optimizeProfileImage(bytes: Uint8Array) {
  return ImageMagick.read(bytes, (image): Uint8Array => {
    const nextSize = constrainSize(image.width, image.height, PROFILE_MAX_EDGE)
    if (nextSize.width !== image.width || nextSize.height !== image.height) {
      image.resize(nextSize.width, nextSize.height)
    }
    image.quality = PROFILE_IMAGE_QUALITY
    return image.write(MagickFormat.WebP, (data) => data)
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Only POST is supported.' })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authorization = req.headers.get('Authorization') || ''

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse(500, { error: 'Missing Supabase environment variables.' })
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: authorization },
    },
  })
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey)

  const { data: authData } = await userClient.auth.getUser()
  const token = authorization.replace(/^Bearer\s+/i, '')
  const claims = authData?.user ? null : decodeJwtPayload(token)
  const user = authData?.user || (claims?.sub ? { id: claims.sub, email: claims.email || null } : null)

  if (!user) {
    return jsonResponse(401, { error: 'Authentication required.' })
  }

  const formData = await req.formData()
  const upload = formData.get('file')
  if (!(upload instanceof File)) {
    return jsonResponse(400, { error: 'Missing file.' })
  }

  if (!isAllowedImage(upload)) {
    return jsonResponse(415, { error: 'Unsupported image format.' })
  }

  if (upload.size <= 0) {
    return jsonResponse(400, { error: 'Empty file.' })
  }

  if (upload.size > MAX_UPLOAD_BYTES) {
    return jsonResponse(413, { error: 'Image is too large. Keep uploads under 5 MB after precompression.' })
  }

  const { data: accountRow } = await adminClient
    .from('accounts')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = accountRow?.role === 'admin'
  const purpose = sanitizeTarget(String(formData.get('purpose') || 'profile'))
  const isProjectUpload = purpose === 'project'
  const isPortfolioUpload = purpose === 'portfolio'
  const isServiceUpload = purpose === 'service'
  const requestedTarget = sanitizeTarget(String(formData.get('target') || ''))
  const target = isAdmin && !isProjectUpload ? (requestedTarget || user.id) : user.id
  const mediaKind = sanitizeKind(String(formData.get('kind') || 'photo'))
  const bytes = new Uint8Array(await upload.arrayBuffer())

  let optimized: Uint8Array
  try {
    optimized = optimizeProfileImage(bytes)
  } catch (error) {
    console.error('profile-media-upload optimize error', error)
    return jsonResponse(422, { error: 'Image processing failed.' })
  }

  const fingerprint = await sha256Hex(optimized)
  const bucket = isProjectUpload ? PROJECT_MEDIA_BUCKET : isPortfolioUpload ? PORTFOLIO_MEDIA_BUCKET : isServiceUpload ? SERVICE_MEDIA_BUCKET : OPTIMIZED_BUCKET
  const directory = isProjectUpload ? `projects/${target}` : isPortfolioUpload ? `portfolio/${target}` : isServiceUpload ? `services/${target}` : `profiles/${target}`
  const fileName = `${isProjectUpload || isPortfolioUpload || isServiceUpload ? mediaKind : 'avatar'}-${fingerprint}.webp`
  const storagePath = `${directory}/${fileName}`

  const { data: existingFiles, error: listError } = await adminClient.storage
    .from(bucket)
    .list(directory, { limit: 100, search: fileName })

  if (listError) {
    console.error('profile-media-upload list error', listError)
  }

  const publicUrl = isProjectUpload ? '' : adminClient.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl
  let signedUrl: string | null = null

  if (isProjectUpload) {
    const { data: signedData, error: signedError } = await adminClient.storage
      .from(bucket)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS)

    if (signedError) {
      console.error('profile-media-upload signed url error', signedError)
    }

    signedUrl = signedData?.signedUrl || null
  }

  if (existingFiles?.some((item) => item.name === fileName)) {
    return jsonResponse(200, {
      bucket,
      publicUrl,
      signedUrl,
      path: storagePath,
      fingerprint,
      reused: true,
      width: null,
      height: null,
    })
  }

  const { error: uploadError } = await adminClient.storage
    .from(bucket)
    .upload(storagePath, optimized, {
      contentType: 'image/webp',
      cacheControl: '31536000',
      upsert: false,
    })

  if (uploadError) {
    console.error('profile-media-upload storage error', uploadError)
    return jsonResponse(500, { error: 'Failed to store optimized image.' })
  }

  if (isProjectUpload && !signedUrl) {
    const { data: signedData, error: signedError } = await adminClient.storage
      .from(bucket)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS)

    if (signedError) {
      console.error('profile-media-upload signed url after upload error', signedError)
    }

    signedUrl = signedData?.signedUrl || null
  }

  return jsonResponse(200, {
    bucket,
    publicUrl,
    signedUrl,
    path: storagePath,
    fingerprint,
    reused: false,
    bytes: optimized.byteLength,
  })
})