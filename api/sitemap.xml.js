import { buildSitemapPayload, buildSitemapXml, getStaticSitemapEntries, validateSitemapEntries } from '../src/lib/sitemap.js'

export default async function handler(_request, response) {
  try {
    const payload = await buildSitemapPayload()
    if (payload.errors.length === 0) {
      sendSitemap(response, payload.entries)
      return
    }

    console.error('Dynamic sitemap validation failed, serving static fallback.', payload.errors)
  } catch (error) {
    console.error('Dynamic sitemap generation failed, serving static fallback.', error)
  }

  const fallbackEntries = getStaticSitemapEntries()
  const fallbackValidation = validateSitemapEntries(fallbackEntries)
  if (fallbackValidation.errors.length === 0) {
    sendSitemap(response, fallbackEntries)
    return
  }

  console.error('Static sitemap fallback validation failed.', fallbackValidation.errors)

  response.statusCode = 500
  response.setHeader('Content-Type', 'application/xml; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.end(buildSitemapXml([]))
}

function sendSitemap(response, entries) {
  response.statusCode = 200
  response.setHeader('Content-Type', 'application/xml; charset=utf-8')
  response.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')
  response.end(buildSitemapXml(entries))
}