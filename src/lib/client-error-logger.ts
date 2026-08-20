import { supabase } from '../supabaseClient'

interface CapturedError {
  message: string
  source: string
  lineno: number
  colno: number
  url: string
  userAgent: string
  timestamp: string
  stack?: string
}

let lastPersist = 0
const MIN_PERSIST_INTERVAL = 5_000

function formatError(info: CapturedError): string {
  return [
    `Message: ${info.message}`,
    `Source: ${info.source}`,
    `Line: ${info.lineno}:${info.colno}`,
    `URL: ${info.url}`,
    `User Agent: ${info.userAgent}`,
    `Timestamp: ${info.timestamp}`,
    info.stack ? `Stack:\n${info.stack}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

async function persistError(info: CapturedError) {
  const now = Date.now()
  if (now - lastPersist < MIN_PERSIST_INTERVAL) return
  lastPersist = now

  try {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    // Authenticated user → use existing create-issue (reporter_id from JWT)
    if (!sessionError && session) {
      const title =
        info.source && info.lineno
          ? `Auto-captured client error: ${info.message.slice(0, 80)} (${info.source}:${info.lineno})`
          : `Auto-captured client error: ${info.message.slice(0, 100)}`

      const { error } = await supabase.functions.invoke('create-issue', {
        body: {
          title,
          description: formatError(info),
          log_url: info.url,
        },
      })

      if (error) {
        console.error('[AkaAka Error Logger] create-issue failed:', error)
      } else {
        console.log('[AkaAka Error Logger] Persisted to issues table (authenticated)')
      }
      return
    }

    // Anonymous user → use capture-error (no auth needed, sentinel reporter_id)
    const { error } = await supabase.functions.invoke('capture-error', {
      body: {
        message: info.message,
        source: info.source || undefined,
        lineno: info.lineno || undefined,
        colno: info.colno || undefined,
        stack: info.stack || undefined,
        url: info.url || undefined,
        userAgent: info.userAgent || undefined,
      },
    })

    if (error) {
      console.error('[AkaAka Error Logger] capture-error failed:', error)
    } else {
      console.log('[AkaAka Error Logger] Persisted to issues table (anonymous)')
    }
  } catch (err) {
    console.error('[AkaAka Error Logger] Unexpected error during persistence:', err)
  }
}

export function initClientErrorLogger() {
  window.addEventListener('error', (event) => {
    const info: CapturedError = {
      message: event.message,
      source: event.filename || '',
      lineno: event.lineno || 0,
      colno: event.colno || 0,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      stack: (event.error as Error)?.stack,
    }

    console.log('[AkaAka Client Error]', info.message, `(${info.source}:${info.lineno}:${info.colno})`)

    void persistError(info)
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    const info: CapturedError = {
      message: reason?.message || String(reason),
      source: '',
      lineno: 0,
      colno: 0,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      stack: reason?.stack,
    }

    console.log('[AkaAka Promise Error]', info.message)

    void persistError(info)
  })

  console.log('[AkaAka Error Logger] Initialized')
}