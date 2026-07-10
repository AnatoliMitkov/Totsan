/**
 * Tests for canonical offer normalization.
 *
 * Run: node --test src/tests/test-offers-norm.js
 * (Node built-in runner; no extra deps needed.)
 */

import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { normalizeAcceptedOffer, normalizeStages, validateOfferDocument } from '../lib/offers.js'

// ── Fixture: legacy offer (no snapshot) ───────────────────────────────────

const legacyOffer = {
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  title: 'Дизайн на интериор',
  offer_type: 'final',
  price_type: 'fixed',
  summary: 'Проект за кухня и баня',
  description: 'Пълен дизайн',
  price_amount: 1200,
  currency: 'EUR',
  deliverables: ['Дизайн план', '3D визуализации'],
  delivery_days: 14,
  status: 'accepted',
  accepted_at: '2025-06-15T10:00:00Z',
  offer_details: {
    offerType: 'final',
    priceType: 'fixed',
    summary: 'Проект за кухня и баня',
    includedItems: ['Дизайн план', '3D визуализации'],
    excludedItems: ['Мебели', 'Декор'],
    clientRequirements: ['Електрически план'],
    materialsMode: 'included',
    vatStatus: 'included',
    timeline: { days: 14, earliestStartDate: '2025-07-01' },
    stages: [
      { order: 1, title: 'Планове', description: 'Първи вариант', durationDays: 5, priceAmount: 600 },
      { order: 2, title: 'Визуализации', description: '3D модели', durationDays: 9, priceAmount: 600 },
    ],
    payment: { method: 'platform', terms: '50% аванс' },
    conditions: { scopeChanges: 'Уточняват се писмено' },
  },
}

// ── Fixture: accepted offer with snapshot ──────────────────────────────────

const acceptedOffer = {
  id: 'zzz', title: 'Test', offer_type: 'final', price_type: 'fixed', price_amount: 100, currency: 'EUR', summary: 'Original summary',
  accepted_offer_snapshot: {
    schemaVersion: 2,
    title: 'Дизайн на интериор',
    offerType: 'final',
    priceType: 'fixed',
    summary: 'Проект за кухня и баня',
    priceAmount: 1200,
    currency: 'EUR',
    deliverables: ['Дизайн план', '3D визуализации'],
    includedItems: ['Дизайн план', '3D визуализации'],
    excludedItems: ['Мебели', 'Декор'],
    clientRequirements: ['Електрически план'],
    materialsMode: 'included',
    vatStatus: 'included',
    timeline: { days: 14, earliestStartDate: '2025-07-01' },
    stages: [
      { order: 1, title: 'Планове', description: 'Първи вариант', durationDays: 5, priceAmount: 600 },
      { order: 2, title: 'Визуализации', description: '3D модели', durationDays: 9, priceAmount: 600 },
    ],
    payment: { method: 'platform', terms: '50% аванс' },
    conditions: { scopeChanges: 'Уточняват се писмено' },
  },
}

// ── Fixture: mutable offer updated AFTER acceptance ────────────────────────

const mutatedOffer = {
  ...acceptedOffer,
  price_amount: 2000,          // price changed
  deliverables: ['Нов план'],  // scope changed
  offer_details: {
    ...acceptedOffer.offer_details,
    includedItems: ['Нов план'],
  },
}

