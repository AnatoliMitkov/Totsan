import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const migration = read('supabase/migrations/20260710000000_accepted_offer_snapshot.sql')
const checkout = read('supabase/functions/payments-checkout/index.ts')
const webhook = read('supabase/functions/payments-webhook/index.ts')
const composer = read('src/components/chat/OfferComposer.jsx')
const offerDocument = read('src/components/offers/OfferDocumentView.jsx')
const chatThread = read('src/components/chat/ChatThread.jsx')
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

  it('keeps a visible draft and the last sent offer as reusable templates', () => {
    assert.match(composer, /totsan:last-used-offer:v1:/)
    assert.match(composer, /Запазена чернова/)
    assert.match(composer, /Последно използвана оферта/)
    assert.match(composer, /localStorage\.setItem\(lastUsedOfferKey, JSON\.stringify\(draft\)\)/)
  })

  it('resets every imported value when the user chooses a blank offer', () => {
    assert.match(composer, /function startBlankOffer\(\)[\s\S]*setDraft\(createOfferDraft\(\)\)/)
    assert.match(composer, /onBlank=\{startBlankOffer\}/)
  })

  it('shows the matching offer-type icon in the sent offer document', () => {
    assert.match(offerDocument, /function offerTypeIcon\(offerType\)/)
    assert.match(offerDocument, /offerType === 'estimate'.*ScanSearch/)
    assert.match(offerDocument, /offerType === 'staged'.*Layers3/)
    assert.match(offerDocument, /return BadgeCheck/)
  })

  it('keeps scope details visible directly below included work', () => {
    assert.match(offerDocument, /Section title="Какво е включено" className=\{panel\}/)
    assert.match(offerDocument, /Section title="Граници на обхвата" className=\{panel\}/)
    assert.match(offerDocument, /TextList title="Не е включено"/)
    assert.match(offerDocument, /TextList title="Клиентът осигурява"/)
  })

  it('keeps the jump-to-latest arrow readable over any chat background', () => {
    assert.match(chatThread, /border-2 border-paper bg-ink text-paper/)
    assert.match(chatThread, /ChevronDown size=\{21\} strokeWidth=\{2\.8\} aria-hidden="true"/)
  })

  it('formats offer amounts and locks the total while a breakdown is active', () => {
    assert.match(composer, /function formatMoneyInput\(value\)/)
    assert.match(composer, /toLocaleString\('en-US'/)
    assert.match(composer, /disabled=\{breakdownEnabled\}/)
    assert.match(composer, /onToggle=\{\(event\) => \{ if \(event\.currentTarget\.open\) enableBreakdown\(\) \}\}/)
  })

  it('labels pricing, materials, and VAT in the sent offer card', () => {
    assert.match(offerDocument, /Тип цена:/)
    assert.match(offerDocument, /Материали:/)
    assert.match(offerDocument, /ДДС:/)
  })

  it('only sends an offer from the explicit send button', () => {
    assert.match(composer, /type="button" onClick=\{submit\}/)
    assert.doesNotMatch(composer, /onSubmit=\{submit\}/)
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
