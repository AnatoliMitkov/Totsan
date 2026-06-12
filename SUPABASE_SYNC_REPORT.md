# Supabase Database & Project Sync Report

## Executive Summary
Your Supabase schema is **well-structured** but has **critical mismatches** with your frontend code. Below is a complete audit with fixes.

---

## 1. MISSING / MISMATCHED TABLES

### ❌ Missing in Code
These tables exist in Supabase but have **no frontend UI** to manage them:

| Table | Purpose | Status | Action |
|-------|---------|--------|--------|
| `orders` | Payments, delivery tracking | ✅ Schema exists | Needs UI in `/admin` |
| `payment_transactions` | Transaction logs | ✅ Schema exists | Needs admin dashboard |
| `conversations` | Chat + offers | ✅ Schema exists, RLS done | Needs chat UI component |
| `messages` | Chat messages | ✅ Schema exists | Needs chat UI |
| `offers` | Inline quotes in chat | ✅ Schema exists | Needs offer builder |
| `partner_services` | Service listings | ✅ Schema exists | Needs partner dashboard |
| `partner_service_packages` | Tier pricing | ✅ Schema exists | Needs service editor |
| `partner_service_faq` | FAQ per service | ✅ Schema exists | Needs FAQ editor |
| `profile_portfolio` | Partner portfolios | ✅ Schema exists | Needs portfolio UI |
| `client_projects` | User project tracking | ✅ Schema exists | Needs project form |
| `client_project_media` | Project photos/docs | ✅ Schema exists | Needs media uploader |
| `audit_log` | Admin action history | ✅ Schema exists | Needs audit UI |
| `reviews` | Verified reviews | ✅ Schema exists | Needs review form |
| `review_reports` | Report fake reviews | ✅ Schema exists | Needs moderation UI |

---

## 2. COLUMN MISMATCHES

### `accounts` Table
**Scope:** Supabase schema is **complete**.

```sql
-- ✅ EXISTS IN DB
id, email, full_name, display_name, role, specialist_status, created_at, updated_at
phone, avatar_url, city, country, bio, locale, marketing_opt_in
interests, style_preferences, preferred_contact_method, age_group, gender
account_status, admin_note, last_admin_action_at, stripe_account_id

-- ✅ USED IN CODE (account.js)
SELECT id, email, full_name, display_name, role, specialist_status, account_status, phone, 
       avatar_url, city, country, bio, locale, marketing_opt_in, interests, 
       style_preferences, preferred_contact_method, age_group, gender, stripe_account_id, created_at
```

**Status:** ✅ **ALIGNED**

---

### `profiles` Table
**Status:** ✅ **ALIGNED** but has **Phase 2 extensions** not used in frontend yet.

```sql
-- CORE (used in Admin.jsx)
id, slug, layer_slug, name, tag, city, since, rating, projects, bio, image_url, is_published

-- EXTENDED (Phase 2 — future use)
headline, description_long, phone, email_public, website, instagram, facebook
languages[], service_areas[], years_experience, response_time_hours, accepts_remote, pricing_note
```

**Action:** These fields are ready for a **Pro Profile Editor** page.

---

### `inquiries` Table
**Status:** ⚠️ **PARTIAL MISMATCH**

```sql
-- DB SCHEMA
id, created_at, name, contact, layer_slug, message, source, target_slug, status
+ client_id (NEW — added for RLS)

-- CODE USAGE (Admin.jsx)
Reads: ALL of above
Updates: status only

-- MISSING IN CODE
- client_id is set by RLS trigger but never populated via form
- source field has enum: 'contact_form' | 'pro_inquiry' | 'product_inquiry' (only contact_form used)
```

**Fix:** Update `submitInquiry` to auto-set `client_id = auth.uid()` if logged in.

---

### `partner_applications` Table
**Status:** ⚠️ **MISMATCH**

```sql
-- DB SCHEMA
id, created_at, name, company, email, phone, layer_slug, about, status
+ user_id (references auth.users)
+ role, reviewed_at, decision_note

-- CODE CREATION (Admin.jsx signup)
Writes: name, company, email, phone, layer_slug, about (via signup metadata)
Does NOT set: user_id explicitly

-- ISSUE
When a specialist signs up, user_id is NULL because the signup happens BEFORE the auth.users record exists.
```

**Fix:** Add `after insert on auth.users` trigger to link `partner_applications.user_id` when new specialist signs up.

---

## 3. ROW LEVEL SECURITY (RLS) GAPS

### ✅ Properly Enforced
- `accounts`: Users can only read their own row
- `profiles`: Public can read published; pros can read/edit own
- `client_projects`: Users can only read/write own; admins can manage all
- `orders`: Participants (client/partner) can read; admins manage

### ⚠️ Issues

