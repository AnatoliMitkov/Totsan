# Image Upload & Storage Optimization Guide

**Totsan V2 — Image Management System**

---

## Overview

Supabase Storage buckets are optimized for Totsan's image workflows. Images are automatically:
- ✅ Validated (format, size, dimensions)
- ✅ Compressed client-side (JPEG quality 80-85%)
- ✅ Resized to max dimensions (2000–4000px)
- ✅ Cached on CDN (3600s = 1 hour)
- ✅ Organized by user/project/service

---

## Storage Buckets (Public)

### 1. `profile-images`
**Purpose:** Partner profile avatars  
**Max Size:** 5MB  
**Max Dimensions:** 2000×2000px  
**Compression:** 85% JPEG quality  
**Path Structure:** `{userId}/avatar/{timestamp}-{random}.jpg`  
**Cache:** 1 hour  
**CDN:** ✅ Public (cached)

**Use Cases:**
- Partner profile picture
- Team member avatar
- Specialist headshot

---

### 2. `project-media`
**Purpose:** Client project photos, inspiration images, plans  
**Max Size:** 10MB  
**Max Dimensions:** 4000×4000px  
**Compression:** 80% JPEG quality  
**Path Structure:** `projects/{userId}/{timestamp}-{random}.jpg`  
**Cache:** 1 hour  
**CDN:** ✅ Public (only for shareable projects)

**Use Cases:**
- Before/after project photos
- Inspiration images
- Floor plans, sketches
- Progress documentation
- Client mood boards

---

### 3. `portfolio-media`
**Purpose:** Partner portfolio showcases  
**Max Size:** 8MB  
**Max Dimensions:** 3000×3000px  
**Compression:** 82% JPEG quality  
**Path Structure:** `{profileId}/portfolio/{timestamp}-{random}.jpg`  
**Cache:** 1 hour  
**CDN:** ✅ Public (all portfolio items)

**Use Cases:**
- Finished project photos
- Before/after transformations
- Portfolio item showcase

---

### 4. `service-media`
**Purpose:** Partner service showcase images  
**Max Size:** 8MB  
**Max Dimensions:** 3000×3000px  
**Compression:** 82% JPEG quality  
**Path Structure:** `{serviceId}/media/{timestamp}-{random}.jpg`  
**Cache:** 1 hour  
**CDN:** ✅ Public (published services only)

**Use Cases:**
- Service preview images
- Work samples for services
- Material/product showcases

---

## Using Images in Code

### 1. Upload Profile Image

```javascript
import { uploadImage, validateImageFile } from '@/lib/image-upload.js'

// In component
const [file, setFile] = useState(null)

const handleUpload = async () => {
  try {
    // Validate
    validateImageFile(file, 'profile-images')

    // Upload (auto-compresses)
    const result = await uploadImage(
      file,
      'profile-images',
      userId,
      { compress: true }
    )

    console.log(result)
    // {
    //   bucket: 'profile-images',
    //   path: '123e4567/avatar/1699123456-abc123.jpg',
    //   publicUrl: 'https://project.supabase.co/storage/v1/object/public/profile-images/...',
    //   size: 45000,
    //   type: 'image/jpeg'
    // }

    // Save URL to database
    await supabase.from('accounts').update({
      avatar_url: result.publicUrl
    }).eq('id', userId)
  } catch (error) {
    console.error(error.message)
  }
}
```

### 2. Use ImageUploader Component

```javascript
import ImageUploader from '@/components/ImageUploader.jsx'

export function ProfileSettings() {
  const handleImageUpload = (result) => {
    // Save to database
    supabase.from('accounts').update({
      avatar_url: result.publicUrl
    }).eq('id', userId)
  }

  return (
    <ImageUploader
      bucket="profile-images"
      folderId={userId}
      onUpload={handleImageUpload}
      onError={(err) => console.error(err)}
      maxFiles={1}
      showPreview={true}
    />
  )
}
```

### 3. Display Images with Optimization

```javascript
import { getImageUrl } from '@/lib/image-upload.js'

export function ProfileCard({ account }) {
  const imageUrl = getImageUrl(
    'profile-images',
    account.avatar_url,
    { width: 200, height: 200, quality: 85 }
  )

  return <img src={imageUrl} alt={account.display_name} />
}
```

