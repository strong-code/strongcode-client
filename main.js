import './assets/js/jquery-3.5.1.min.js'

$('body').ready(() => {
  initLinks()
  initDate()
  darkMode()
})

$('#darkmodeToggle').click(() => {
  if (document.documentElement.getAttribute('data-theme') === 'dark') {
    document.documentElement.setAttribute('data-theme', 'light')
  } else {
    document.documentElement.setAttribute('data-theme', 'dark')
  }
})

function darkMode() {
  $('.menu-icon').each((i, node) => {
    $(node).addClass('dark-theme')
  })
  $('#darkmodeToggle').addClass('dark-theme')
}

function initPaste() {
  const c = $('.container')
  c.pastableNonInputable()
  
  c.on('pasteImage', (ev, data) => {
    console.log(data.blob)
  })
  .on('pasteText', (ev, data) => {
    console.log(data.text)
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

  let str = `<span id="dateTop">${days[today.getDay()]}</span><p>${months[today.getMonth()]} ${today.getDay()}, ${today.getFullYear()}`

  $('#dateContainer').append(str)
  $('#dateTop').css('font-size', '3.5rem')
}