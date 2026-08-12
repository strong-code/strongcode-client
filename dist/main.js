import './assets/js/jquery-3.5.1.min.js'
import './assets/js/paste.js'
import { initSearch } from './assets/js/search.js'
import { initTracking, toggleTracking } from './assets/js/tracking.js'
const HOST = (window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://strongco.de')

$('body').ready(() => {
  if (window.location.hostname === 'localhost') {
    $('#welcomeMsg').text('L O C A L H O S T')
  }

  initLinks()
  initPaste()
  initSearch()
  initHealth()
  initBuildInfo()
  initKeyHandlers()
  initWeather()
  initDarkmode()
  initNotes()
  initTracking(HOST)
})

$('.header-container').ready(() => {
  initDate()
})

const SAN_DIEGO = { lat: 32.7157, lng: -117.1611 }

function getCookie(name) {
  const match = document.cookie.split('; ').find(c => c.indexOf(name + '=') === 0)
  return match ? match.slice(name.length + 1) : null
}

function applyTheme(dark) {
  if (dark) {
    $('html').attr('data-theme', 'dark')
    $('.icon').each((i, node) => {
      $(node).addClass('dark-theme')
    })
    $('#darkmodeToggle').addClass('dark-theme').attr('src', 'assets/icons/lightmode.png')
  } else {
    $('html').attr('data-theme', 'light')
    $('.icon').each((i, node) => {
      $(node).removeClass('dark-theme')
    })
    $('#darkmodeToggle').removeClass('dark-theme').attr('src', 'assets/icons/darkmode.png')
  }
}

function getCurrentLocation() {
  return new Promise(resolve => {
    $.getJSON('https://ipwho.is/')
      .done(data => {
        if (data && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
          resolve({ lat: data.latitude, lng: data.longitude })
        } else {
          resolve(SAN_DIEGO)
        }
      })
      .fail(() => resolve(SAN_DIEGO))
  })
}

function getSunTimes(lat, lng) {
  return new Promise(resolve => {
    $.getJSON(`https://api.sunrise-sunset.org/json?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&formatted=0`)
      .done(data => {
        if (!data || !data.results || !data.results.sunrise || !data.results.sunset) return resolve(null)
        const sunrise = new Date(data.results.sunrise)
        const sunset = new Date(data.results.sunset)
        if (Number.isNaN(sunrise.getTime()) || Number.isNaN(sunset.getTime())) return resolve(null)
        resolve({ sunrise, sunset })
      })
      .fail(() => resolve(null))
  })
}

$('.theme-toggle').click(() => {
  const dark = $('html').attr('data-theme') !== 'dark'
  const date = new Date()
  date.setTime(date.getTime() + (10 * 365 * 24 * 60 * 60))
  applyTheme(dark)
  document.cookie = `darkmode=${dark ? 'on' : 'off'}; expires=${date.toGMTString()}; path=/`
})

function initDarkmode() {
  const cookie = getCookie('darkmode')
  if (cookie === 'on') return applyTheme(true)
  if (cookie === 'off') return applyTheme(false)

  getCurrentLocation().then(loc => getSunTimes(loc.lat, loc.lng))
    .then(times => {
      if (!times) return
      const now = new Date()
      applyTheme(now < times.sunrise || now > times.sunset)
    })
}

function initKeyHandlers() {
  $('body').keypress(ev => {
    if ($(ev.target).is('input, textarea, select, [contenteditable="true"]'))
      return

    switch (ev.key) {
      case 'g':
        $('#gallery').toggle()
        createPasteList()
        createPasteButtons()
        break
      case '?':
        $('#footer').toggle()
        break
      case 't':
        toggleTracking()
        break
      case 'n':
        $('#addNote').trigger('click')
        break
    }
  })

  $('body').keydown(ev => {
    if (ev.ctrlKey && ev.key === 'Enter' && $(ev.target).is('textarea')) {
      ev.preventDefault()
      $(ev.target).closest('.note-item').find('.note-title').trigger('click')
    }
  })
}

function initGalleryPopup() {
  $('#paste-list a').on('mouseenter', (e) => {
    $('.popup').css({left: e.pageX-310, top: e.pageY-105}).show()

    switch (e.target.href.split('.').pop()) {
      case 'txt':
        let text = $.ajax({ type: "GET", url: e.target.href, async: false }).responseText
        $('.popup').html(text).css({overflow: 'hidden'})
        break;
      default: // any image
        $('.popup').html(`<img src="${e.target.href}">`)
    }

    $('#paste-list a').on('mouseleave', () => { $('.popup').hide() })
  })
}

function createPasteButtons() {
  const btn = $('#older')

  btn.click(() => {
    let batch = parseInt($('#older').attr('batch')) + 1
    btn.attr({'batch': batch})
    return createPasteList(batch)
  })
}

function createPasteList(batch) {
  batch = batch || 1
  const currentTheme = $('html').attr('data-theme')
  $('#paste-list').empty()

  $.get(HOST + `/api/pastes?batch=${batch}`)
  .done(res => {
    console.log(res.pastes)
    res.pastes.forEach(paste => {
      let icon = $('<img>').attr({'src': 'assets/icons/garbage.png', 'class': 'icon paste-icon'}).click(() => {
        $.ajax({
          type: 'DELETE',
          url: `${HOST}/api/paste/${paste.substr(0,6)}`
        })
        .done(res => {
          console.log(`Deleted paste ${paste}`)
          $(icon.parent()[0]).remove()
        })
        .fail(e => {
          console.log(e)
        })
      })
     
      $('#paste-list').append(
        $('<li>').append([
          icon,
          $('<a>').attr('href', `${HOST}/d/${paste}`).text(paste)
        ]))
    })

    if (currentTheme === 'dark') {
      $('.paste-icon').addClass('dark-theme')
    }

    initGalleryPopup()
  })
}

function initHealth() {
  let stat = $('#apiStatus')

  $.get(HOST + '/api/health')
  .done(res => {
    stat.text('')
    $('.header-container').removeClass('api-offline')
    $('body').removeClass('api-offline')
    $('#footer')
      .append(`Paste directory size: ${res.folderSize}`)
      .append(`<p>Total pastes: ${res.totalPastes}`)
  })
  .fail(e => {
    stat.text('API is offline')
    $('.header-container').addClass('api-offline')
    $('body').addClass('api-offline')
  })

  stat.click(() => {
    initHealth()
  })
}

function initPaste() {
  const url = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/
  const img = /^.*\.(jpg|jpeg|gif|png|webm)$/
  const c = $('.container')
  c.pastableNonInputable()
  
  c.on('pasteImage', (ev, data) => {
    let fd = new FormData()
    fd.append('file', data.blob, 'i.png')
    uploadPaste(fd)
  })
  .on('pasteText', (ev, data) => {
    if (!img.test(data.text) && url.test(data.text)) {
      shortenUrl(data.text)
    } else {
      let fd = new FormData()
      fd.append('text', data.text)
      uploadPaste(fd)
    }
  })
}

function shortenUrl(url) {
  $.ajax({
    type: 'POST',
    url: HOST + '/api/shorten',
    data: {url: url}
  })
  .done(res => {
    $('#welcomeMsg').html(`<a href="${res.url}">${res.url}</a>`)
  })
  .fail(err => {
    console.log(err)
  })
}

function uploadPaste(payload) {
  $.ajax({
    type: 'POST',
    url: HOST + '/api/paste',
    data: payload,
    processData: false,
    contentType: false
  })
  .done(res => {
    console.log('File uploaded to: ' + res.path)
    $('#welcomeMsg').html(`<a href="${res.path}">${res.path}</a>`)
    navigator.clipboard.writeText(res.path)
  })
  .fail(err => {
    console.log(err)
  })
}

function initLinks() {
  fetch('assets/links.json')
  .then(res => res.json())
  .then(json => {
    json.categories.forEach(c => {
      let category = $('#' + c.title)
      c.links.forEach(entry => {
        let str = `<a href="${entry.url}">${entry.title}</a>`
        category.append(str)
      })
    })
  })
}

function initDate() {
  const months = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"]
  
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday",
  "Friday", "Saturday"]

  let today = new Date()

  $('#dateTop')
    .text(days[today.getDay()])
    .css('font-size', '3.5rem')
    .after(`<br>${months[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`)
}

