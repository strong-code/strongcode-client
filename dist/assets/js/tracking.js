// Shipment tracking widget.
// NOTE: jQuery is intentionally not imported here (main.js loads it first)
// so this module can be imported in Node for testing detectCarrier().

const CARRIERS = [
  { slug: 'ups',         name: 'UPS',       patterns: [/^1Z[0-9A-Z]{16}$/i] },
  { slug: 'usps',        name: 'USPS',      patterns: [/^(94|93|95|92)\d{20}$/, /^\d{20}$/, /^[A-Z]{2}\d{9}US$/i] },
  { slug: 'fedex',       name: 'FedEx',     patterns: [/^\d{12}$/, /^\d{15}$/, /^96\d{20}$/, /^92\d{20}$/] },
  { slug: 'dhl_express', name: 'DHL',       patterns: [/^\d{10,11}$/, /^JD\d{18}$/i] },
  { slug: 'ontrac',      name: 'OnTrac',    patterns: [/^C\d{14}$/i, /^D\d{14}$/] },
  { slug: 'lasership',   name: 'LaserShip', patterns: [/^1LS\d{12}$/i, /^LX\d{8,}$/i] }
]

let API = ''
let shipments = []
let deliveries = []

function detectCarrier(trackingNumber) {
  const tn = trackingNumber.trim().replace(/\s+/g, '')
  return CARRIERS.filter(c => c.patterns.some(p => p.test(tn)))
}

function fmtTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function fmtDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function setStatus(msg) {
  $('#trackingStatus').text(msg || '')
}

function resolvedCarrier() {
  const tn = $('#trackingNumberInput').val()
  if (!tn.trim()) return null

  const matches = detectCarrier(tn)
  if (matches.length === 1) return matches[0].slug

  const pick = $('#trackingCarrierSelect')
  return (pick.prop('hidden') ? null : pick.val()) || null
}

function updateCarrierHint() {
  const tn = $('#trackingNumberInput').val()
  const hint = $('#trackingCarrierHint')
  const pick = $('#trackingCarrierSelect')

  if (!tn.trim()) {
    hint.text('')
    pick.prop('hidden', true).empty()
  } else {
    const matches = detectCarrier(tn)

    if (matches.length === 1) {
      hint.text(`→ ${matches[0].name}`)
      pick.prop('hidden', true).empty()
    } else {
      const candidates = matches.length > 1 ? matches : CARRIERS
      hint.text(matches.length > 1 ? 'which carrier?' : 'unknown carrier — pick one:')
      pick.empty().append($('<option>').val('').text('carrier…'))
      candidates.forEach(c => pick.append($('<option>').val(c.slug).text(c.name)))
      pick.prop('hidden', false)
    }
  }
}

let adding = false

function addShipment() {
  const tn = $('#trackingNumberInput').val().trim()
  const item = $('#trackingItemInput').val().trim()
  const carrier = resolvedCarrier()
  if (!tn || !carrier || adding) return

  adding = true
  setStatus('adding…')

  $.ajax({
    url: API + '/api/track/new',
    type: 'POST',
    contentType: 'application/json',
    data: JSON.stringify({ tracking_number: tn, carrier: carrier, item: item || undefined })
  })
  .done(res => {
    adding = false
    const added = res.shipment
    const already = shipments.some(s => s.tracking_number === added.tracking_number)
    if (!already) {
      shipments.unshift(added)
      createTrackingList()
    }
    $('#trackingNumberInput').val('')
    $('#trackingItemInput').val('')
    closeAddForm()
    updateCarrierHint()
    setStatus(already ? `already tracking ${added.tracking_number}` : `added ${added.tracking_number}`)
  })
  .fail(xhr => {
    adding = false
    const err = xhr.responseJSON && xhr.responseJSON.error
    setStatus(err || 'error creating tracking entry')
    updateCarrierHint()
  })
}

function saveItem(tn, item, done) {
  $.ajax({
    url: `${API}/api/track/${encodeURIComponent(tn)}`,
    type: 'PATCH',
    contentType: 'application/json',
    data: JSON.stringify({ item: item })
  })
  .done(() => {
    const s = shipments.find(x => x.tracking_number === tn)
    if (s) s.item = item
    createTrackingList()
    setStatus('description saved')
    if (done) done()
  })
  .fail(() => setStatus('error saving description'))
}

function removeShipment(tn) {
  $.ajax({
    url: `${API}/api/track/${encodeURIComponent(tn)}`,
    type: 'DELETE'
  })
  .done(() => {
    shipments = shipments.filter(x => x.tracking_number !== tn)
    createTrackingList()
    setStatus(`removed ${tn}`)
  })
  .fail(xhr => {
    if (xhr.status === 404) {
      shipments = shipments.filter(x => x.tracking_number !== tn)
      createTrackingList()
      return
    }
    setStatus('error removing shipment')
  })
}

