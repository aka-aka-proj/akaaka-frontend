export interface EventSourcePreview {
  source_url: string
  provider: string
  preview: { title: string | null; description: string | null }
}

export function isAllowedEventSourceUrl(value: string): boolean {
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:' || url.port || url.username || url.password) return false
    if (url.hostname === 'x.com' || url.hostname === 'twitter.com') return /^\/[^/]+\/status\/[0-9]+$/.test(url.pathname)
    return url.hostname === 'todo.smertw.com' && /^\/events\/[0-9]+$/.test(url.pathname)
  } catch {
    return false
  }
}
