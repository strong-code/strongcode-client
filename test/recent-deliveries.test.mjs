import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('../dist/assets/js/tracking.js', import.meta.url), 'utf8')

async function setup(t, initialDeliveries = []) {
  const nodes = new Map()
  const writes = []
  const active = [{ tracking_number: '123', carrier: 'ups', item: 'Recent', delivered: true, delivered_at: new Date().toISOString() }]
  let deliveries = initialDeliveries
  let timer

  function node() {
    return {
      items: [], hidden: true,
      on(event, handler) { this[event] = handler; return this },
      prop(key, value) { if (value === undefined) return this[key]; this[key] = value; return this },
      empty() { this.items = []; return this },
      append(...items) { this.items.push(...items); return this },
      text(value) { this.label = value; return this },
      addClass(value) { this.className = value; return this },
      attr() { return this }, toggle() { return this }, toggleClass() { return this }
    }
  }

  const $ = selector => {
    if (selector.startsWith('<')) return node()
    if (!nodes.has(selector)) nodes.set(selector, node())
    return nodes.get(selector)
  }
  const request = value => ({ done(fn) { fn(value); return this }, fail() { return this } })
  $.get = url => request(url.endsWith('/active') ? active : { deliveries })
  $.ajax = options => { writes.push(options); return request() }

  const globals = { $: globalThis.$, document: globalThis.document, setTimeout: globalThis.setTimeout }
  Object.assign(globalThis, { $, document: { createTextNode: text => text }, setTimeout: fn => { timer = fn } })
  t.after(() => Object.assign(globalThis, globals))

  const { initTracking } = await import(`data:text/javascript,${encodeURIComponent(source)}#${encodeURIComponent(t.name)}`)
  initTracking('https://tracking.test')
  return { $, writes, expire: () => timer(), setDeliveries: rows => { deliveries = rows } }
}

const delivery = (item, day) => ({ item, carrier: 'ups', tracking_number: item, delivered_at: `2026-11-${day}T12:00:00Z` })

test('a delivered shipment expires from the active list without a delete request', async t => {
  const { $, writes, expire } = await setup(t)
  assert.equal($('#trackingList').items.length, 1)
  expire()
  assert.equal($('#trackingList').items.length, 0)
  assert.deepEqual(writes, [])
})

test('the delivered checkmark archives rather than deleting history', async t => {
  const { $, writes } = await setup(t)
  const dismiss = $('#trackingList').items[0].items[0].items.find(x => x.className === 'tracking-dismiss')
  dismiss.click()
  assert.equal(writes[0].type, 'PATCH')
  assert.deepEqual(JSON.parse(writes[0].data), { archived: true })
  assert.equal($('#trackingList').items.length, 0)
})

test('reopening deliveries fetches the current three rows in server order', async t => {
  const { $, setDeliveries } = await setup(t, [delivery('Old', '01')])
  const button = $('#trackingDeliveriesBtn')
  const titles = () => $('#trackingDeliveries').items.filter(x => x.className === 'tracking-delivery-row').map(row => row.items[1].label)
  button.click()
  assert.deepEqual(titles(), ['Old'])
  button.click()
  setDeliveries([delivery('Newest', '26'), delivery('Second', '25'), delivery('Third', '23')])
  button.click()
  assert.deepEqual(titles(), ['Newest', 'Second', 'Third'])
})
