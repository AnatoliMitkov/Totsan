import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const templatesDir = path.join(root, 'supabase', 'email-templates')
const outputDir = path.join(root, 'docs-output', 'email-previews')
const { buildInquiryEmail } = await import(pathToFileURL(path.join(root, 'supabase', 'functions', '_shared', 'totsan-email.js')))

const samples = [
  {
    source: 'confirm-signup.html',
    output: 'confirm-signup-preview.html',
    title: 'Потвърждение на имейл',
    subject: 'Потвърдете регистрацията си в Totsan',
    description: 'Signup confirmation with CTA link and 6-digit OTP fallback.',
    replacements: {
      '{{ .Email }}': 'a.mitkov@totsan.com',
      '{{ .Token }}': '122362',
      '{{ .ConfirmationURL }}': 'https://totsan.com/welcome?verified=preview',
    },
  },
  {
    source: 'recovery.html',
    output: 'recovery-preview.html',
    title: 'Възстановяване на достъп',
    subject: 'Възстановяване на достъпа до Totsan',
    description: 'Password recovery email in the same Totsan visual system.',
    replacements: {
      '{{ .Email }}': 'a.mitkov@totsan.com',
      '{{ .ConfirmationURL }}': 'https://totsan.com/login?reset=true&preview=1',
    },
  },
  {
    output: 'inquiry-notification-preview.html',
    title: 'Ново запитване',
    subject: 'Ново запитване от Мария Иванова',
    description: 'Internal notification email sent when a visitor submits an inquiry.',
    html: buildInquiryEmail({
      name: 'Мария Иванова',
      contact: 'maria@example.com',
      source: 'contact_form',
      layer_slug: 'materiali',
      target_slug: 'plochki-i-granitogres',
      message: 'Здравейте,\nинтересувам се от консултация за баня и избор на плочки. Има стара настилка и не съм сигурна дали основата е подходяща.\n\nМоже ли да ми върнете насока за следваща стъпка?',
    }),
  },
]

function applyReplacements(template, replacements) {
  return Object.entries(replacements).reduce(
    (html, [needle, value]) => html.split(needle).join(value),
    template
  )
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildIndex(previews) {
  const cards = previews.map((preview) => `
    <article class="card">
      <div>
        <p class="eyebrow">Subject</p>
        <h2>${escapeHtml(preview.title)}</h2>
        <p class="subject">${escapeHtml(preview.subject)}</p>
        <p class="description">${escapeHtml(preview.description)}</p>
      </div>
      <div class="actions">
        <a href="./${escapeHtml(preview.output)}" target="_blank" rel="noreferrer">Open full preview</a>
      </div>
      <div class="frames">
        <div>
          <p class="frame-label">Desktop email width</p>
          <iframe class="desktop-frame" title="${escapeHtml(preview.title)} desktop" src="./${escapeHtml(preview.output)}"></iframe>
        </div>
        <div>
          <p class="frame-label">Mobile email width</p>
          <iframe class="mobile-frame" title="${escapeHtml(preview.title)} mobile" src="./${escapeHtml(preview.output)}"></iframe>
        </div>
      </div>
    </article>
  `).join('\n')

  return `<!doctype html>
<html lang="bg">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Totsan email previews</title>
    <style>
      :root {
        color-scheme: light;
        --ink: #102033;
        --muted: #647487;
        --line: #d6e1eb;
        --paper: #ffffff;
        --soft: #eef4f8;
        --accent: #244766;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        background: var(--soft);
        color: var(--ink);
        font-family: Arial, Helvetica, sans-serif;
      }

      main {
        width: min(1180px, calc(100% - 32px));
        margin: 0 auto;
        padding: 36px 0 48px;
      }

      header {
        margin-bottom: 24px;
      }

      h1,
      h2 {
        margin: 0;
        font-family: Georgia, 'Times New Roman', serif;
      }

      h1 {
        font-size: 42px;
        line-height: 1;
      }

      h2 {
        font-size: 25px;
        line-height: 1.08;
      }

      .intro {
        max-width: 720px;
        margin: 14px 0 0;
        color: var(--muted);
        font-size: 15px;
        line-height: 1.65;
      }

      .grid {
        display: grid;
        gap: 22px;
      }

      .card {
        display: grid;
        grid-template-columns: minmax(260px, 300px) minmax(0, 1fr);
        gap: 18px;
        align-items: start;
        border: 1px solid var(--line);
        border-radius: 24px;
        background: rgba(255, 255, 255, 0.76);
        padding: 18px;
        box-shadow: 0 24px 70px rgba(16, 32, 51, 0.10);
      }

      .eyebrow {
        margin: 0 0 8px;
        color: var(--muted);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }

      .subject,
      .description {
        margin: 10px 0 0;
        color: var(--muted);
        font-size: 14px;
        line-height: 1.55;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 18px;
      }

      a {
        display: inline-flex;
        align-items: center;
        min-height: 38px;
        border-radius: 999px;
        background: var(--accent);
        color: #fff;
        padding: 0 14px;
        font-size: 13px;
        font-weight: 700;
        text-decoration: none;
      }

      a + a {
        background: var(--paper);
        color: var(--accent);
        border: 1px solid var(--line);
      }

      iframe {
        width: 100%;
        height: 760px;
        border: 1px solid var(--line);
        border-radius: 18px;
        background: #fff;
      }

      .frames {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 390px;
        gap: 14px;
        min-width: 0;
      }

      .frame-label {
        margin: 0 0 8px;
        color: var(--muted);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .mobile-frame {
        width: 390px;
        max-width: 100%;
      }

      @media (max-width: 860px) {
        .card {
          grid-template-columns: 1fr;
        }

        .frames {
          grid-template-columns: 1fr;
        }

        iframe {
          height: 720px;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <p class="eyebrow">Totsan email QA</p>
        <h1>Email previews</h1>
        <p class="intro">
          Local previews with sample Supabase variables. These files are for visual QA only; production emails still use the templates in <code>supabase/email-templates</code>.
        </p>
      </header>
      <section class="grid">
        ${cards}
      </section>
    </main>
  </body>
</html>`
}

await mkdir(outputDir, { recursive: true })

const previews = []

for (const sample of samples) {
  const template = sample.html || await readFile(path.join(templatesDir, sample.source), 'utf8')
  const preview = applyReplacements(template, sample.replacements || {})
  await writeFile(path.join(outputDir, sample.output), preview)
  previews.push(sample)
}

await writeFile(path.join(outputDir, 'index.html'), buildIndex(previews))

console.log(`Built ${previews.length} email previews in ${path.relative(root, outputDir)}`)