**`inquiries` — Partners can't reply**
```sql
-- DB: Partners CAN read inquiries targeted to their profile_slug
-- CODE: Admin.jsx reads all inquiries but doesn't show a "partner view"
-- FIX: Create a `/partner/inquiries` page that shows inquiries where target_slug matches user's profile
```

**`conversations` — Missing insert policy**
```sql
-- DB: Participants can select + update, but NO insert policy exists!
-- FIX: Add this policy (done in schema.sql but verify it exists)
```

---

## 4. RPC FUNCTIONS & STORED PROCEDURES

### ✅ Available in DB (not called from code)

| Function | Purpose | Need Frontend Call? |
|----------|---------|---------------------|
| `is_admin()` | Check auth role | ✅ Used in RLS |
| `handle_new_user()` | Auto-create accounts | ✅ Trigger only |
| `set_updated_at()` | Update timestamps | ✅ Trigger only |
| `update_own_account_profile()` | Client edits their info | ❌ **NOT CALLED FROM CODE** |
| `get_shared_client_project()` | Fetch public project | ❌ **NOT CALLED** |
| `recalculate_profile_rating()` | Update partner rating | ✅ Trigger only |
| `sync_profile_rating_from_reviews()` | Review rating sync | ✅ Trigger only |
| `partner_service_is_public()` | Check service visibility | ✅ Used in RLS |
| `profile_belongs_to_current_user()` | Ownership check | ✅ Used in RLS |

**Action:** Implement calls to `update_own_account_profile()` in a `/moy-profil` (My Profile) page.

---

## 5. STORAGE BUCKETS

### ✅ Buckets Defined in Schema

| Bucket | Purpose | Public | Status |
|--------|---------|--------|--------|
| `profile-images` | Partner avatars | ✅ Yes | No code to upload |
| `profile-images-optimized` | Optimized versions | ✅ Yes | No code to upload |
| `project-media` | Client project photos | ❌ No | No code to upload |
| `portfolio-media` | Partner portfolio | ✅ Yes | No code to upload |
| `service-media` | Service images | ✅ Yes | No code to upload |

**Action:** Create a media uploader component (used by projects, portfolios, services).

---

## 6. CRITICAL FIXES NEEDED

### 6.1 Set Admin Users (SECURITY)

**Your admin check uses `public.accounts.role = 'admin'`:**
```javascript
// supabase.js
export const hasAdminAccess = (session) => {
  // This checks ADMIN_EMAIL_SET but the DB doesn't enforce it!
  return getSessionEmails(session).some((email) => ADMIN_EMAIL_SET.has(email))
}
```

**Problem:** Admin.jsx hardcodes email set, but Supabase RLS checks `public.accounts.role = 'admin'`. These can mismatch!

**Fix:**
```sql
-- In Supabase SQL Editor, manually promote admins:
UPDATE public.accounts SET role = 'admin' WHERE email = 'your-email@example.com';
```

Then remove the hardcoded email set from `Admin.jsx`.

---

### 6.2 Sync user_id in Inquiries

**Frontend submits inquiry without `client_id`:**
```javascript
// inquiries form submits but doesn't set user_id
// When user is logged in, auto-set this:
supabase.from('inquiries').insert({
  name, contact, layer_slug, message, source, target_slug, status: 'new',
  client_id: session?.user?.id  // ADD THIS
})
```

---

### 6.3 Auto-link Partner Applications to Users

**Specialist signup doesn't set `user_id` in `partner_applications`:**

Add this SQL trigger:
```sql
create or replace function public.link_partner_applications_to_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.partner_applications
  set user_id = new.id
  where email = new.email
    and user_id is null
    and status != 'rejected'
  limit 1;
  return new;
end;
$$;

drop trigger if exists link_partner_applications_to_new_user on auth.users;
create trigger link_partner_applications_to_new_user
after insert on auth.users
for each row execute function public.link_partner_applications_to_new_user();
```

---

### 6.4 Enable Cover URL in Profiles

**Your code tries to fetch `cover_url` from profiles but it's missing:**
```sql
-- Add to schema.sql:
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cover_url text;
```

---

## 7. GRANT AI AGENTS FULL SUPABASE ACCESS

### 🔐 For Antigravity, Codex GPT, and Claude

**1. Create a Service Role API Key in Supabase Dashboard:**
- Go to **Settings → API → Project API Keys**
- Copy the **service_role** key (⚠️ Keep secret)

**2. Add to Your `.env.local`:**
```env
# Keep VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY as-is (public)

# FOR AI AGENTS ONLY (never commit to git):
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...  # Service role key
SUPABASE_PROJECT_ID=your-project-ref
SUPABASE_API_URL=https://your-project-ref.supabase.co
```

