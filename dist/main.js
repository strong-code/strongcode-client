import './assets/js/jquery-3.5.1.min.js'
import './assets/js/paste.js'
import { initSearch } from './assets/js/search.js'
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
})

$('.header-container').ready(() => {
  initDate()
})

$('#darkmodeToggle').click((el) => {
  const currentTheme = $('html').attr('data-theme')
  const date = new Date()
  date.setTime(date.getTime() + (10 * 365 * 24 * 60 * 60))

  // lights on
  if (currentTheme === 'dark') {
    $('#darkmodeToggle').attr('src', 'assets/icons/darkmode.png')
    $('.dark-theme').each((i, node) => {
      $(node).removeClass('dark-theme')
    })
    $('html').attr('data-theme', 'light')
    document.cookie = `darkmode=off; expires=${date.toGMTString()}; path=/` 
  } else {
    // lights off
    $('#darkmodeToggle').attr('src', 'assets/icons/lightmode.png')
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
    $('#darkmodeToggle').addClass('dark-theme').attr('src', 'assets/icons/lightmode.png')
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
        createPasteButtons()
        break
      case '?':
        $('#footer').toggle()
        break
      case 't':
        window.location.href = HOST + '/api/track/active'
        break
    }
  })
}

function initGalleryPopup() {
  $('#paste-list a').on('mouseenter', (e) => {
    $('.popup').css({left: e.pageX-310, top: e.pageY-105}).height(400).width(240).show()

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

function createTrackingList() {
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
    $('#footer')
      .append(`Paste directory size: ${res.folderSize}`)
      .append(`<p>Total pastes: ${res.totalPastes}`)
  })
  .fail(e => {
    stat.text('API is offline').css('color', 'red').css('font-weight', 'bold')
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

  $.get('https://wttr.in/?format=3&u')
  .done(res => {
    let forecast = res.replace('+', '')
    let wg = 'https://www.wunderground.com/weather/us/ca/san-diego/KCASANDI411'
    weather.html(`<a href='${wg}'>${forecast}</a>`)
  })
  .fail(e => {
    weather.text('Weather unavailable')
  })
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

