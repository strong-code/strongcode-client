const searchSources = {
  "!g":        ["https://www.google.com/#q={Q}",                          "Google"],
  "!im":       ["https://www.google.com/search?tbm=isch&q={Q}",           "Google Images"],
  "!imdb":     ["http://www.imdb.com/find?q={Q}",                         "IMDB"],
  "!ud":       ["http://www.urbandictionary.com/define.php?term={Q}",     "Urban Dictionary"],
  "!w":        ["http://en.wikipedia.org/w/index.php?search={Q}",         "Wikipedia"],
  "!yt":       ["https://www.youtube.com/results?search_query={Q}",       "YouTube"],
  "!ddg":      ["https://duckduckgo.com/?q={Q}",                          "DuckDuckGo"],
  "!gr":       ["https://goodreads.com/search?q={Q}",                     "GoodReads"],
  "!d":        ["https://www.dictionary.com/browse/{Q}",                  "Dictionary"],
  "!last":     ["https://www.last.fm/search?q={Q}",                       "Last.fm"],
  "!r":        ["https://duckduckgo.com/?q=reddit+{Q}",                   "Reddit"]
}

function initSearch() {
  const searchBar = $('#searchBar')
  searchBar.focus()
  let source = searchSources['!ddg'] // default

  searchBar.attr('placeholder', source[1])

  searchBar.on('keydown', e => {
    if (e.key === ' ') {
      let chunk = searchBar.val().split(' ')[0]
      if (searchSources[chunk]) {
        source = searchSources[chunk]
        searchBar.attr('placeholder', source[1]).val('').blur().focus()
      }
    }

    if (e.key === 'Enter') {
      window.location  = source[0].replace("{Q}", encodeURIComponent(searchBar.val().trim()))
    }
  })
}

export { initSearch }
