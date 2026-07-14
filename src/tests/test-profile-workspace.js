import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { buildPartnerOverviewAction, PARTNER_WORKSPACE_NAV } from '../lib/profile-workspace.js'

test('partner overview prioritizes payment and subscription problems', () => {
  const payment = buildPartnerOverviewAction({ paymentState: { status: 'error', message: 'Проблем' } })
  assert.equal(payment.kind, 'problem')
  assert.equal(payment.target, 'payments')

  const subscription = buildPartnerOverviewAction({ subscriptionState: { status: 'error', message: 'Проблем' } })
  assert.equal(subscription.kind, 'problem')
  assert.equal(subscription.target, 'subscription')
})

test('partner overview selects new inquiry before profile completion', () => {
  const action = buildPartnerOverviewAction({
    dashboardState: { inquiries: [{ id: 'new', status: 'new', name: 'Клиент' }] },
    completion: { percent: 20 },
    preview: { isPublished: false },
  })
  assert.equal(action.kind, 'inquiry')
  assert.equal(action.inquiry.id, 'new')
})

test('partner overview falls back to profile work and then ready state', () => {
  const profile = buildPartnerOverviewAction({
    completion: { percent: 80 },
    preview: { isPublished: true },
    nextSteps: [{ tab: 'portfolio', title: 'Добавете проект', cta: 'Към портфолиото' }],
  })
  assert.equal(profile.kind, 'profile')
  assert.equal(profile.target, 'portfolio')

  const ready = buildPartnerOverviewAction({ completion: { percent: 100 }, preview: { isPublished: true } })
  assert.equal(ready.kind, 'ready')
  assert.equal(ready.target, 'inquiries')
  assert.equal(ready.eyebrow, 'Най-важно сега')
})

test('partner workspace navigation keeps the existing tabs in task-first groups', () => {
  assert.deepEqual(PARTNER_WORKSPACE_NAV.map((group) => group.id), ['work', 'profile', 'account'])
  assert.deepEqual(PARTNER_WORKSPACE_NAV.flatMap((group) => group.tabIds), [
    'overview',
    'orders',
    'inquiries',
    'profile',
    'layer01',
    'portfolio',
    'services',
    'materials',
    'contact',
    'security',
  ])
})

test('partner workspace keeps the existing payment, subscription and save contracts', async () => {
  const source = await readFile(new URL('../components/profile/PartnerProfileWorkspace.jsx', import.meta.url), 'utf8')
  for (const contract of [
    'startPaymentOnboarding',
    'openSubscriptionPortal',
    'cancelSubscriptionAtPeriodEnd',
    'saveProfile',
    'savePortfolio',
    'ProfileWorkspaceShell',
  ]) {
    assert.match(source, new RegExp(`\\b${contract}\\b`))
  }
})

test('desktop profile navigation relies on page scrolling instead of an internal scrollbar', async () => {
  const source = await readFile(new URL('../components/profile/ProfileWorkspaceShell.jsx', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /<aside[^>]+overflow-y-(?:auto|scroll)/)
})