function archiveShipment(tn) {
  $.ajax({
    url: `${API}/api/track/${encodeURIComponent(tn)}`,
    type: 'PATCH',
    contentType: 'application/json',
    data: JSON.stringify({ archived: true })
  })
  .done(() => {
    shipments = shipments.filter(x => x.tracking_number !== tn)
    createTrackingList()
    setStatus(`archived ${tn}`)
  })
  .fail(() => setStatus('error archiving shipment'))
}

function toggleDetail(item, s) {
  const detail = item.find('.tracking-detail')

  if (item.hasClass('is-expanded')) {
    item.removeClass('is-expanded')
    return
  }

  item.addClass('is-expanded')
  detail.find('.tracking-history').text('loading…')

  $.get(`${API}/api/track/${encodeURIComponent(s.tracking_number)}?all=true`)
  .done(res => {
    const history = detail.find('.tracking-history').empty()

    if (!res.data || res.data.length === 0) {
      history.append($('<p>').addClass('tracking-history-empty').text('No tracking events yet.'))
      return
    }

    res.data.forEach(ev => {
      history.append(
        $('<div>').addClass('tracking-history-row')
          .append($('<span>').addClass('tracking-history-status').text(ev.status + (ev.location ? ` — ${ev.location}` : '')))
          .append($('<span>').addClass('tracking-history-time').text(fmtTime(ev.updated_at)))
      )
    })
  })
  .fail(() => detail.find('.tracking-history').text('error loading history'))
}

function editItem(row, s) {
  const title = row.find('.tracking-title')
  const current = s.item || ''
  const input = $('<input>').addClass('tracking-item-edit').attr({ type: 'text', placeholder: 'description…' }).val(current)

  title.hide().after(input)
  input.focus().select()

  let saving = false
  const finish = save => {
    if (saving) return
    saving = true
    input.remove()
    title.show()

    if (save && input.val().trim() !== current) {
      saveItem(s.tracking_number, input.val().trim())
    }
  }

  input.on('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); finish(true) }
    if (e.key === 'Escape') { finish(false) }
  })
  input.on('blur', () => finish(true))
}

const deliveredTimers = new Set()

function scheduleDeliveredRemoval(s) {
  if (!s.delivered_at || deliveredTimers.has(s.tracking_number)) return

  const expiresAt = new Date(s.delivered_at).getTime() + 24 * 60 * 60 * 1000
  const delay = expiresAt - Date.now()

  if (!Number.isFinite(delay) || delay <= 0) return

  deliveredTimers.add(s.tracking_number)
  setTimeout(() => {
    deliveredTimers.delete(s.tracking_number)
    removeShipment(s.tracking_number)
  }, delay)
}

function createTrackingList() {
  const list = $('#trackingList').empty()
  $('#trackingEmpty').toggle(shipments.length === 0)

  shipments.forEach(s => {
    const delivered = !!s.delivered || String(s.status || '').toUpperCase() === 'DELIVERED'
    const title = s.item || `${s.carrier.toUpperCase()} ${s.tracking_number.slice(-6)}`
    const statusLine = s.status
      ? s.status + (s.location ? ` — ${s.location}` : '')
      : 'Awaiting first carrier update'

    const row = $('<div>').addClass('tracking-row')

    const titleBtn = $('<button>').addClass('tracking-title').attr({ type: 'button' })
      .append($('<span>').addClass('tracking-chevron').text('>'))
      .append($('<span>').addClass('tracking-title-text').text(title))
      .on('click', e => toggleDetail($(e.currentTarget).closest('.tracking-item'), s))

    const noteBtn = $('<button>').addClass('tracking-note').attr({ type: 'button', 'aria-label': 'Edit description' })
      .toggleClass('has-note', !!s.item)
      .attr('data-note', s.item || 'add a description')
      .text('✎')
      .on('click', e => editItem($(e.currentTarget).closest('.tracking-row'), s))

    const deleteBtn = $('<button>').addClass('tracking-delete').attr({ type: 'button', 'aria-label': 'Delete shipment' })
      .text('x')
      .on('click', () => removeShipment(s.tracking_number))

    const dismissBtn = $('<button>').addClass('tracking-dismiss').attr({ type: 'button', 'aria-label': 'Remove delivered shipment', title: 'Remove delivered shipment' })
      .text('✓')
      .on('click', () => removeShipment(s.tracking_number))

    row.append(titleBtn, noteBtn, delivered ? dismissBtn : deleteBtn)

    const sub = $('<div>').addClass('tracking-subline')
      .append(document.createTextNode(statusLine))

    if (s.eta) {
      sub.append(document.createTextNode(' · '))
      sub.append($('<span>')
        .addClass('tracking-eta')
        .toggleClass('is-delivered', delivered)
        .text(`ETA ${fmtDate(s.eta)}`))
    }

    const detail = $('<div>').addClass('tracking-detail')
      .append($('<div>').addClass('tracking-history'))

    if (!delivered) {
      const archiveBtn = $('<button>').addClass('tracking-action tracking-archive').attr('type', 'button')
        .text('archive')
        .on('click', () => archiveShipment(s.tracking_number))
      detail.append(archiveBtn)
    }

    list.append($('<article>').addClass('tracking-item').toggleClass('is-delivered', delivered).append(row, sub, detail))

    if (delivered) scheduleDeliveredRemoval(s)
  })
}

