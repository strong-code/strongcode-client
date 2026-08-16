function isMobileDevice() {
  const narrow = (window.matchMedia && window.matchMedia('(max-width: 600px)').matches) || window.innerWidth <= 600
  const touch = (navigator.maxTouchPoints > 0) || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
  return narrow && touch
}

export { isMobileDevice }
