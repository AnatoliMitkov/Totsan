import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildOrderActions,
  buildOrderListItem,
  buildOrderWorkspace,
  checkoutPathForOrder,
  groupOrderListItems,
  milestoneNextStep,
  selectCurrentMilestone,
} from '../lib/order-workspace.js'

describe('order workspace view model', () => {
  it('selects the first non-terminal milestone and falls back to the last completed one', () => {
    const milestones = [
      { id: 'one', status: 'accepted' },
      { id: 'two', status: 'cancelled' },
      { id: 'three', status: 'ready' },
      { id: 'four', status: 'pending' },
    ]
    assert.equal(selectCurrentMilestone(milestones)?.id, 'three')
    assert.equal(selectCurrentMilestone(milestones.slice(0, 2))?.id, 'two')
    assert.equal(selectCurrentMilestone([]), null)
  })

  it('builds milestone progress without changing the source collection', () => {
    const milestones = [
      { id: 'one', status: 'accepted' },
      { id: 'two', status: 'submitted' },
    ]
    const workspace = buildOrderWorkspace({ order: { status: 'in_progress' }, milestones, role: 'client' })
    assert.equal(workspace.currentMilestone.id, 'two')
    assert.equal(workspace.acceptedCount, 1)
    assert.equal(workspace.totalCount, 2)
    assert.match(workspace.nextStep, /Прегледай предадения етап/)
    assert.equal(milestones.length, 2)
  })

  it('keeps staged order actions on milestone level', () => {
    const order = { status: 'pending_payment', paymentMethod: 'staged_platform', offerId: 'offer-1' }
    assert.deepEqual(buildOrderActions(order, 'client', ''), [])
    assert.equal(checkoutPathForOrder(order), '')
  })

  it('preserves client and partner order-level action rules', () => {
    assert.deepEqual(buildOrderActions({ status: 'pending_payment', paymentMethod: 'custom' }, 'partner', ''), ['confirm_direct_payment'])
    assert.deepEqual(buildOrderActions({ status: 'paid', paymentMethod: 'platform' }, 'partner', ''), ['start_work'])
    assert.deepEqual(buildOrderActions({ status: 'in_progress', paymentMethod: 'platform' }, 'partner', ''), ['mark_delivered'])
    assert.deepEqual(buildOrderActions({ status: 'delivered', paymentMethod: 'platform' }, 'client', ''), ['confirm_completed', 'request_revision'])
    assert.deepEqual(buildOrderActions({ status: 'pending_payment', paymentMethod: 'platform' }, 'client', '/checkout/offer/one'), ['cancel_pending'])
  })

  it('provides role-specific milestone guidance', () => {
    assert.match(milestoneNextStep({ status: 'ready' }, 'client'), /Плати този етап/)
    assert.match(milestoneNextStep({ status: 'ready' }, 'partner'), /Изчакай клиентът/)
    assert.match(milestoneNextStep({ status: 'submitted' }, 'client'), /Прегледай предадения етап/)
    assert.match(milestoneNextStep({ status: 'submitted' }, 'partner'), /Изчакай клиента/)
  })

  it('puts only supported user actions at the top of the orders list', () => {
    const clientPayment = buildOrderListItem({
      order: { id: 'order-1', status: 'pending_payment', paymentMethod: 'platform', offerId: 'offer-1' },
      role: 'client',
    })
    const partnerWaits = buildOrderListItem({
      order: { id: 'order-1', status: 'pending_payment', paymentMethod: 'platform', offerId: 'offer-1' },
      role: 'partner',
    })
    const clientReview = buildOrderListItem({
      order: { id: 'order-2', status: 'in_progress' },
      milestones: [{ id: 'milestone-2', position: 2, title: 'Концепция', status: 'submitted' }],
      role: 'client',
    })

    assert.deepEqual(clientPayment.primaryAction, { label: 'Плати', to: '/checkout/offer/offer-1' })
    assert.equal(clientPayment.group, 'action')
    assert.equal(partnerWaits.group, 'active')
    assert.equal(partnerWaits.primaryAction, null)
    assert.match(partnerWaits.nextStep, /Клиентът трябва да завърши плащането/)
    assert.deepEqual(clientReview.primaryAction, { label: 'Прегледай предадения етап', to: '/order/order-2' })
  })

  it('prioritizes action cards and then uses the latest update inside each group', () => {
    const groups = groupOrderListItems([
      { group: 'active', updatedAt: '2026-07-10T10:00:00Z' },
      { group: 'action', updatedAt: '2026-07-09T10:00:00Z' },
      { group: 'active', updatedAt: '2026-07-11T10:00:00Z' },
      { group: 'history', updatedAt: '2026-07-12T10:00:00Z' },
    ])
    assert.equal(groups.action.length, 1)
    assert.equal(groups.active[0].updatedAt, '2026-07-11T10:00:00Z')
    assert.equal(groups.history.length, 1)
  })

  it('does not invent an action for a legacy staged order without milestones', () => {
    const item = buildOrderListItem({
      order: { id: 'legacy-staged', status: 'pending_payment', paymentMethod: 'staged_platform' },
      role: 'partner',
    })
    assert.equal(item.group, 'active')
    assert.equal(item.primaryAction, null)
    assert.match(item.nextStep, /по етапи/)
  })
})