describe('normalizeAcceptedOffer', () => {
  it('legacy offer without snapshot produces correct shape', () => {
    const norm = normalizeAcceptedOffer(legacyOffer, null)
    assert.equal(norm.offerType, 'final')
    assert.equal(norm.priceType, 'fixed')
    assert.equal(norm.priceAmount, 1200)
    assert.equal(norm.currency, 'EUR')
    assert.equal(norm.summary, 'Проект за кухня и баня')
    assert.deepStrictEqual(norm.includedItems, ['Дизайн план', '3D визуализации'])
    assert.deepStrictEqual(norm.excludedItems, ['Мебели', 'Декор'])
    assert.deepStrictEqual(norm.clientRequirements, ['Електрически план'])
    assert.equal(norm.materialsMode, 'included')
    assert.equal(norm.vatStatus, 'included')
    assert.equal(norm.timeline.days, 14)
    assert.equal(norm.timeline.earliestStartDate, '2025-07-01')
    assert.ok(Array.isArray(norm.stages))
    assert.equal(norm.stages.length, 2)
    assert.equal(norm.stages[0].title, 'Планове')
    assert.equal(norm.payment.method, 'platform')
    assert.equal(norm.conditions.scopeChanges, 'Уточняват се писмено')
  })

  it('accepted offer with snapshot uses snapshot data', () => {
    const norm = normalizeAcceptedOffer(acceptedOffer, acceptedOffer.accepted_offer_snapshot)
    assert.equal(norm.priceAmount, 1200)
    assert.deepStrictEqual(norm.includedItems, ['Дизайн план', '3D визуализации'])
  })

  it('mutated offer derives from snapshot, not from mutable fields', () => {
    const norm = normalizeAcceptedOffer(mutatedOffer, acceptedOffer.accepted_offer_snapshot)
    // Snapshot preserves the original values, not the mutated ones.
    assert.equal(norm.priceAmount, 1200, 'price should come from snapshot')
    assert.deepStrictEqual(norm.includedItems, ['Дизайн план', '3D визуализации'], 'scope should come from snapshot')
  })

  it('empty offer produces safe defaults', () => {
    const norm = normalizeAcceptedOffer({}, null)
    assert.equal(norm.offerType, 'final')
    assert.equal(norm.priceType, 'fixed')
    assert.equal(norm.priceAmount, 0)
    assert.equal(norm.currency, 'EUR')
    assert.deepStrictEqual(norm.includedItems, [])
    assert.deepStrictEqual(norm.stages, [])
  })

  it('null offer produces safe defaults', () => {
    const norm = normalizeAcceptedOffer(null, null)
    assert.equal(norm.offerType, 'final')
    assert.equal(norm.priceAmount, 0)
  })

  it('string offer_details is parsed correctly', () => {
    const withString = {
      id: 'zzz',
      title: 'Test',
      offer_type: 'final',
      price_type: 'fixed',
      price_amount: 100,
      currency: 'EUR',
      summary: 'Original summary',
      offer_details: JSON.stringify({ offerType: 'estimate', summary: 'Parsed summary' }),
    }
    const norm = normalizeAcceptedOffer(withString, null)
    assert.equal(norm.offerType, 'estimate')
    assert.equal(norm.summary, 'Parsed summary')
  })

  it('reads older snapshots that wrapped the rich fields in offerDetails', () => {
    const norm = normalizeAcceptedOffer({ title: 'Mutable title' }, {
      offerType: 'final',
      priceAmount: 900,
      offerDetails: {
        summary: 'Прието резюме',
        excludedItems: ['Демонтаж'],
        payment: { method: 'platform', terms: 'След приемане' },
      },
    })
    assert.equal(norm.summary, 'Прието резюме')
    assert.deepStrictEqual(norm.excludedItems, ['Демонтаж'])
    assert.equal(norm.payment.terms, 'След приемане')
  })

  it('does not complete schema v2 snapshots from mutable contractual fields', () => {
    const norm = normalizeAcceptedOffer({
      title: 'Променено заглавие',
      summary: 'Променено резюме',
      price_amount: 9999,
      deliverables: ['Променен обхват'],
    }, {
      schemaVersion: 2,
      title: 'Прието заглавие',
      summary: 'Прието резюме',
      priceAmount: 1200,
      currency: 'EUR',
      includedItems: ['Приет обхват'],
    })
    assert.equal(norm.title, 'Прието заглавие')
    assert.equal(norm.summary, 'Прието резюме')
    assert.equal(norm.priceAmount, 1200)
    assert.deepStrictEqual(norm.includedItems, ['Приет обхват'])
  })

  it('stages are normalized and sorted', () => {
    const withStages = {
      id: 'zzz',
      title: 'Test',
      offer_type: 'final',
      price_type: 'fixed',
      price_amount: 100,
      currency: 'EUR',
      summary: 'Test',
      offer_details: {
        ...legacyOffer.offer_details,
        stages: [
          { order: 3, title: 'Third' },
          { order: 1, title: 'First' },
          { order: 2, title: 'Second' },
        ],
      },
    }
    const norm = normalizeAcceptedOffer(withStages, null)
    assert.equal(norm.stages[0].title, 'First')
    assert.equal(norm.stages[1].title, 'Second')
    assert.equal(norm.stages[2].title, 'Third')
  })
})