function toggleTracking() {
  const widget = $('#trackingWidget')
  widget.prop('hidden', !widget.prop('hidden'))
}

function openAddForm() {
  $('#trackingAddForm').prop('hidden', false)
  $('#trackingAddBtn').addClass('is-open')
  $('#trackingNumberInput').focus()
}

function closeAddForm() {
  $('#trackingAddForm').prop('hidden', true)
  $('#trackingAddBtn').removeClass('is-open')
}

function toggleAddForm() {
  const form = $('#trackingAddForm')

  if (form.prop('hidden')) {
    openAddForm()
    return
  }

  const tn = $('#trackingNumberInput').val().trim()
  const carrier = resolvedCarrier()

  if (tn && carrier) {
    addShipment()
  } else {
    closeAddForm()
  }
}

function renderDeliveries() {
  const box = $('#trackingDeliveries').empty()

  deliveries.forEach(d => {
    const title = d.item || `${d.carrier.toUpperCase()} ${String(d.tracking_number).slice(-6)}`
    const history = $('<div>').addClass('tracking-delivery-history')

    const row = $('<div>').addClass('tracking-delivery-row')
      .append($('<span>').addClass('tracking-delivery-chevron').text('›'))
      .append($('<span>').addClass('tracking-delivery-title').text(title))
      .append($('<span>').addClass('tracking-delivery-date').text(fmtDate(d.delivered_at)))
      .on('click', () => {
        const expanded = row.toggleClass('is-expanded').hasClass('is-expanded')

        if (!expanded) {
          history.hide()
          return
        }

        if (history.children().length) {
          history.show()
          return
        }

        history.append($('<p>').addClass('tracking-history-empty').text('loading…')).show()
        $.get(`${API}/api/track/${encodeURIComponent(d.tracking_number)}?all=true`)
        .done(res => {
          history.empty()
          if (!res.data || res.data.length === 0) {
            history.append($('<p>').addClass('tracking-history-empty').text('No tracking events yet.'))
            return
          }
          res.data.forEach(ev => {
            history.append(
              $('<div>').addClass('tracking-history-row')
                .append($('<span>').addClass('tracking-history-status').text(ev.status + (ev.location ? ` — ${ev.location}` : '')))
                .append($('<span>').addClass('tracking-history-time').text(fmtTime(ev.updated_at)))
            )
          })
        })
        .fail(() => {
          history.empty().append($('<p>').addClass('tracking-history-empty').text('error loading history'))
        })
      })

    box.append(row, history)
  })
}

function toggleDeliveries() {
  const box = $('#trackingDeliveries')
  const open = box.prop('hidden')

  if (open) {
    renderDeliveries()
    box.prop('hidden', false)
  } else {
    box.prop('hidden', true)
  }
  $('#trackingDeliveriesBtn').toggleClass('is-open', open)
}

function initTracking(host) {
  API = host

  $('#trackingClose').on('click', () => $('#trackingWidget').prop('hidden', true))
  $('#trackingAddForm').on('submit', e => { e.preventDefault(); addShipment() })
  $('#trackingAddBtn').on('click', toggleAddForm)
  $('#trackingNumberInput').on('input', updateCarrierHint)
  $('#trackingDeliveriesBtn').on('click', toggleDeliveries)

  $.get(API + '/api/track/active')
  .done(res => {
    shipments = res || []
    createTrackingList()
    if (shipments.length > 0) {
      $('#trackingWidget').prop('hidden', false)
    }
  })
  .fail(() => setStatus('could not load shipments'))

  $.get(API + '/api/track/deliveries')
  .done(res => {
    deliveries = (res && res.deliveries) || []
    if (deliveries.length > 0) {
      $('#trackingDeliveriesBtn').prop('hidden', false)
    }
  })
}

export { initTracking, toggleTracking, detectCarrier }
