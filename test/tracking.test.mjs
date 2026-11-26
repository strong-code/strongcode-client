// Behaviour tests for the shipment tracking widget.
//
// These tests load the real dist/index.html and dist/assets/js/tracking.js in
// jsdom, with $.ajax replaced by a recording stub, so the wire contract and the
// rendered UI are both exercised without touching a live API.
//
// Tracking numbers below are synthetic fixtures, never real customer numbers.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { JSDOM } from 'jsdom'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const HTML = readFileSync(path.join(ROOT, 'dist/index.html'), 'utf8')
const TRACKING_SRC = readFileSync(path.join(ROOT, 'dist/assets/js/tracking.js'), 'utf8')
const require = createRequire(import.meta.url)
const jqueryPath = path.join(ROOT, 'dist/assets/js/jquery-3.5.1.min.js')

// Synthetic fixtures: OnTrac C+14 digits, UPS 1Z+16 chars.
const ONTRAC_TN = 'C12345678901234'
const UPS_TN = '1Z999AA10123456784'
const ONTRAC_URL = 'https://www.ontrac.com/tracking/?number=' + encodeURIComponent(ONTRAC_TN)

let build = 0

async function loadModule() {
  build += 1
  const src = TRACKING_SRC + `\n// test build ${build}\n`
  const url = 'data:text/javascript;base64,' + Buffer.from(src, 'utf8').toString('base64')
  return import(url)
}

const tick = () => new Promise(resolve => setTimeout(resolve, 0))

async function setup({ active = [] } = {}) {
  const dom = new JSDOM(HTML, { url: 'http://localhost:3001/' })
  global.window = dom.window
  global.document = dom.window.document

  delete require.cache[jqueryPath]
  const $ = require(jqueryPath)
  dom.window.$ = dom.window.jQuery = $
  global.$ = global.jQuery = $

  const calls = []
  $.ajax = opts => {
    const deferred = $.Deferred()
    calls.push({
      url: opts.url,
      method: (opts.type || 'GET').toUpperCase(),
      contentType: opts.contentType || null,
      raw: opts.data === undefined ? undefined : opts.data,
      body: typeof opts.data === 'string' ? JSON.parse(opts.data) : opts.data === undefined ? undefined : opts.data,
      resolve: data => deferred.resolve(data),
      fail: (status, json) => deferred.reject({ status, responseJSON: json })
    })
    return deferred
  }

  const tracking = await loadModule()
  tracking.initTracking('http://api.test')

  const activeCall = calls.find(c => c.url === 'http://api.test/api/track/active')
  assert.ok(activeCall, 'init should request the active shipment list')
  activeCall.resolve(active)
  await tick()

  return { $, dom, calls }
}

const newCalls = calls => calls.filter(c => c.url === 'http://api.test/api/track/new')
const rowFor = ($, tn) => $('.tracking-item').filter((_, el) => $(el).find('.tracking-tn').length > 0 && $(el).text().includes(tn.slice(-6)))

function submitAdd($, tn, item) {
  $('#trackingAddBtn').trigger('click')
  $('#trackingNumberInput').val(tn).trigger('input')
  if (item) $('#trackingItemInput').val(item).trigger('input')
  $('#trackingAddForm').trigger('submit')
}

test('normal add sends one plain request and renders the shipment', async () => {
  const { $, calls } = await setup()
  submitAdd($, UPS_TN, 'usb cable')

  const posted = newCalls(calls)
  assert.equal(posted.length, 1, 'exactly one add request')
  assert.equal(posted[0].method, 'POST')
  assert.deepEqual(posted[0].body, {
    tracking_number: UPS_TN,
    carrier: 'ups',
    item: 'usb cable'
  }, 'normal add payload is unchanged: no tracking_mode is sent')
  assert.equal('tracking_mode' in posted[0].body, false)

  posted[0].resolve({ msg: 'created', shipment: { tracking_number: UPS_TN, carrier: 'ups', item: 'usb cable' } })
  await tick()

  assert.equal($('#trackingAddForm').prop('hidden'), true, 'form closes after a successful add')
  assert.equal($('#trackingList .tracking-item').length, 1)
  assert.match($('#trackingList').text(), /usb cable/)
  assert.match($('#trackingStatus').text(), new RegExp(UPS_TN))
  assert.doesNotMatch($('#trackingList').text(), /automatic updates/i, 'normal shipments carry no link-only label')
  assert.doesNotMatch($('#trackingStatus').text(), /aren.t available/i)
})

