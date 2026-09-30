export function isStandaloneDisplay() {
  return (window.matchMedia?.('(display-mode: standalone)').matches ?? false) ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function shouldMarkPwaReturn(provider: string) {
  return provider === 'x'
}

function safeReturnPath(value: string | null, origin: string) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') ||
    [...value].some(char => char.charCodeAt(0) <= 32)) return '/events'
  try {
    const url = new URL(value, origin)
    // Auth routes can recursively re-enter this handoff. Never carry credentials to an Intent.
    if (url.origin !== origin || /^\/(auth|onboarding)(\/|$)/.test(url.pathname) || url.hash ||
      [...url.searchParams.keys()].some(key => /token|code|pwa_return|^from$/i.test(key))) return '/events'
    return `${url.pathname}${url.search}`
  } catch {
    return '/events'
  }
}

export function buildPwaReturnLinks(origin: string, search: string, userAgent = '') {
  const from = safeReturnPath(new URLSearchParams(search).get('from'), origin)
  const continuePath = `/onboarding?from=${encodeURIComponent(from)}`
  const url = new URL(continuePath, origin)
  const intent = /Android/i.test(userAgent) && url.protocol === 'https:'
    ? `intent://${url.host}${continuePath}#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;S.browser_fallback_url=${encodeURIComponent(url.href)};end`
    : null
  return { continuePath, intent }
}
