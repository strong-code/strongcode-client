function isMobileDevice() {
  const mq = window.matchMedia
  const narrow = mq ? mq('(max-width: 600px)').matches : window.innerWidth <= 600
  const touch = navigator.maxTouchPoints > 0 || (mq && mq('(pointer: coarse)').matches)
  return narrow && touch
}

export { isMobileDevice }