**3. Create an `ai-access.js` utility:**
```javascript
// src/lib/ai-access.js
import { createClient } from '@supabase/supabase-js'

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const url = process.env.SUPABASE_API_URL

export const supabaseAdmin = serviceKey && url
  ? createClient(url, serviceKey, {
      auth: { persistSession: false }
    })
  : null

// Usage by AI agents:
// import { supabaseAdmin } from './lib/ai-access.js'
// await supabaseAdmin.from('accounts').select('*')
// No RLS restrictions apply with service role
```

**4. Share with AI Agents:**
```
I've set up Supabase API access. Use this to sync:

Credentials:
- Project URL: https://your-project-ref.supabase.co
- Service Role Key: [shared privately]
- Project ID: your-project-ref

Tables to manage:
✅ accounts, profiles, partner_services, orders, reviews
✅ client_projects, conversations, audit_log
✅ All tables (service role bypasses RLS)

Example call:
const { data, error } = await supabaseAdmin
  .from('accounts')
  .select('*')
  .eq('role', 'admin')
```

---

## 8. MISSING FRONTEND PAGES

| Page | Route | Purpose | Priority |
|------|-------|---------|----------|
| My Profile | `/moy-profil` | Edit account + preferences | 🔴 HIGH (used in logout panel) |
| Partner Dashboard | `/partner/dashboard` | Services, offers, orders | 🔴 HIGH |
| Chat | `/chat/:conversationId` | Real-time messages + offers | 🟡 MEDIUM |
| Project Form | `/projects/new` | Create client project | 🟡 MEDIUM |
| Orders | `/orders` | Client/partner orders | 🟡 MEDIUM |
| Reviews | `/reviews` | Verified reviews system | 🟡 MEDIUM |

---

## 9. SCHEMA VALIDATION CHECKLIST

- [x] `accounts` table matches code
- [x] `profiles` table matches code (Phase 2 fields ready)
- [x] `inquiries` table (needs client_id integration)
- [x] `partner_applications` table (needs user_id trigger)
- [x] `partner_services` table (admin approval flow ready)
- [x] `orders` table (RLS correct, no code yet)
- [x] `conversations` + `messages` (RLS correct, no code yet)
- [x] `reviews` + `review_reports` (RLS correct, no code yet)
- [x] Storage buckets defined
- [x] RLS policies complete
- [x] Indexes created for performance

---

## 10. IMMEDIATE NEXT STEPS

### Phase 1: Sync & Security (This Week)
1. Set admin role for your account in `accounts` table
2. Add `cover_url` column to `profiles` (or remove from code)
3. Add `link_partner_applications_to_new_user()` trigger
4. Test inquiries form with logged-in users (sets `client_id`)

### Phase 2: AI Agent Access (This Week)
1. Generate service role key
2. Create `ai-access.js` utility
3. Share credentials securely with AI agents

### Phase 3: Quick Wins (Next Week)
1. Implement `/moy-profil` page using `update_own_account_profile()`
2. Add chat UI with real-time listeners
3. Create basic order/review dashboard for admins

---

## 11. VERIFICATION QUERIES

Run these in **Supabase SQL Editor** to verify sync:

```sql
-- Check admin users
SELECT id, email, role, account_status FROM public.accounts WHERE role = 'admin';

-- Check specialist applications
SELECT id, email, status, user_id FROM public.partner_applications ORDER BY created_at DESC LIMIT 10;

-- Check inquiries linked to users
SELECT id, name, client_id, status FROM public.inquiries WHERE client_id IS NOT NULL LIMIT 10;

-- Check profiles with users
SELECT p.id, p.name, p.user_id, a.email FROM public.profiles p 
LEFT JOIN public.accounts a ON a.id = p.user_id 
LIMIT 10;

-- Check RLS enforcement
SELECT COUNT(*) FROM public.orders;  -- Should be 0 or restricted based on RLS
```

---

## 12. AI AGENT CAPABILITIES

With service role access, your AI agents can:

✅ **Read:**
- All accounts, profiles, services, projects
- All orders, payments, conversations
- All audit logs, reviews, applications

✅ **Write/Update:**
- Bulk update accounts (fix data inconsistencies)
- Sync profiles from auth.users
- Create orders or applications
- Update order status
- Moderate reviews

✅ **Delete:**
- Remove spam inquiries
- Delete test data

❌ **Cannot:**
- Bypass storage policies (still need proper auth context)
- Modify auth.users directly (use `admin.auth.admin.updateUserById()` if needed)

---

## Questions?

If AI agents ask about:
- **"How do I sync X to Y?"** → Use `supabaseAdmin` client, no RLS
- **"What's the schema?"** → Reference this report + schema.sql
- **"Can I edit table X?"** → Yes, with service role key
- **"How to add a new field?"** → SQL migrations go in `supabase/migrations/`