test('link-only shipment is saved by the single normal add and shows an in-app notice', async () => {
  const { $, calls } = await setup()
  submitAdd($, ONTRAC_TN, 'torque wrench')

  const posted = newCalls(calls)
  assert.equal(posted.length, 1, 'one request only — no opt-in and no second request')
  assert.deepEqual(posted[0].body, {
    tracking_number: ONTRAC_TN,
    carrier: 'ontrac',
    item: 'torque wrench'
  })

  posted[0].resolve({
    msg: 'created',
    shipment: {
      tracking_number: ONTRAC_TN,
      carrier: 'ontrac',
      item: 'torque wrench',
      tracking_mode: 'link_only'
    }
  })
  await tick()

  // Saved, not rejected: the entry is in the active list and the form closed.
  assert.equal($('#trackingAddForm').prop('hidden'), true)
  assert.equal($('#trackingList .tracking-item').length, 1)
  assert.match($('#trackingList').text(), /torque wrench/)

  // In-app notice explains the missing live updates.
  const status = $('#trackingStatus').text()
  assert.match(status, /saved/i)
  assert.match(status, /aren.t available/i)
  assert.match(status, /ontrac/i)

  // The row is labelled as link-only and the tracking number stays the single affordance.
  assert.match($('#trackingList').text(), /no automatic updates/i)
  assert.equal(newCalls(calls).length, 1, 'no follow-up request after saving')
  assert.equal($('#trackingList a').length, 0, 'no extra link is added to the row')
  assert.equal($('#trackingList button').filter((_, el) => /track/i.test($(el).text())).length, 0,
    'no redundant "track" button is added')

  // Expanding shows an explanation and never polls the API for events.
  $('.tracking-title').first().trigger('click')
  await tick()
  assert.equal(calls.filter(c => c.url.includes('/api/track/' + ONTRAC_TN)).length, 0,
    'no history fetch for a link-only entry')
  assert.equal(calls.length, 2, 'initial active-list request plus the single add request')
  assert.match($('.tracking-detail').text(), /no automatic updates/i)
})

test('link-only entries from the active list render the canonical OnTrac link on the existing number control', async () => {
  const { $, calls } = await setup({
    active: [{
      tracking_number: ONTRAC_TN,
      carrier: 'ontrac',
      item: 'impact driver',
      tracking_mode: 'link_only'
    }]
  })

  assert.equal($('#trackingWidget').prop('hidden'), false, 'widget opens when shipments exist')
  assert.equal($('#trackingList .tracking-item').length, 1)
  assert.match($('#trackingList').text(), /impact driver/)
  assert.match($('#trackingList').text(), /no automatic updates/i)
  assert.equal($('#trackingList a').length, 0, 'no link is rendered inline')

  // Existing "show tracking number" control carries the canonical carrier URL.
  $('#trackingList .tracking-tn').first().trigger('click')
  const link = $('#trackingList .tracking-tn-popover a')
  assert.equal(link.length, 1)
  assert.equal(link.text(), ONTRAC_TN)
  assert.equal(link.attr('href'), ONTRAC_URL)
  assert.equal(link.attr('target'), '_blank')

  // Still no hidden polling for a link-only entry.
  $('.tracking-title').first().trigger('click')
  await tick()
  assert.equal(calls.length, 1, 'expanding a link-only entry makes no API call')
})

test('normal shipments keep their history behaviour and label', async () => {
  const { $, calls } = await setup({
    active: [{
      tracking_number: UPS_TN,
      carrier: 'ups',
      item: 'monitor arm',
      status: 'In Transit',
      location: 'San Diego, CA'
    }]
  })

  assert.doesNotMatch($('#trackingList').text(), /no automatic updates/i)
  assert.match($('#trackingList').text(), /In Transit/)

  $('.tracking-title').first().trigger('click')
  await tick()

  const historyCall = calls.find(c => c.url.startsWith(`http://api.test/api/track/${UPS_TN}`))
  assert.ok(historyCall, 'timeline shipments still fetch their history')
  assert.match(historyCall.url, /\?all=true$/)

  historyCall.resolve({ data: [] })
  await tick()
  assert.match($('.tracking-history').text(), /no tracking events/i)
})

test('a plain 422 stays an honest failure with a single request', async () => {
  const { $, calls } = await setup()
  submitAdd($, ONTRAC_TN)

  const posted = newCalls(calls)
  assert.equal(posted.length, 1)
  posted[0].fail(422, { error: 'carrier rejected the number' })
  await tick()

  assert.equal(newCalls(calls).length, 1, 'a 422 never triggers a retry')
  assert.equal($('#trackingList .tracking-item').length, 0)
  assert.equal($('#trackingStatus').text(), 'carrier rejected the number')
  assert.equal($('#trackingAddForm').prop('hidden'), false, 'form stays open so the user can correct it')
})

test('server errors and network failures are reported without a retry', async () => {
  const { $, calls } = await setup()
  submitAdd($, ONTRAC_TN, 'router')

  const failing = newCalls(calls)[0]
  failing.fail(500, { error: 'boom' })
  await tick()

  assert.equal(newCalls(calls).length, 1)
  assert.equal($('#trackingStatus').text(), 'boom')
  assert.equal($('#trackingList .tracking-item').length, 0)

  // A connection drop (no responseJSON) falls back to the generic message.
  submitAdd($, ONTRAC_TN, 'router')
  const second = newCalls(calls)[1]
  second.fail(0, undefined)
  await tick()
  assert.equal($('#trackingStatus').text(), 'error creating tracking entry')
  assert.equal(newCalls(calls).length, 2, 'each attempt is exactly one request')
})

test('tracking numbers are URL-encoded in the canonical link', async () => {
  const { $ } = await setup({
    active: [{
      tracking_number: 'c12345678901234',
      carrier: 'ontrac',
      tracking_mode: 'link_only'
    }]
  })

  $('#trackingList .tracking-tn').first().trigger('click')
  assert.equal(
    $('#trackingList .tracking-tn-popover a').attr('href'),
    'https://www.ontrac.com/tracking/?number=' + encodeURIComponent('c12345678901234')
  )
})
