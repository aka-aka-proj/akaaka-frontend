export function getLogoSrc(type: 'logo' | 'logoLogin') {
  return type === 'logo' ? '/icons/icon-whole.png' : '/logo-login.svg'
}

export function getFavicon() {
  return '/favicon.svg'
}
