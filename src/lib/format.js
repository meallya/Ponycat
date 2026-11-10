// 83 -> "1:23"
export const fmtTime = (s) => {
  const t = Math.max(0, Math.floor(s || 0))
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}

// 83 -> "01:23"
export const fmtTimer = (s) => {
  const t = Math.max(0, Math.floor(s || 0))
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

const APP_NAMES = {
  zunemusic: 'Groove Music',
  zunevideo: 'Movies & TV',
  msedge: 'Edge',
  chrome: 'Chrome',
  firefox: 'Firefox',
  brave: 'Brave',
  opera: 'Opera',
  spotify: 'Spotify',
  vlc: 'VLC',
  musicbee: 'MusicBee',
  applemusic: 'Apple Music',
}

// "Spotify.exe" -> "Spotify", "Microsoft.ZuneMusic_xxx!Microsoft.ZuneMusic" -> "Groove Music"
export function prettyApp(id = '') {
  let s = String(id).split('!').pop().replace(/\.exe$/i, '')
  s = s.split('.').pop().split('_')[0]
  const known = APP_NAMES[s.toLowerCase()]
  if (known) return known
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
}