### 4. Multiple File Upload

```javascript
<ImageUploader
  bucket="project-media"
  folderId={userId}
  onUpload={(result) => {
    // Save multiple images
    addProjectMedia(projectId, result)
  }}
  maxFiles={20}
  showPreview={true}
/>
```

---

## Client-Side Compression

### How It Works

1. **Validate** — Check format, size, dimensions
2. **Resize** — Scale down to max dimension (preserves aspect ratio)
3. **Compress** — Convert to JPEG at 80-85% quality
4. **Upload** — Send compressed file to Supabase

### Compression Ratios (Typical)

```
Original PNG (3000×3000, 8MB)
  ↓ resize to 3000×3000
  ↓ compress to JPEG 82%
Result: 800KB (90% reduction)

Original JPG (4000×4000, 6MB)
  ↓ resize to 3000×3000
  ↓ compress to JPEG 80%
Result: 450KB (92% reduction)
```

---

## Supabase RLS Policies

### Upload Rules

**Profile Images:**
```sql
-- Pros can upload their own avatar
create policy "pros can upload own profile image"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
```

**Project Media:**
```sql
-- Users can upload to their own project folder
create policy "users can upload project media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'project-media'
    and (storage.foldername(name))[1] = 'projects'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
```

**Public Read:**
```sql
-- Public can read profile & portfolio images
create policy "public can read profile images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id in ('profile-images', 'portfolio-media', 'service-media'));
```

---

## Best Practices

### ✅ Do

1. **Always validate before upload**
   ```javascript
   validateImageFile(file, bucket) // Throws on error
   ```

2. **Use the uploader component for consistency**
   ```javascript
   <ImageUploader bucket="project-media" folderId={userId} />
   ```

3. **Store the public URL in the database**
   ```sql
   UPDATE accounts SET avatar_url = 'https://...' WHERE id = '...'
   ```

4. **Compress before uploading**
   ```javascript
   uploadImage(file, bucket, folderId, { compress: true })
   ```

5. **Use appropriate bucket** — Don't mix portfolios with projects

### ❌ Don't

1. **Upload uncompressed large files** — Use `compress: true`
2. **Upload unsupported formats** — Validate first
3. **Store file paths instead of public URLs** — Always store `publicUrl`
4. **Upload without size checking** — Risk hitting storage quota
5. **Forget to delete old images** — Call `deleteImage()` when replacing

---

## Deleting Images

### Single Image

```javascript
import { deleteImage } from '@/lib/image-upload.js'

await deleteImage('profile-images', 'path/to/image.jpg')
```

### Multiple Images

```javascript
import { deleteImages } from '@/lib/image-upload.js'

await deleteImages('project-media', [
  'projects/user-1/image1.jpg',
  'projects/user-1/image2.jpg',
  'projects/user-1/image3.jpg'
])
```

### When Updating Profile Picture

```javascript
async function updateProfileImage(userId, newFile, oldImagePath) {
  // Delete old
  if (oldImagePath) {
    await deleteImage('profile-images', oldImagePath)
  }

  // Upload new
  const result = await uploadImage(newFile, 'profile-images', userId)

  // Save to DB
  await supabase.from('accounts').update({
    avatar_url: result.publicUrl
  }).eq('id', userId)
}
```

---

## CDN & Caching

### Cache Headers

All images are cached for **3600 seconds (1 hour)** by Supabase CDN:

```
Cache-Control: public, max-age=3600
```

### Busting Cache

If you need to force refresh (e.g., after editing):

```javascript
// Add timestamp query param
const url = imageUrl + `?t=${Date.now()}`
// https://project.supabase.co/.../image.jpg?t=1699123456
```

---

## Storage Quotas

**Free Tier:** 1GB  
**Pro Tier:** 100GB  

### Estimate Usage

- Profile image: ~50KB
- Project photo: ~200KB
- Portfolio item: ~300KB
- Service image: ~150KB

**Example:** 1000 users × 50KB = 50MB (only 5% of free tier)

---

