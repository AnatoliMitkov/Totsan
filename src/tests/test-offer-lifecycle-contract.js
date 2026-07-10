import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const migration = read('supabase/migrations/20260710000000_accepted_offer_snapshot.sql')
const checkout = read('supabase/functions/payments-checkout/index.ts')
const webhook = read('supabase/functions/payments-webhook/index.ts')
const composer = read('src/components/chat/OfferComposer.jsx')
const conversationList = read('src/components/chat/ConversationList.jsx')

describe('offer lifecycle contract', () => {
  it('persists the immutable agreement on both offer and order', () => {
    assert.match(migration, /offers[\s\S]*accepted_offer_snapshot jsonb/)
    assert.match(migration, /orders[\s\S]*accepted_offer_snapshot jsonb not null/)
    assert.match(migration, /set status = 'accepted',[\s\S]*accepted_offer_snapshot = v_snapshot/)
  })

  it('does not turn a preliminary estimate into an order', () => {
    assert.match(migration, /v_offer\.offer_type = 'estimate'[\s\S]*Предварителната оценка/)
  })

  it('creates executable milestones and charges one milestone at a time', () => {
    assert.match(migration, /create table if not exists public\.order_milestones/)
    assert.match(checkout, /CHECKOUT_TYPES = new Set\(\['service', 'offer', 'milestone'\]\)/)
    assert.match(checkout, /metadata\[milestone_id\]/)
    assert.match(checkout, /milestoneAction/)
    assert.match(webhook, /markMilestonePaidFromStripe/)
  })

  it('keeps custom payments out of Stripe checkout and records manual confirmation', () => {
    assert.match(checkout, /paymentMethod === 'custom'/)
    assert.match(checkout, /provider: 'manual'/)
    assert.doesNotMatch(checkout, /escrow_released/)
  })

  it('starts the builder with service templates and stores a versioned draft', () => {
    assert.match(composer, /title: 'Начало'/)
    assert.match(composer, /function TemplateStep/)
    assert.match(composer, /totsan:offer-draft:v2:/)
    assert.match(composer, /Моя услуга/)
  })

  it('closes the conversation menu outside and with Escape', () => {
    assert.match(conversationList, /document\.addEventListener\('pointerdown'/)
    assert.match(conversationList, /event\.key === 'Escape'/)
    assert.match(conversationList, /openMenuRef\.current\?\.contains/)
  })
})

function read(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
}
