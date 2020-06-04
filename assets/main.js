function init() {
  initPaste()
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
