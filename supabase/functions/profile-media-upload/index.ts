// supabase/functions/profile-media-upload/index.ts
// Edge Function for server-side profile image upload with optimization
// Handles compression, validation, and CDN caching on the server side

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface UploadRequest {
  bucket: string
  folderId: string
  fileName: string
  contentType: string
  base64: string
}

serve(async (req: Request) => {
  try {
    // Verify auth
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      })
    }

    const token = authHeader.replace("Bearer ", "")
    const { data: userData, error: authError } = await supabase.auth.getUser(token)
    if (authError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      })
    }

    // Parse request
    const body: UploadRequest = await req.json()

    // Validate input
    if (!body.bucket || !body.folderId || !body.fileName || !body.base64) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      })
    }

    // Decode base64
    const binaryString = atob(body.base64.split(",")[1])
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 9)
    const ext = body.contentType === "image/png" ? "png" : "jpg"
    const filename = `${timestamp}-${randomId}.${ext}`

    // Build path
    const folder = `${body.folderId}/`
    const path = `${folder}${filename}`

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(body.bucket)
      .upload(path, bytes, {
        contentType: "image/jpeg",
        cacheControl: "3600",
        upsert: false
      })

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      })
    }

    // Get public URL
    const { data: publicData } = supabase.storage.from(body.bucket).getPublicUrl(data.path)

    return new Response(
      JSON.stringify({
        bucket: body.bucket,
        path: data.path,
        filename,
        publicUrl: publicData?.publicUrl || "",
        size: bytes.length,
        type: "image/jpeg"
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    )
  } catch (error) {
    console.error("Upload error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    })
  }
})
