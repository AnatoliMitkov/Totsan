# AI Agent Integration Guide

**Last updated:** 2024  
**For:** Antigravity Gemini, Codex GPT, Claude, and other AI agents  
**Purpose:** Full read/write access to Totsan's Supabase database with no RLS restrictions

---

## Quick Start

### 1. Get Credentials
Ask the project owner for:
- `SUPABASE_SERVICE_ROLE_KEY` (secret — never share)
- `SUPABASE_PROJECT_ID` (e.g., `abc123xyz`)
- `SUPABASE_API_URL` (e.g., `https://abc123xyz.supabase.co`)

### 2. Use the Admin Client
```javascript
import { supabaseAdmin } from './src/lib/ai-access.js'

// Example: Get all accounts
const { data, error } = await supabaseAdmin
  .from('accounts')
  .select('*')
  .order('created_at', { ascending: false })

if (error) console.error('Database error:', error)
console.log('Accounts:', data)
```

### 3. Common Tasks

#### Read All Data (No RLS)
```javascript
// Get all users
const { data: accounts } = await supabaseAdmin
  .from('accounts')
  .select('*')

// Get all inquiries
const { data: inquiries } = await supabaseAdmin
  .from('inquiries')
  .select('*')
  .eq('status', 'pending')

// Get admin dashboard stats
const { data: stats } = await supabaseAdmin
  .from('vw_admin_dashboard')
  .select('*')
  .single()
```

#### Update Records
```javascript
// Promote user to admin
await supabaseAdmin
  .from('accounts')
  .update({ role: 'admin' })
  .eq('email', 'user@example.com')

// Update inquiry status
await supabaseAdmin
  .from('inquiries')
  .update({ status: 'replied' })
  .eq('id', 'inquiry-uuid')

// Ban a user
await supabaseAdmin
  .from('accounts')
  .update({
    account_status: 'banned',
    admin_note: 'Spam account',
    last_admin_action_at: new Date().toISOString()
  })
  .eq('email', 'spammer@example.com')
```

#### Insert Records
```javascript
// Create a manual order (for testing)
await supabaseAdmin
  .from('orders')
  .insert({
    client_id: 'user-uuid-1',
    partner_id: 'user-uuid-2',
    title: 'Logo Design',
    amount_total: 50000,  // in EUR cents (€500)
    status: 'pending_payment',
    currency: 'EUR'
  })

// Sync missing accounts
await supabaseAdmin
  .from('accounts')
  .upsert({
    id: 'user-uuid',
    email: 'user@example.com',
    role: 'user'
  }, { onConflict: 'id' })
```

#### Delete Records
```javascript
// Delete spam inquiry
await supabaseAdmin
  .from('inquiries')
  .delete()
  .eq('id', 'inquiry-uuid')

// Delete test user (cascades to related data)
await supabaseAdmin
  .from('accounts')
  .delete()
  .eq('id', 'test-user-uuid')
```

---

## Database Schema Overview

### Core Tables
| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `accounts` | User accounts | `id, email, role, specialist_status, account_status` |
| `profiles` | Public pro profiles | `id, user_id, slug, name, rating, is_published` |
| `inquiries` | Contact form submissions | `id, name, contact, client_id, status, target_slug` |
| `partner_applications` | Specialist applications | `id, email, user_id, status, reviewed_at` |
| `orders` | Transactions | `id, client_id, partner_id, status, amount_total` |
| `conversations` | Chat threads | `id, client_id, partner_id, status, last_message_at` |
| `reviews` | Verified reviews | `id, order_id, client_id, partner_id, rating_overall` |

### Admin Tables
| Table | Purpose |
|-------|---------|
| `audit_log` | Admin action history |
| `order_events` | Order state changes |
| `payment_transactions` | Payment records |
| `review_reports` | Reported reviews |

### Full Schema
See `./supabase/schema.sql` for complete table definitions, columns, RLS policies, and indexes.

---

## Helper Functions in `ai-access.js`

```javascript
import {
  supabaseAdmin,
  ensureAdminUser,
  syncAllProfiles,
  getFullDatabaseSchema,
  getAdminDashboardStats,
  getAccountByEmail,
  getProfilesByUserId,
  updateAccountStatus,
  getPendingApplications,
  getInquiriesByStatus,
  getAuditLog,
} from './src/lib/ai-access.js'

// Promote an admin
await ensureAdminUser('admin@totsan.com')

// Get all pending specialist applications
const pending = await getPendingApplications()

// Get all open inquiries
const open = await getInquiriesByStatus('new')

// Get admin dashboard KPIs
const stats = await getAdminDashboardStats()
// Returns: new_registrations_24h, total_accounts, pending_specialists, etc.

// Get audit trail
const events = await getAuditLog(100)
```

---

## Common Workflows

### Workflow 1: Promote First Admin
```javascript
// Run once to set up admin access
await ensureAdminUser('your-email@totsan.com')
// Now you can log in and access /admin
```

### Workflow 2: Sync Database After Schema Changes
```javascript
// After running a migration, sync all accounts
const result = await syncAllProfiles()
console.log(`Synced ${result.synced} of ${result.total} accounts`)
```

### Workflow 3: Ban a Spammer
```javascript
await updateAccountStatus(
  'spammer@example.com',
  'banned',
  'Reported spam inquiries'
)
```

### Workflow 4: Check Data Consistency
```javascript
// Get accounts without matching profiles
const { data: accounts } = await supabaseAdmin
  .from('accounts')
  .select('id, email, role')
  .eq('role', 'specialist')

for (const account of accounts) {
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('user_id', account.id)
  
  if (!profiles?.length) {
    console.log(`Missing profile for specialist: ${account.email}`)
  }
}
```

### Workflow 5: Export Data for Analysis
```javascript
// Get all completed orders with client/partner info
const { data: orders } = await supabaseAdmin
  .from('orders')
  .select(`
    id,
    created_at,
    amount_total,
    status,
    client:client_id(email, display_name),
    partner:partner_id(email, display_name)
  `)
  .eq('status', 'completed')

// Export to CSV or JSON
console.log(JSON.stringify(orders, null, 2))
```

---

## Security Notes

⚠️ **Service Role Key Security:**
- Never commit to git
- Store in environment variables or CI/CD secrets only
- Treat like a password
- Rotate periodically if compromised
- Use separate keys for development, staging, production

✅ **Best Practices:**
- Always check for errors in responses
- Use `.limit()` for large queries
- Log admin actions via the app's `audit_log`
- Never run DELETE on production without backup
- Test migrations in a dev database first

---

## Support

If AI agents encounter issues:

1. **"Unauthorized" error?** → Check service role key is correct
2. **"Table not found"?** → Schema migration may be pending
3. **"RLS policy violation"?** → Service role should bypass RLS; contact maintainer
4. **Rate limits?** → Supabase free tier has limits; check dashboard

---

## Environment Variables

Your `.env.local` should have:

```env
# For the app
VITE_SUPABASE_URL=https://abc123xyz.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...

# For AI agents (never commit)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
SUPABASE_PROJECT_ID=abc123xyz
SUPABASE_API_URL=https://abc123xyz.supabase.co
```

Run `npm install @supabase/supabase-js` if not already installed.

---

## Next Steps

1. Copy credentials to `.env.local`
2. Test the admin client: `import { supabaseAdmin } from './src/lib/ai-access.js'`
3. Run a test query: `await supabaseAdmin.from('accounts').select('count', { count: 'exact' })`
4. Review `SUPABASE_SYNC_REPORT.md` for data sync needs
5. Implement missing features listed in that report

Let me know if you need any clarifications!