function initWeather() {
  let weather = $('#weather')
  let wg = 'https://www.wunderground.com/weather/us/ca/san-diego/KCASANDI411'

  weather.html(`<a href='${wg}'>Weather</a>`)

  $.getJSON("https://wttr.in/92101?format=j1", (data) => {
    const loc = data.nearest_area[0].areaName[0].value || "92101"

	const current = data.current_condition[0]
	const tempF = current.temp_F
	const desc = current.weatherDesc[0].value

	// Map description → emoji (wttr uses its own icons, so we approximate)
	const getIcon = (desc) => {
	  const d = desc.toLowerCase();

	  if (d.includes("sun") || d.includes("clear")) return "☀️";
	  if (d.includes("partly") || d.includes("cloud")) return "⛅";
	  if (d.includes("overcast")) return "☁️";
	  if (d.includes("rain") || d.includes("drizzle")) return "🌧️";
	  if (d.includes("thunder")) return "⛈️";
	  if (d.includes("snow")) return "❄️";
	  if (d.includes("fog") || d.includes("mist")) return "🌫️";

	  return "🌡️"; // fallback
	}

	const icon = getIcon(desc)

	const forecast = `${loc}: ${icon} +${tempF}°F`
    weather.html(`<a href='${wg}'>${forecast}</a>`)
  })

  // $.get('https://wttr.in/92101?format=3&u')
  // .done(res => {
  //   // let forecast = res.replace('+', '')
  //   weather.html(`<a href='${wg}'>${forecast}</a>`)
  // })
  // .fail(e => {
  //   console.log('Unable to fetch wttr.in weather')
  // })
}

