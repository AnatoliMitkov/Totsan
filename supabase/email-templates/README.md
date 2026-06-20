# Totsan Supabase Auth Email Templates

These files are dashboard-ready HTML templates for Supabase Auth emails. They do not contain secrets.

Important: the HTML templates only control the email body. The sender shown in Gmail, for example `Supabase Auth <noreply@mail.app.supabase.io>` vs `Totsan <no-reply@totsan.com>`, is controlled by Supabase custom SMTP settings.

## Files

- `confirm-signup.html`: email confirmation / signup confirmation template with both a secure button link and an 8-digit OTP fallback.
- `recovery.html`: password recovery template using the same visual system.

## Public Email Assets

The templates reference the web-safe logo URL:

```text
https://totsan.com/email/totsan-logo-white.png
```

Local asset copies are stored in:

```text
public/email/totsan-logo-white.png
public/email/totsan-logo-dark.png
```

The source files were copied from:

```text
public/svg/Logo White.png
public/svg/Logo Dark.png
```

If the production domain or asset path changes, update the `<img src="...">` URL in each template before pasting it into Supabase.

## Supabase Variables Used

Both templates use:

```text
{{ .ConfirmationURL }}
```

Supabase replaces this with the secure confirmation, recovery, or action URL for the email type.

`confirm-signup.html` also uses:

```text
{{ .Email }}
{{ .Token }}
```

`{{ .Token }}` is the 8-digit one-time code shown on the `/check-email` page. The page verifies it with `supabase.auth.verifyOtp({ email, token, type: 'email' })`. The button link remains available through `{{ .ConfirmationURL }}`.

`recovery.html` uses `{{ .Email }}` for clarity, but keeps the reset flow link-based because the current Totsan password recovery UI is built around Supabase's recovery redirect.

## Recommended Subjects

Confirm signup:

```text
Потвърдете регистрацията си в Totsan
```

Password recovery:

```text
Възстановяване на достъпа до Totsan
```

## Manual Supabase Dashboard Setup

1. Open the Supabase Dashboard for the Totsan project.
2. Go to `Authentication` -> `Emails` -> `SMTP Settings` or `Authentication` -> `Settings` -> `SMTP Settings`, depending on the current Supabase Dashboard layout.
3. Enable custom SMTP. This is required to send from `no-reply@totsan.com` instead of the default Supabase sender.
4. Use this sender identity:

```text
Sender name: Totsan
Sender email: no-reply@totsan.com
```

5. Use the SMTP credentials from the Totsan mail provider. Do not paste or store the mailbox password anywhere in this repository. For the current domain mailbox setup, enter the values directly in Supabase Dashboard:

```text
Host: mail.totsan.com
Port: 465 with SSL, or 587 with TLS if 465 is not accepted
```

Use the mailbox address as the SMTP username in the dashboard, and type the mailbox password only into the Supabase password field.

6. Do not commit SMTP usernames/passwords to this repo, `.env`, migrations, edge functions, frontend code, screenshots, tickets, or docs.
7. Save the SMTP settings.
8. Send a Supabase test email before testing the app signup flow.
9. Go to `Authentication` -> `Email Templates`.
10. Open `Confirm signup`.
11. Set the subject to `Потвърдете регистрацията си в Totsan`.
12. Paste the full contents of `confirm-signup.html` into the template body.
13. Open `Reset password` or `Recovery`.
14. Set the subject to `Възстановяване на достъпа до Totsan`.
15. Paste the full contents of `recovery.html` into the template body.
16. Go to `Authentication` -> `URL Configuration`.
17. Confirm the Site URL is the production Totsan URL.
18. Add redirect URLs if the auth flow needs them, for example production, preview, and local development URLs.
19. Send a real signup or password recovery email from Totsan.
20. Check Gmail desktop, Gmail mobile, Apple Mail, Outlook, and dark mode.

The Gmail inbox row should no longer show:

```text
Supabase Auth
```

It should show a Totsan sender, ideally:

```text
Totsan <no-reply@totsan.com>
```

The subject should be Bulgarian, for example:

```text
Потвърдете регистрацията си в Totsan
Възстановяване на достъпа до Totsan
```

If Gmail still shows `Supabase Auth <noreply@mail.app.supabase.io>`, custom SMTP is not active for the production Supabase project or the test email came from a different Supabase project.

## Check Email Page

After signup, Totsan routes users to:

```text
/check-email?email=user@example.com
```

For partner signup, it uses:

```text
/check-email?type=partner&email=user@example.com
```

The page offers:

- Open Gmail / Open Outlook shortcuts.
- An 8-digit code input.
- A resend action using `supabase.auth.resend({ type: 'signup', email })`.
- A fallback link path through the email button.

The code field is useful only when Supabase email confirmations are enabled for the project and the Confirm signup template includes `{{ .Token }}`.

## Local Preview

Generate local preview files with sample Supabase variables:

```bash
npm run email:preview
```

Open:

```text
docs-output/email-previews/index.html
```

The preview index shows both desktop and mobile-width frames. These files are for visual QA only and do not replace the Supabase Dashboard templates.

Currently generated previews:

- Signup confirmation with button and 8-digit code.
- Password recovery.
- New inquiry notification.

Run the static email system checks with:

```bash
npm run email:validate
```

This verifies the required Supabase template variables, `/check-email` OTP/resend support, mailbox shortcuts, local email confirmation settings, and generated previews.

For the normal full local QA pass, use:

```bash
npm run email:check
```

This regenerates previews first and then validates them, so checks do not race against stale or partially written preview files.

Local `supabase/config.toml` has email confirmations enabled so local Supabase auth can exercise the same confirmation/code flow as production.

## Gmail Sender Avatar

The small circular avatar next to the sender in Gmail is not controlled by the email HTML template. Gmail decides it from the sender account/domain identity.

Ways to show a Totsan mark there:

1. If `no-reply@totsan.com` is a Google Workspace mailbox, set the profile photo for that mailbox/account in Google Admin or the account profile.
2. If mail is sent from a non-Google mailbox, configure BIMI for `totsan.com`. This requires a DNS TXT record, a BIMI-compatible square SVG logo hosted publicly, and often a verified certificate depending on the recipient mailbox provider.
3. Keep SPF, DKIM, and DMARC correctly configured for `totsan.com`; BIMI generally depends on good domain authentication.

This cannot be solved by changing `confirm-signup.html` or `recovery.html`.

The validation command also writes:

```text
docs-output/email-previews/qa-report.html
```

Use this as the handoff checklist for the final Gmail/Outlook test pass.

## Notes

- The templates use table-based structure, inline styles, no JavaScript, no external font imports, and conservative CSS for email client compatibility.
- The dark Totsan logo is placed inside a white container so it remains visible in dark mode.
- Magic link emails can reuse this system by copying `confirm-signup.html`, changing the headline/body/CTA text, and keeping `{{ .ConfirmationURL }}`.
