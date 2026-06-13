// src/lib/image-storage-schema.js
// Advanced hierarchical image storage system for Totsan
// 
// Structure:
// buckets/
//   profile-images/
//     {profile-slug}/
//       meta.json (profile metadata)
//       profile/
//         main.jpg (primary profile picture)
//         main-thumb.jpg (thumbnail)
//         main-og.jpg (open graph - 1200x630)
//         main-v{N}.jpg (version history)
//       banner/
//         main.jpg
//         main-blur.jpg (for lazy loading)
//       portfolio/
//         {portfolio-id}/
//           cover.jpg
//           cover-thumb.jpg
//           image-001.jpg
//           image-002.jpg
//           ...
//       services/
//         {service-id}/
//           banner.jpg
//           banner-thumb.jpg
//           image-001.jpg
//           image-002.jpg
//           ...
//       temp/ (cleanup after 48h)
//         upload-{timestamp}.jpg

export const IMAGE_SCHEMA = {
  // ============================================================================
  // BUCKET: profile-images (Public)
  // ============================================================================
  'profile-images': {
    type: 'hierarchical',
    public: true,
    ttl: null, // No auto-delete
    structure: {
      // Level 1: Profile slug (unique identifier)
      '{profile-slug}': {
        // Meta file: profile metadata
        'meta.json': {
          format: 'json',
          contains: ['profile_id', 'user_id', 'name', 'created_at', 'updated_at'],
          ttl: null,
          versioning: false
        },

        // Level 2: Profile picture
        'profile': {
          'main.jpg': {
            purpose: 'Primary profile picture',
            dimensions: [300, 300],
            format: 'jpeg',
            quality: 85,
            versioning: true,
            maxVersions: 10,
            cdn_cache: '86400' // 24 hours
          },
          'main-thumb.jpg': {
            purpose: 'Thumbnail (50x50)',
            dimensions: [50, 50],
            format: 'jpeg',
            quality: 80,
            auto_generated_from: 'main.jpg',
            versioning: false
          },
          'main-og.jpg': {
            purpose: 'Open Graph (1200x630 for social share)',
            dimensions: [1200, 630],
            format: 'jpeg',
            quality: 80,
            auto_generated_from: 'main.jpg',
            versioning: false
          },
          'main-v{N}.jpg': {
            purpose: 'Version history (v1, v2, etc)',
            dimensions: [300, 300],
            format: 'jpeg',
            quality: 85,
            keep_versions: 10,
            auto_cleanup: true
          }
        },

        // Level 2: Banner/cover image
        'banner': {
          'main.jpg': {
            purpose: 'Profile banner',
            dimensions: [1600, 400],
            format: 'jpeg',
            quality: 82,
            versioning: true,
            maxVersions: 5,
            cdn_cache: '86400'
          },
          'main-blur.jpg': {
            purpose: 'Blurred placeholder (for lazy loading)',
            dimensions: [1600, 400],
            format: 'jpeg',
            quality: 30,
            auto_generated_from: 'main.jpg',
            versioning: false
          },
          'main-tablet.jpg': {
            purpose: 'Responsive (tablet)',
            dimensions: [1000, 250],
            format: 'jpeg',
            quality: 82,
            auto_generated_from: 'main.jpg',
            versioning: false
          },
          'main-mobile.jpg': {
            purpose: 'Responsive (mobile)',
            dimensions: [500, 200],
            format: 'jpeg',
            quality: 82,
            auto_generated_from: 'main.jpg',
            versioning: false
          }
        },

        // Level 2: Portfolio items
        'portfolio': {
          '{portfolio-id}': {
            'cover.jpg': {
              purpose: 'Portfolio item cover',
              dimensions: [600, 400],
              format: 'jpeg',
              quality: 85,
              versioning: true,
              maxVersions: 3
            },
            'cover-thumb.jpg': {
              purpose: 'Portfolio thumbnail (grid)',
              dimensions: [200, 200],
              format: 'jpeg',
              quality: 80,
              auto_generated_from: 'cover.jpg',
              versioning: false
            },
            'image-{NNN}.jpg': {
              purpose: 'Portfolio images (001, 002, ...)',
              dimensions: [1200, 1200],
              format: 'jpeg',
              quality: 85,
              versioning: false,
              max_files: 50
            },
            'before-{NNN}.jpg': {
              purpose: 'Before/after - before image',
              dimensions: [1200, 1200],
              format: 'jpeg',
              quality: 85,
              versioning: false
            },
            'after-{NNN}.jpg': {
              purpose: 'Before/after - after image',
              dimensions: [1200, 1200],
              format: 'jpeg',
              quality: 85,
              versioning: false
            },
            'meta.json': {
              format: 'json',
              contains: ['portfolio_id', 'title', 'image_count', 'created_at'],
              ttl: null,
              versioning: false
            }
          }
        },

        // Level 2: Services
        'services': {
          '{service-id}': {
            'banner.jpg': {
              purpose: 'Service header banner',
              dimensions: [1200, 400],
              format: 'jpeg',
              quality: 85,
              versioning: true,
              maxVersions: 3
            },
            'banner-thumb.jpg': {
              purpose: 'Service banner thumbnail',
              dimensions: [400, 133],
              format: 'jpeg',
              quality: 80,
              auto_generated_from: 'banner.jpg',
              versioning: false
            },
            'image-{NNN}.jpg': {
              purpose: 'Service showcase images (001, 002, ...)',
              dimensions: [1200, 800],
              format: 'jpeg',
              quality: 85,
              versioning: false,
              max_files: 20
            },
            'meta.json': {
              format: 'json',
              contains: ['service_id', 'title', 'image_count', 'updated_at'],
              ttl: null,
              versioning: false
            }
          }
        },

        // Level 2: Temporary uploads (auto-cleanup)
        'temp': {
          'upload-{timestamp}.jpg': {
            purpose: 'Temporary upload (cleanup after 48h)',
            dimensions: 'original',
            format: 'jpeg',
            quality: 85,
            ttl: '48h',
            auto_cleanup: true,
            versioning: false
          }
        }
      }
    },

    // CDN caching strategies
    cache_strategy: {
      static_images: '86400', // 24 hours (profile, banner, portfolio)
      responsive_variants: '604800', // 7 days
      thumbnails: '2592000', // 30 days (rarely change)
      temp_files: '3600' // 1 hour
    },

    // Cleanup rules
    cleanup: {
      old_versions: { keep: 10, delete_older_than: '90d' },
      temp_uploads: { delete_after: '48h' },
      orphaned_files: { check_db: true, delete_unreferenced: true }
    }
  }
}

