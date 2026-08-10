const GOOGLE_DOCS_HOST = 'docs.google.com'

export function isAllowedExternalRegistrationUrl(value: string): boolean {
  if (!value.trim()) return true
  try {
    const url = new URL(value)
    return url.protocol === 'https:'
      && url.hostname === GOOGLE_DOCS_HOST
      && url.port === ''
      && url.username === ''
      && url.password === ''
      && (url.pathname.startsWith('/forms/') || url.pathname.startsWith('/document/'))
  } catch {
    return false
  }
}