function initBuildInfo() {
  fetch('./assets/build.json')
    .then(res => res.json())
    .then(build => {
      $('#build')
        .attr({'title': build.message})
        .append(
          `<br>build <a href="https://github.com/strong-code/strongcode-client/commit/${build.sha}">${build.sha}</a>`
        )
    })
}

function initNotes() {
  const storageKey = 'strongcode-notes'
  const widget = $('#notesWidget')
  const list = $('#notesList')
  const empty = $('#notesEmpty')
  let notes = loadNotes()
  widget.addClass('is-collapsed')
  $('#notesCollapse').attr({ 'aria-expanded': false, 'aria-label': 'Expand notes' }).text('+')

  $('#notesCollapse').click(() => {
    const collapsed = widget.toggleClass('is-collapsed').hasClass('is-collapsed')
    $('#notesCollapse')
      .attr('aria-expanded', !collapsed)
      .attr('aria-label', collapsed ? 'Expand notes' : 'Collapse notes')
      .text(collapsed ? '+' : '-')
  })

  $('#addNote').click(() => {
    const now = new Date().toISOString()
    const note = { id: Date.now().toString(), content: '', expanded: true, glow: 'none', createdAt: now, updatedAt: now }
    notes.unshift(note)
    saveNotes()
    widget.removeClass('is-collapsed')
    $('#notesCollapse').attr({ 'aria-expanded': true, 'aria-label': 'Collapse notes' }).text('-')
    renderNotes()
    list.find('textarea').first().focus()
  })

  $('#exportNotes').click(() => {
    const blob = new Blob([JSON.stringify(notes, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = $('<a>').attr({ href: url, download: 'strongcode-notes.json' })
    document.body.append(link[0])
    link[0].click()
    link.remove()
    URL.revokeObjectURL(url)
  })

  $('#importNotes').click(() => $('#notesFile').click())
  $('#notesFile').change(event => {
    const file = event.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result)
        if (!Array.isArray(imported) || imported.some(note => typeof note.content !== 'string'))
          throw new Error('Invalid notes file')
        notes = imported.map((note, index) => ({
          id: String(note.id || `${Date.now()}-${index}`),
          content: note.content,
          expanded: note.expanded !== false,
          glow: note.glow === 'yellow' ? 'yellow' : 'none',
          createdAt: note.createdAt || note.updatedAt || new Date().toISOString(),
          updatedAt: note.updatedAt || null
        }))
        saveNotes()
        renderNotes()
      } catch (error) {
        window.alert('That file does not contain valid notes.')
      }
      event.target.value = ''
    }
    reader.readAsText(file)
  })

  function loadNotes() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '[]')
      return Array.isArray(saved) ? saved.filter(note => note && typeof note.content === 'string') : []
    } catch (error) {
      return []
    }
  }

  function saveNotes() {
    localStorage.setItem(storageKey, JSON.stringify(notes))
  }

  function titleFor(content) {
    const firstSentence = content.trim().match(/^(.+?[.!?])(?:\s|$)/)
    const title = (firstSentence ? firstSentence[1] : content.trim()).replace(/\s+/g, ' ')
    return title.length > 52 ? `${title.slice(0, 49).trim()}...` : title || 'Untitled note'
  }

  function renderNotes() {
    list.empty()
    empty.toggle(notes.length === 0)
    notes.forEach((note, index) => {
      const item = $('<article>').addClass('note-item').toggleClass('is-expanded', note.expanded)
       const updatedAt = note.updatedAt || note.createdAt
       const toggle = $('<button>').addClass('note-title').attr({ type: 'button', 'aria-expanded': note.expanded })
        .append($('<span>').addClass('note-chevron').text(note.expanded ? 'v' : '>'))
        .append($('<span>').text(titleFor(note.content)))
       const remove = $('<button>').addClass('note-delete').attr({ type: 'button', 'aria-label': 'Delete note' }).text('x')
       const row = $('<div>').addClass('note-row').toggleClass('timestamp-above', index === notes.length - 1).addClass(`note-glow-${note.glow || 'none'}`).attr('data-timestamp', formatTimestamp(updatedAt)).append(toggle, remove)
      const editor = $('<div>').addClass('note-editor')
      const textarea = $('<textarea>').attr({ rows: 5, 'aria-label': 'Note text', placeholder: 'Write something...' }).val(note.content)
      const status = $('<span>').addClass('note-saved').text('saved locally')

       toggle.click(event => {
         if (event.shiftKey) {
           event.preventDefault()
           note.glow = note.glow === 'yellow' ? 'none' : 'yellow'
           saveNotes()
           row.removeClass('note-glow-none note-glow-yellow').addClass(`note-glow-${note.glow}`)
           return
         } else {
           note.expanded = !note.expanded
         }
        saveNotes()
        renderNotes()
      })
      remove.click(() => {
        notes = notes.filter(entry => entry.id !== note.id)
        saveNotes()
        renderNotes()
      })
      textarea.on('input', () => {
        note.content = textarea.val()
        note.updatedAt = new Date().toISOString()
        saveNotes()
        row.attr('data-timestamp', formatTimestamp(note.updatedAt))
        toggle.find('span:last-child').text(titleFor(note.content))
      })
      editor.append(textarea, status)
      item.append(row, editor)
      list.append(item)
    })
  }

  function formatTimestamp(value) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    const month = date.getMonth() + 1
    const day = date.getDate()
    const year = date.getFullYear()
    const hours = date.getHours() % 12 || 12
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const period = date.getHours() >= 12 ? 'pm' : 'am'
    return `${month}/${day}/${year} @ ${hours}:${minutes} ${period}`
  }

  renderNotes()
}