// ============================================================================
// PATH BUILDERS
// ============================================================================

export class ImageStoragePath {
  constructor(profileSlug) {
    this.profileSlug = profileSlug
    this.baseDir = profileSlug
  }

  // Profile picture
  profilePicture(variant = 'main') {
    const variants = {
      main: 'profile/main.jpg',
      thumb: 'profile/main-thumb.jpg',
      og: 'profile/main-og.jpg'
    }
    return `${this.baseDir}/${variants[variant] || variants.main}`
  }

  profilePictureVersion(versionNumber) {
    return `${this.baseDir}/profile/main-v${versionNumber}.jpg`
  }

  // Banner
  banner(variant = 'main') {
    const variants = {
      main: 'banner/main.jpg',
      blur: 'banner/main-blur.jpg',
      tablet: 'banner/main-tablet.jpg',
      mobile: 'banner/main-mobile.jpg'
    }
    return `${this.baseDir}/${variants[variant] || variants.main}`
  }

  // Portfolio
  portfolioItem(portfolioId, type = 'cover', index = null) {
    const basePort = `${this.baseDir}/portfolio/${portfolioId}`
    
    if (type === 'cover') return `${basePort}/cover.jpg`
    if (type === 'thumb') return `${basePort}/cover-thumb.jpg`
    if (type === 'image' && index) return `${basePort}/image-${String(index).padStart(3, '0')}.jpg`
    if (type === 'before' && index) return `${basePort}/before-${String(index).padStart(3, '0')}.jpg`
    if (type === 'after' && index) return `${basePort}/after-${String(index).padStart(3, '0')}.jpg`
    if (type === 'meta') return `${basePort}/meta.json`
    
    throw new Error(`Unknown portfolio type: ${type}`)
  }

  // Services
  serviceImage(serviceId, type = 'banner', index = null) {
    const baseSvc = `${this.baseDir}/services/${serviceId}`
    
    if (type === 'banner') return `${baseSvc}/banner.jpg`
    if (type === 'banner-thumb') return `${baseSvc}/banner-thumb.jpg`
    if (type === 'image' && index) return `${baseSvc}/image-${String(index).padStart(3, '0')}.jpg`
    if (type === 'meta') return `${baseSvc}/meta.json`
    
    throw new Error(`Unknown service type: ${type}`)
  }

  // Temporary uploads
  tempUpload() {
    const timestamp = Date.now()
    return `${this.baseDir}/temp/upload-${timestamp}.jpg`
  }

  // Metadata files
  profileMeta() {
    return `${this.baseDir}/meta.json`
  }

  // List all paths for a profile
  getAllPaths() {
    return {
      profile: {
        picture: this.profilePicture('main'),
        thumbnail: this.profilePicture('thumb'),
        og: this.profilePicture('og')
      },
      banner: {
        main: this.banner('main'),
        blur: this.banner('blur'),
        tablet: this.banner('tablet'),
        mobile: this.banner('mobile')
      },
      metadata: this.profileMeta()
    }
  }
}

// ============================================================================
// DATABASE TRACKING
// ============================================================================

export const IMAGE_METADATA_TABLE = {
  table: 'image_metadata',
  schema: `
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null references profiles(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    bucket text not null,
    path text not null,
    category text not null, -- 'profile', 'banner', 'portfolio', 'service', 'temp'
    type text, -- 'main', 'thumb', 'og', 'cover', 'image', etc.
    reference_id uuid, -- portfolio_id or service_id
    reference_type text, -- 'portfolio' or 'service'
    variant text, -- 'main', 'blur', 'tablet', 'mobile', etc.
    version_number integer,
    original_filename text,
    file_size integer,
    dimensions text, -- '300x300'
    mime_type text,
    hash text unique, -- For deduplication
    is_current boolean default true,
    is_deleted_from_db boolean default false,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    deleted_at timestamptz,
    unique(path, profile_id)
  `,
  indexes: [
    'profile_id, category, is_current',
    'user_id, created_at desc',
    'reference_type, reference_id',
    'path',
    'hash'
  ]
}

export const IMAGE_CLEANUP_LOG_TABLE = {
  table: 'image_cleanup_log',
  schema: `
    id uuid primary key default gen_random_uuid(),
    profile_id uuid references profiles(id) on delete set null,
    action text not null, -- 'delete', 'replace', 'cleanup_old_version', 'cleanup_temp'
    path text,
    reason text,
    freed_bytes integer,
    created_at timestamptz default now()
  `,
  indexes: [
    'profile_id, created_at desc',
    'action, created_at desc'
  ]
}
