import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const edgeFunctionSource = readFileSync(
  new URL('../../supabase/functions/chat-send-message/index.ts', import.meta.url),
  'utf8',
)

const helperSource = edgeFunctionSource.match(/const MASK = [\s\S]*?(?=\nfunction maskText)/)?.[0] || ''
assert.ok(helperSource, 'contact masking helper must remain available for contract testing')

const loadHelper = new Function(`
  ${helperSource.replace('export function maskContactText', 'function maskContactText')}
  return { MASK, maskContactText }
`)
const { MASK, maskContactText } = loadHelper()

describe('chat contact masking', () => {
  it('preserves valid ISO dates and date-time fragments', () => {
    const text = [
      'Валидна до 2026-07-25.',
      'Среща: 2026-07-25T14:30:00.000Z.',
      'Старт: 2026-07-25 14:30:00+03:00.',
      'Високосна дата: 2024-02-29.',
    ].join(' ')

    assert.equal(maskContactText(text), text)
  })

  it('still masks phone numbers, email addresses, and URLs', () => {
    const masked = maskContactText('Телефон +359 888 123 456, email 2026-07-25@example.com, сайт https://example.com/2026-07-25')

    assert.equal(masked.includes('+359 888 123 456'), false)
    assert.equal(masked.includes('2026-07-25@example.com'), false)
    assert.equal(masked.includes('https://example.com/2026-07-25'), false)
    assert.equal(masked.split(MASK).length - 1, 3)
  })

  it('preserves a valid deadline while masking contact data in the same message', () => {
    const masked = maskContactText('Срок: 2026-07-25; телефон: 0888 123 456')

    assert.match(masked, /2026-07-25/)
    assert.equal(masked.includes('0888 123 456'), false)
    assert.match(masked, new RegExp(escapeRegExp(MASK)))
  })

  it('does not exempt impossible calendar dates from the existing phone-like matcher', () => {
    assert.equal(maskContactText('Невалидна дата 2026-02-29').includes('2026-02-29'), false)
  })

  it('keeps the Edge Function mask pipeline delegated to the tested helper', () => {
    assert.match(edgeFunctionSource, /const masked = maskContactText\(original\)/)
  })
})

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
