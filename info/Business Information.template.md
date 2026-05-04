http://www.totsan.com/
Company: Totsan Design System
Slogan: A Solution for Everyone
Moto: "Reality Beyond Renders"
First Name: Anatoli
Last Name: Mitkov
ZIP Code: 1000
City: Sofia
Emails:
primary@example.com
manager@example.com
no-reply@example.com
payment@example.com
sales@example.com
Mobile: +359 89 000 0000
Bank Details:
Currency: EUR
IBAN: [private]
BIC: [private]
Date: [update locally]

Deployment: https://vercel.com/

Stripe:
Sandbox Keys:
Publishable key: [store locally only]
Secret key: [store locally only]

Real Keys:
Publishable key: [store locally only]
Secret key: [store locally only]

Database: https://supabase.com/

API Keys:
Project URL: https://your-project-ref.supabase.co
Direct Connection String: [store locally only]
CLI Setup Commands:
supabase login
supabase init
supabase link --project-ref your-project-ref
Publishable key: sb_publishable_replace_me
Anon Public: [public anon key]
Service role Secret: [store locally only]

.env.local:
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_replace_me

Notes:
- Keep the real business and secret values only in a local ignored file.
- Do not commit Stripe secret keys, service role keys, or database passwords.