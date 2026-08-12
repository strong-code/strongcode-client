import './jquery-3.5.1.min.js'

const OC_HOST = 'http://127.0.0.1:4096'
const SESSION_KEY = 'strongcode-oc-session'
const SESSION_TITLE = 'chat'
const COMPACT_EVERY = 20

let chatSessionId = null
let queryCount = 0
let inFlight = false

function fetchJson(path, options) {
  return fetch(OC_HOST + path, options).then(res => {
    if (!res.ok) throw new Error(`opencode http ${res.status}`)
    return res.json()
  })
}

async function ensureSession() {
  if (chatSessionId) return chatSessionId

  const cached = localStorage.getItem(SESSION_KEY)
  if (cached) {
    try {
      await fetchJson(`/session/${cached}`)
      chatSessionId = cached
      return chatSessionId
    } catch (e) {
      localStorage.removeItem(SESSION_KEY)
    }
  }

  const sessions = await fetchJson('/session')
  const existing = sessions.find(s => s.title === SESSION_TITLE)
  if (existing) {
    chatSessionId = existing.id
  } else {
    const created = await fetchJson('/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: SESSION_TITLE })
    })
    chatSessionId = created.id
  }
  localStorage.setItem(SESSION_KEY, chatSessionId)
  return chatSessionId
}

function extractText(parts) {
  return (parts || [])
    .filter(p => p.type === 'text' && p.text)
    .map(p => p.text)
    .join('\n')
}

async function maybeCompact() {
  queryCount++
  if (queryCount < COMPACT_EVERY) return
  queryCount = 0
  try {
    const cfg = await fetchJson('/config/providers')
    const defaults = cfg.default || {}
    const providerID = Object.keys(defaults)[0]
    if (!providerID) return
    await fetchJson(`/session/${chatSessionId}/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerID, modelID: defaults[providerID], auto: true })
    })
  } catch (e) {
    // best-effort; built-in auto-compaction still runs server-side
  }
}

async function sendToOpenCode(query) {
  if (inFlight || !query) return
  inFlight = true
  const box = $('#ocResult')
  const user = $('<div>').addClass('oc-msg oc-user').text(query)
  const reply = $('<div>').addClass('oc-msg oc-assistant oc-thinking').text('thinking…')
  box.append(user, reply)
  scrollChat(box)
  try {
    const sessionID = await ensureSession()
    const message = await fetchJson(`/session/${sessionID}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent: 'ask', parts: [{ type: 'text', text: query }] })
    })
    reply.removeClass('oc-thinking').text(extractText(message.parts) || '(no response)')
    maybeCompact()
  } catch (e) {
    reply.removeClass('oc-thinking').text('opencode server offline')
  } finally {
    inFlight = false
    scrollChat(box)
  }
}

function scrollChat(box) {
  const node = box[0]
  if (node) node.scrollTop = node.scrollHeight
}

async function getOpenCodeHealth() {
  try {
    const [health, provider] = await Promise.all([
      fetchJson('/global/health'),
      fetchJson('/provider')
    ])
    const providers = provider.connected || []
    let defaultModel = null
    try {
      const cfg = await fetchJson('/config/providers')
      const defaults = cfg.default || {}
      const providerID = Object.keys(defaults)[0]
      if (providerID) defaultModel = `${providerID}/${defaults[providerID]}`
    } catch (e) {}
    return { online: true, version: health.version || null, providers, defaultModel }
  } catch (e) {
    return { online: false, version: null, providers: [], defaultModel: null }
  }
}

function initOpenCode() {
  ensureSession().catch(() => {})
}

export { initOpenCode, sendToOpenCode, getOpenCodeHealth }
