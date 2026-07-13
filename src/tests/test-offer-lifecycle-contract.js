import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const migration = read('supabase/migrations/20260710000000_accepted_offer_snapshot.sql')
const checkout = read('supabase/functions/payments-checkout/index.ts')
const webhook = read('supabase/functions/payments-webhook/index.ts')
const chatSendMessage = read('supabase/functions/chat-send-message/index.ts')
const composer = read('src/components/chat/OfferComposer.jsx')
const offerDocument = read('src/components/offers/OfferDocumentView.jsx')
const offerCard = read('src/components/chat/OfferCard.jsx')
const messageBubble = read('src/components/chat/MessageBubble.jsx')
const chatThread = read('src/components/chat/ChatThread.jsx')
const conversationList = read('src/components/chat/ConversationList.jsx')
const orderPage = read('src/pages/Order.jsx')
const checkoutPage = read('src/pages/Checkout.jsx')
const orders = read('src/lib/orders.js')

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
    assert.match(offerDocument, /Section title="Какво е включено"/)
    assert.match(offerDocument, /Section title="Граници на обхвата"/)
    assert.match(offerDocument, /TextList title="Не е включено"/)
    assert.match(offerDocument, /TextList title="Клиентът осигурява"/)
  })

  it('uses one responsive light offer document in preview and chat', () => {
    assert.match(offerDocument, /max-w-\[45\.3125rem\][\s\S]*bg-white/)
    assert.match(offerDocument, /function PriceAccent\([\s\S]*sm:absolute sm:right-0 sm:top-0/)
    assert.match(offerDocument, /function TimelineAccent\(/)
    assert.match(offerDocument, /function ValidityAccent\(/)
    assert.match(offerDocument, /rounded-\[1\.5625rem\][\s\S]*bg-\[#f1bdc2\]/)
    assert.doesNotMatch(offerDocument, /compact/)
    assert.match(messageBubble, /isOfferDocument[\s\S]*border-transparent bg-transparent text-ink shadow-none/)
    assert.match(composer, /OfferDocumentView offer=\{preview\} showStatus=\{false\} defaultConditionsOpen/)
    assert.match(offerCard, /OfferDocumentView offer=\{document\} defaultConditionsOpen=\{false\}/)
    assert.doesNotMatch(offerCard, /compact/)
    assert.match(composer, /function Disclosure\(/)
    assert.doesNotMatch(composer, /defaultOpen=/)
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

  it('stores the same rich offer document used by preview into chat persistence', () => {
    assert.match(composer, /offerDetails: \{[\s\S]*title,[\s\S]*priceAmount,[\s\S]*deliveryDays,[\s\S]*includedItems/s)
    assert.match(chatSendMessage, /const offerDetails = detailsResult\.value/)
    assert.doesNotMatch(chatSendMessage, /title: title\.masked\.trim\(\).*priceAmount: normalizedPriceAmount[\s\S]*includedItems/s)
  })

  it('only sends an offer from the explicit send button', () => {
    assert.match(composer, /type="button" onClick=\{submit\}/)
    assert.doesNotMatch(composer, /onSubmit=\{submit\}/)
  })

  it('keeps operational order work ahead of the archived agreement', () => {
    const currentWorkIndex = orderPage.indexOf('<CurrentWorkPanel')
    const agreementIndex = orderPage.indexOf('<AgreedOfferDisclosure')
    assert.ok(currentWorkIndex >= 0)
    assert.ok(agreementIndex > currentWorkIndex)
    assert.match(orderPage, /function CurrentWorkPanel\([\s\S]*role="progressbar"/)
    assert.doesNotMatch(orderPage, /agreedOffer && false/)
  })

  it('keeps order reference sections collapsed by default', () => {
    assert.match(orderPage, /function OrderLocationDisclosure\([\s\S]*<details className=/)
    assert.match(orderPage, /function AgreedOfferDisclosure\([\s\S]*<details className=/)
    assert.match(orderPage, /function RecordDisclosure\([\s\S]*<details className=/)
    assert.doesNotMatch(orderPage, /<details[^>]*\sopen(?:=|\s|>)/)
  })

  it('keeps the successful payment state compact without changing pending states', () => {
    assert.match(checkoutPage, /compact=\{isPaid\}/)
    assert.match(checkoutPage, /function CheckoutStatePage\([\s\S]*compact = false/)
    assert.match(checkoutPage, /<CheckoutShell compact=\{compact\}>/)
    assert.match(checkoutPage, /compact \? '' : 'min-h-\[calc\(100vh-var\(--header-h,0px\)\)\]'/)
  })

  it('keeps both order parties identifiable and links the available profiles', () => {
    assert.match(orderPage, /function PartyCard\([\s\S]*ID: \{shortId\(fallbackId\)\}/)
    assert.match(orderPage, /<Link to=\{profilePath\}[\s\S]*aria-label=/)
    assert.match(orderPage, /clientProfilePath[\s\S]*\/client-profile/)
    assert.match(orderPage, /partnerProfilePath[\s\S]*partnerAccount\?\.profilePath/)
    assert.match(orders, /get_chat_participant_profiles/)
    assert.match(orders, /profilePath: row\.profile_path \|\| ''/)
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
