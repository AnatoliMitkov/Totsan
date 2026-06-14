// supabase/functions/profile-media-upload/index.ts
// Edge Function for authenticated profile/project media uploads via multipart FormData

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const supabase = createClient(supabaseUrl, supabaseServiceKey)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const IMAGE_MAX_BYTES = 10 * 1024 * 1024
const DOCUMENT_MAX_BYTES = 20 * 1024 * 1024
const SUPPORTED_TYPES = new Map<string, { extension: string; maxBytes: number }>([
  ["image/jpeg", { extension: "jpg", maxBytes: IMAGE_MAX_BYTES }],
  ["image/png", { extension: "png", maxBytes: IMAGE_MAX_BYTES }],
  ["image/webp", { extension: "webp", maxBytes: IMAGE_MAX_BYTES }],
  ["application/pdf", { extension: "pdf", maxBytes: DOCUMENT_MAX_BYTES }],
  ["application/msword", { extension: "doc", maxBytes: DOCUMENT_MAX_BYTES }],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", { extension: "docx", maxBytes: DOCUMENT_MAX_BYTES }],
  ["application/vnd.ms-excel", { extension: "xls", maxBytes: DOCUMENT_MAX_BYTES }],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", { extension: "xlsx", maxBytes: DOCUMENT_MAX_BYTES }],
])

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  })
}

function sanitizeSegment(value: string, fallback: string) {
  const normalized = String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")

  return normalized || fallback
}

function inferExtension(fileName: string, contentType: string) {
  const supportedExtension = SUPPORTED_TYPES.get(contentType)?.extension
  if (supportedExtension) return supportedExtension

  const fileExtensionMatch = String(fileName || "").toLowerCase().match(/\.([a-z0-9]+)$/)
  if (fileExtensionMatch?.[1]) return fileExtensionMatch[1]
  return "bin"
}

serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders })
    }

    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405)
    }

    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized" }, 401)
    }

    const token = authHeader.replace("Bearer ", "")
    const { data: userData, error: authError } = await supabase.auth.getUser(token)
    if (authError || !userData.user) {
      return jsonResponse({ error: "Invalid token" }, 401)
    }

    const contentTypeHeader = req.headers.get("content-type") || ""
    if (!contentTypeHeader.includes("multipart/form-data")) {
      return jsonResponse({ error: "Expected multipart/form-data upload." }, 400)
    }

    const formData = await req.formData()
    const fileEntry = formData.get("file")
    if (!(fileEntry instanceof File)) {
      return jsonResponse({ error: "Missing file upload." }, 400)
    }

    const supportedType = SUPPORTED_TYPES.get(fileEntry.type)
    if (!supportedType) {
      return jsonResponse({ error: "Unsupported file type." }, 400)
    }

    if (fileEntry.size > supportedType.maxBytes) {
      return jsonResponse({
        error: fileEntry.type.startsWith("image/")
          ? "Image uploads are limited to 10 MB."
          : "Document uploads are limited to 20 MB.",
      }, 400)
    }

    const purpose = sanitizeSegment(String(formData.get("purpose") || "project"), "project")
    const projectId = sanitizeSegment(String(formData.get("projectId") || ""), "")
    const kind = sanitizeSegment(String(formData.get("kind") || "photo"), "photo")
    const target = sanitizeSegment(String(formData.get("target") || userData.user.id), sanitizeSegment(userData.user.id, "user"))

    const isProfileImagePurpose = purpose === "profile" || purpose === "banner"
    if (isProfileImagePurpose && !fileEntry.type.startsWith("image/")) {
      return jsonResponse({ error: "Profile uploads only support image files." }, 400)
    }

    const authenticatedUserSegment = sanitizeSegment(userData.user.id, "user")
    if (isProfileImagePurpose && target !== authenticatedUserSegment) {
      return jsonResponse({ error: "You can only upload profile media to your own folder." }, 403)
    }

    const extension = inferExtension(fileEntry.name, fileEntry.type)
    let bucket = "project-media"
    let filename = ""
    let path = ""
    let upsert = false

    if (isProfileImagePurpose) {
      bucket = "profile-images"
      filename = `main.${extension}`
      path = `${target}/${purpose}/${filename}`
      upsert = true
    } else {
      const timestamp = Date.now()
      const randomId = Math.random().toString(36).slice(2, 9)
      filename = `${timestamp}-${randomId}.${extension}`
      const pathSegments = purpose === "project"
        ? ["projects", target, projectId || "draft", kind]
        : [purpose, target]
      path = `${pathSegments.map((segment) => sanitizeSegment(segment, "upload")).join("/")}/${filename}`
    }

    const fileBuffer = await fileEntry.arrayBuffer()
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, fileBuffer, {
        contentType: fileEntry.type,
        cacheControl: "3600",
        upsert,
      })

    if (error) {
      return jsonResponse({ error: error.message }, 400)
    }

    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(data.path)

    return jsonResponse({
      bucket,
      path: data.path,
      filename,
      publicUrl: publicData?.publicUrl || "",
      size: fileEntry.size,
      type: fileEntry.type,
    })
  } catch (error) {
    console.error("Upload error:", error)
    return jsonResponse({ error: error instanceof Error ? error.message : "Upload failed." }, 500)
  }
})
