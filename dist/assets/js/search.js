import './jquery-3.5.1.min.js'
import { sendToOpenCode } from './opencode.js'
import { isMobileDevice } from './device.js'

const searchSources = {
  "!g":        ["https://www.google.com/search?&q={Q}",                   "Google"],
  "!b":        ["https://search.brave.com/search?q={Q}",                  "Brave"],
  "!im":       ["https://www.google.com/search?tbm=isch&q={Q}",           "Google Images"],
  "!imdb":     ["http://www.imdb.com/find?q={Q}",                         "IMDB"],
  "!ud":       ["http://www.urbandictionary.com/define.php?term={Q}",     "Urban Dictionary"],
  "!w":        ["http://en.wikipedia.org/w/index.php?search={Q}",         "Wikipedia"],
  "!yt":       ["https://www.youtube.com/results?search_query={Q}",       "YouTube"],
  "!ddg":      ["https://duckduckgo.com/?q={Q}",                          "DuckDuckGo"],
  "!gr":       ["https://goodreads.com/search?q={Q}",                     "GoodReads"],
  "!d":        ["https://www.dictionary.com/browse/{Q}",                  "Dictionary"],
  "!last":     ["https://www.last.fm/search?q={Q}",                       "Last.fm"],
  "!r":        ["https://duckduckgo.com/?q=reddit+{Q}",                   "Reddit"],
  "!a":        ["https://smile.amazon.com/s?k={Q}",                       "Amazon"],
  "$":         ["https://finance.yahoo.com/quote/{Q}",                    "Yahoo Finance"]
}

function initSearch() {
  const searchBar = $('#searchBar')
  const welcomeMsg = $('#welcomeMsg')
  let source = searchSources['!b'] // default
  let chunk

  searchBar.attr('placeholder', source[1])
  if (!isMobileDevice()) searchBar.focus()

  let ocMode = false

  searchBar.on('keyup', e => {
    if (e.key === ' ') {
      chunk = searchBar.val().split(' ')[0]

      if (chunk === '?' && !isMobileDevice()) {
        ocMode = true
        welcomeMsg.text('asking opencode')
        searchBar.attr('placeholder', 'OpenCode').val('').blur().focus()
      } else if (searchSources[chunk]) {
        ocMode = false
        source = searchSources[chunk]
        welcomeMsg.text(`searching with ${source[1].toLowerCase()}`)
        searchBar.attr('placeholder', source[1]).val('').blur().focus()
      }
    }

    if (e.key === 'Enter') {
      const query = searchBar.val().trim()
      if (ocMode) {
        searchBar.val('')
        sendToOpenCode(query)
      } else {
        window.location = source[0].replace("{Q}", encodeURIComponent(query))
      }
    }
  })
}

export { initSearch }