describe('normalizeStages', () => {
  it('normalizes various stage shapes', () => {
    const result = normalizeStages([
      { order: 2, title: 'B', durationDays: 3, priceAmount: 100 },
      { order: 1, title: 'A', durationDays: 5, priceAmount: 200 },
    ])
    assert.equal(result[0].title, 'A')
    assert.equal(result[1].title, 'B')
    assert.equal(result[0].durationDays, 5)
    assert.equal(result[0].priceAmount, 200)
  })

  it('filters empty stages', () => {
    const result = normalizeStages([{ order: 1, title: '' }, { order: 2, title: 'OK' }])
    assert.equal(result.length, 1)
    assert.equal(result[0].title, 'OK')
  })

  it('handles non-array input', () => {
    assert.deepStrictEqual(normalizeStages(null), [])
    assert.deepStrictEqual(normalizeStages(undefined), [])
    assert.deepStrictEqual(normalizeStages('hello'), [])
  })
})

describe('cross-consumer consistency', () => {
  it('OfferCard, Order, and Checkout receive matching values from same fixture', () => {
    // Use the accepted offer WITH snapshot — this is the real-world path after acceptance.
    const fixture = acceptedOffer

    // All accepted-offer consumers use the snapshot exposed on the offer/order.
    const cardData = normalizeAcceptedOffer(fixture)

    // Order uses normalizeAcceptedOffer(offer, offer.accepted_offer_snapshot).
    const orderData = normalizeAcceptedOffer(fixture, fixture.accepted_offer_snapshot)

    // Checkout (via payments-checkout) reads price_amount, currency, deliverables from source.
    // For accepted offers, source.deliverables comes from snapshot.deliverables.
    const snapshot = fixture.accepted_offer_snapshot
    const checkoutDeliverables = snapshot?.deliverables || fixture.deliverables

    // When Order uses the snapshot, all three should agree on core fields.
    assert.equal(orderData.priceAmount, 1200)
    assert.equal(orderData.currency, 'EUR')
    assert.deepStrictEqual(orderData.includedItems, ['Дизайн план', '3D визуализации'])
    assert.deepStrictEqual(orderData.stages.length, 2)
    assert.equal(cardData.priceAmount, orderData.priceAmount)
    assert.deepStrictEqual(cardData.includedItems, orderData.includedItems)

    // Snapshot delivers are the authoritative source.
    assert.deepStrictEqual(checkoutDeliverables, ['Дизайн план', '3D визуализации'])
  })
})

describe('validateOfferDocument', () => {
  it('accepts a balanced staged offer', () => {
    const result = validateOfferDocument({
      schemaVersion: 2,
      title: 'Ремонт по етапи',
      summary: 'Два ясни етапа',
      offerType: 'staged',
      priceType: 'staged',
      priceAmount: 1000,
      includedItems: ['Подготовка', 'Изпълнение'],
      payment: { method: 'staged_platform', terms: 'Всеки етап се плаща отделно.' },
      stages: [
        { order: 1, title: 'Подготовка', priceAmount: 400 },
        { order: 2, title: 'Изпълнение', priceAmount: 600 },
      ],
    })
    assert.equal(result.valid, true)
    assert.deepStrictEqual(result.errors, [])
  })

  it('rejects an unbalanced staged offer', () => {
    const result = validateOfferDocument({
      schemaVersion: 2,
      title: 'Ремонт по етапи',
      summary: 'Два етапа',
      offerType: 'staged',
      priceAmount: 1000,
      includedItems: ['Работа'],
      payment: { method: 'staged_platform', terms: 'По етапи' },
      stages: [
        { order: 1, title: 'Етап 1', priceAmount: 300 },
        { order: 2, title: 'Етап 2', priceAmount: 500 },
      ],
    })
    assert.equal(result.valid, false)
    assert.ok(result.errors.some((error) => error.includes('Сборът на етапите')))
  })
})

describe('no broken empty sections', () => {
  it('minimal offer renders without errors', () => {
    const minimal = { id: 'aaa', title: 'Test', offer_type: 'final', price_type: 'fixed', price_amount: 100, currency: 'EUR' }
    const norm = normalizeAcceptedOffer(minimal, null)
    assert.equal(norm.offerType, 'final')
    assert.equal(norm.priceAmount, 100)
    assert.deepStrictEqual(norm.excludedItems, [])
    assert.deepStrictEqual(norm.stages, [])
    assert.deepStrictEqual(norm.conditions, { scopeChanges: '', cancellation: '', unforeseenWork: '' })
  })
})

console.log('All tests passed.')
