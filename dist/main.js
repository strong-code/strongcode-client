import './assets/js/jquery-3.5.1.min.js'
import './assets/js/paste.js'
import { initSearch } from './assets/js/search.js'
let API_URL = 'http://strongco.de/api'
const PASTE_URL = 'http://strongco.de/d'

$('body').ready(() => {
  if (window.location.hostname === 'localhost') {
    API_URL = `${window.location.origin}/api`
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
})

$('.header-container').ready(() => {
  initDate()
})

$('#darkmodeToggle').click(() => {
  const currentTheme = $('html').attr('data-theme')
  const date = new Date()
  date.setTime(date.getTime() + (10 * 365 * 24 * 60 * 60))

  // lights on
  if (currentTheme === 'dark') {
    $('.dark-theme').each((i, node) => {
      $(node).removeClass('dark-theme')
    })
    $('html').attr('data-theme', 'light')
    document.cookie = `darkmode=off; expires=${date.toGMTString()}; path=/` 
  } else {
    // lights off
    $('html').attr('data-theme', 'dark')
    $('.icon').each((i, node) => {
      $(node).addClass('dark-theme')
    })
    $('#darkmodeToggle').addClass('dark-theme')
    document.cookie = `darkmode=on; expires=${date.toGMTString()}; path=/` 
  }
})

function initDarkmode() {
  if (document.cookie === 'darkmode=on') {
    $('html').attr('data-theme', 'dark')
    $('.icon').each((i, node) => {
      $(node).addClass('dark-theme')
    })
    $('#darkmodeToggle').addClass('dark-theme')
  }
}

function initKeyHandlers() {
  $('body').keypress(ev => {
    if ($('#searchBar').is(':focus')) 
      return

    switch (ev.key) {
      case 'g':
        $('#gallery').toggle()
        createPasteList()
        break
      case '?':
        $('#footer').toggle()
        break
    }
  })
}

function createPasteList() {
  const currentTheme = $('html').attr('data-theme')
  $('#paste-list').empty()

  $.get(API_URL + '/pastes')
  .done(res => {
    res.pastes.forEach(paste => {
      let icon = $('<img>').attr({'src': 'assets/icons/garbage.png', 'class': 'icon paste-icon'}).click(() => {
        $.ajax({
          type: 'DELETE',
          url: `${API_URL}/paste/${paste.substr(0,6)}`
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
          $('<a>').attr('href', `${PASTE_URL}/${paste}`).text(paste)
        ]))
    })

    if (currentTheme === 'dark') {
      $('.paste-icon').addClass('dark-theme')
    }
  })
}

function initHealth() {
  let stat = $('#apiStatus')

  $.get(API_URL + '/health')
  .done(res => {
    stat.text('')
    $('#footer').text(`Paste directory size: ${res.folderSize}`)
  })
  .fail(e => {
    stat.text('API is offline').css('color', 'red').css('font-weight', 'bold')
  })

  stat.click(() => {
    initHealth()
  })
}

function initPaste() {
  const c = $('.container')
  c.pastableNonInputable()
  
  c.on('pasteImage', (ev, data) => {
    let fd = new FormData()
    fd.append('file', data.blob, 'i.png')
    uploadPaste(fd)
  })
  .on('pasteText', (ev, data) => {
    let fd = new FormData()
    fd.append('text', data.text)
    uploadPaste(fd)
  })
}

function uploadPaste(payload) {
  $.ajax({
    type: 'POST',
    url: API_URL + '/paste',
    data: payload,
    processData: false,
    contentType: false
  })
  .done(res => {
    console.log('File uploaded to: ' + res.path)
    $('#welcomeMsg').html(`<a href="${res.path}">${res.path}</a>`)
    // TODO: set up SSL for clipboard access
    //navigator.clipboard.writeText(res.path)
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

  let str = `<span id="dateTop">${days[today.getDay()]}</span><br>${months[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`

  $('#dateContainer').append(str)
  $('#dateTop').css('font-size', '3.5rem')
}

function initWeather() {
  let weather = $('#weather')

  $.get('https://wttr.in/?format=3')
  .done(res => {
    weather.text(res.replace('+', ''))
  })
  .fail(e => {
    weather.text('Weather unavailable')
  })
}

function initBuildInfo() {
  fetch('./assets/build.json')
    .then(res => res.json())
    .then(build => {
      $('#dateContainer').append(`<span id="build" title="${build.message}"><br>build ${build.sha}</span>`)
    })
}

