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
    shipments.unshift(res.shipment)
    createTrackingList()
    $('#trackingNumberInput').val('')
    $('#trackingItemInput').val('')
    closeAddForm()
    updateCarrierHint()
    setStatus(`added ${res.shipment.tracking_number}`)
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
  .fail(() => setStatus('error removing shipment'))
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

function createTrackingList() {
  const list = $('#trackingList').empty()
  $('#trackingEmpty').toggle(shipments.length === 0)

  shipments.forEach(s => {
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

    row.append(titleBtn, noteBtn, deleteBtn)

    const sub = $('<div>').addClass('tracking-subline')
      .text(statusLine + (s.eta ? ` · ETA ${fmtDate(s.eta)}` : ''))

    const archiveBtn = $('<button>').addClass('tracking-action tracking-archive').attr('type', 'button')
      .text('archive')
      .on('click', () => archiveShipment(s.tracking_number))

    const detail = $('<div>').addClass('tracking-detail')
      .append($('<div>').addClass('tracking-history'))
      .append(archiveBtn)

    list.append($('<article>').addClass('tracking-item').append(row, sub, detail))
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

function initTracking(host) {
  API = host

  $('#trackingClose').on('click', () => $('#trackingWidget').prop('hidden', true))
  $('#trackingAddForm').on('submit', e => { e.preventDefault(); addShipment() })
  $('#trackingAddBtn').on('click', toggleAddForm)
  $('#trackingNumberInput').on('input', updateCarrierHint)

  $.get(API + '/api/track/active')
  .done(res => {
    shipments = res || []
    createTrackingList()
    if (shipments.length > 0) {
      $('#trackingWidget').prop('hidden', false)
    }
  })
  .fail(() => setStatus('could not load shipments'))
}

export { initTracking, toggleTracking, detectCarrier }
