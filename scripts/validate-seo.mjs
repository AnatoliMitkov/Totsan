import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distDir = path.join(rootDir, 'dist')

const problems = []
const warnings = []

async function main() {
  await loadEnvFile(path.join(rootDir, '.env.local'))
  await loadEnvFile(path.join(rootDir, '.env'))

  const { buildSitemapPayload, buildSitemapXml } = await import('../src/lib/sitemap.js')

  const robots = await readRequiredFile(path.join(distDir, 'robots.txt'), 'dist/robots.txt')
  if (!robots.includes('Sitemap: https://totsan.com/sitemap.xml')) {
    problems.push('robots.txt is missing the canonical sitemap URL.')
  }

  await readRequiredFile(path.join(rootDir, 'api', 'sitemap.xml.js'), 'api/sitemap.xml.js')

  const payload = await buildSitemapPayload()
  problems.push(...payload.errors)
  warnings.push(...payload.warnings)

  const xml = buildSitemapXml(payload.entries)
  if (!xml.includes('<urlset')) {
    problems.push('Generated sitemap XML is malformed or empty.')
  }

  if (xml.includes('/admin') || xml.includes('/inbox') || xml.includes('/checkout') || xml.includes('/order')) {
    problems.push('Generated sitemap XML contains private routes.')
  }

  if (problems.length > 0) {
    console.error('SEO validation failed:')
    problems.forEach((problem) => console.error(`- ${problem}`))
    if (warnings.length > 0) {
      console.warn('Warnings:')
      warnings.forEach((warning) => console.warn(`- ${warning}`))
    }
    process.exit(1)
  }

  console.log(`SEO validation passed. ${payload.entries.length} sitemap URLs checked.`)
  if (warnings.length > 0) {
    console.warn('Warnings:')
    warnings.forEach((warning) => console.warn(`- ${warning}`))
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

async function readRequiredFile(filePath, label) {
  try {
    return await readFile(filePath, 'utf8')
  } catch (error) {
    problems.push(`Missing required file: ${label}`)
    return ''
  }
}

async function loadEnvFile(filePath) {
  try {
    const raw = await readFile(filePath, 'utf8')
    raw.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return
      const separatorIndex = trimmed.indexOf('=')
      if (separatorIndex <= 0) return
      const key = trimmed.slice(0, separatorIndex).trim()
      const value = trimmed.slice(separatorIndex + 1).trim()
      if (!process.env[key]) process.env[key] = value
    })
  } catch {
    // Optional local env file.
  }
}