## Troubleshooting

### "File too large"
- Image exceeds bucket size limit
- Compress locally first or use `uploadImage()` which auto-compresses

### "Invalid image format"
- Only JPEG, PNG, WebP supported
- Convert other formats before uploading

### "Upload failed: RLS violation"
- User trying to upload to wrong path (e.g., another user's folder)
- Check path: should be `{userId}/...` for profile images

### Images not appearing
- Stored path but not public URL → Check you saved `publicUrl`
- Image is private but need public access → Make bucket public in Supabase settings

### Slow uploads
- File still large after compression → Check file size before/after
- Network issue → Retry upload
- Server issue → Check Supabase status page

---

## API Reference

### `uploadImage(file, bucket, folderId, options)`

**Parameters:**
- `file` (File) — Image file from input
- `bucket` (string) — 'profile-images' | 'project-media' | 'portfolio-media' | 'service-media'
- `folderId` (string) — User ID, project ID, or service ID
- `options` (object) — `{ compress: true/false }` (default: true)

**Returns:**
```javascript
{
  bucket: string,
  path: string,           // Storage path
  filename: string,       // Generated filename
  publicUrl: string,      // Full CDN URL
  size: number,           // File size in bytes
  type: string            // MIME type
}
```

### `validateImageFile(file, bucket)`

**Throws** if file is invalid.

### `compressImage(file, bucket)`

**Returns:**
```javascript
{
  file: File,             // Compressed file
  originalSize: number,   // Before compression
  compressedSize: number, // After compression
  ratio: number,          // % reduction
  width: number,
  height: number
}
```

### `deleteImage(bucket, path)`

Deletes single image from storage.

### `deleteImages(bucket, paths)`

Deletes multiple images from storage.

### `getImageUrl(bucket, path, options)`

**Options:**
- `width` (number) — Resize width
- `height` (number) — Resize height
- `quality` (number) — 1-100

---

## Examples

### Example 1: Profile Avatar Update

```javascript
function ProfileAvatarForm({ user }) {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)

  const handleUpload = async () => {
    if (!file) return

    setUploading(true)
    try {
      const result = await uploadImage(file, 'profile-images', user.id)

      // Delete old if exists
      if (user.avatar_url) {
        const oldPath = user.avatar_url.split('/').pop()
        await deleteImage('profile-images', `${user.id}/avatar/${oldPath}`)
      }

      // Update account
      await supabase.from('accounts').update({
        avatar_url: result.publicUrl
      }).eq('id', user.id)

      setFile(null)
      alert('Profile updated!')
    } catch (err) {
      alert(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <input
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files?.[0])}
      />
      <button
        onClick={handleUpload}
        disabled={!file || uploading}
      >
        {uploading ? 'Uploading...' : 'Update Avatar'}
      </button>
    </div>
  )
}
```

### Example 2: Project Photo Gallery

```javascript
function ProjectPhotos({ projectId, userId }) {
  const [photos, setPhotos] = useState([])

  const handlePhotosUpload = (result) => {
    // Add to gallery
    supabase.from('client_project_media').insert({
      project_id: projectId,
      user_id: userId,
      bucket: 'project-media',
      path: result.path,
      public_url: result.publicUrl,
      kind: 'photo'
    })

    // Update UI
    setPhotos([...photos, result])
  }

  return (
    <div>
      <ImageUploader
        bucket="project-media"
        folderId={userId}
        onUpload={handlePhotosUpload}
        maxFiles={20}
      />
      <div className="grid grid-cols-3 gap-4">
        {photos.map((p) => (
          <img key={p.path} src={p.publicUrl} alt="Project photo" />
        ))}
      </div>
    </div>
  )
}
```

---

## Migration & Optimization

### Bulk Migrate to Optimized Bucket

```javascript
import { migrateImageBucket } from '@/lib/image-upload.js'

// Move all images from profile-images to profile-images-optimized
const imagePath = '123e4567/avatar/old-image.jpg'
const newUrl = await migrateImageBucket(
  imagePath,
  'profile-images',
  'profile-images-optimized'
)
```

---

Done! Your images now upload optimized and cached everywhere automatically.
