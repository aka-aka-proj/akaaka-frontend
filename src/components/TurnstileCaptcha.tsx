import { useEffect, useRef } from 'react'

type TurnstileWidgetId = string | number
type TurnstileApi = {
  render: (container: HTMLElement, options: {
    sitekey: string
    callback: (token: string) => void
    'expired-callback': () => void
    'error-callback': () => void
  }) => TurnstileWidgetId
  reset: (widgetId: TurnstileWidgetId) => void
  remove: (widgetId: TurnstileWidgetId) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const TURNSTILE_SCRIPT_ID = 'akaaka-turnstile-script'
const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

interface TurnstileCaptchaProps {
  siteKey: string
  resetSignal: number
  onToken: (token: string) => void
  onError: (message: string) => void
}

export function TurnstileCaptcha({ siteKey, resetSignal, onToken, onError }: TurnstileCaptchaProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<TurnstileWidgetId | null>(null)
  const onTokenRef = useRef(onToken)
  const onErrorRef = useRef(onError)
  onTokenRef.current = onToken
  onErrorRef.current = onError

  useEffect(() => {
    let disposed = false

    const renderWidget = () => {
      if (disposed || !containerRef.current || !window.turnstile || widgetIdRef.current !== null) return
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token) => onTokenRef.current(token),
        'expired-callback': () => {
          onTokenRef.current('')
          onErrorRef.current('expired')
        },
        'error-callback': () => {
          onTokenRef.current('')
          onErrorRef.current('error')
        },
      })
    }

    const existingScript = document.getElementById(TURNSTILE_SCRIPT_ID)
    if (window.turnstile) {
      renderWidget()
    } else if (existingScript) {
      existingScript.addEventListener('load', renderWidget)
    } else {
      const script = document.createElement('script')
      script.id = TURNSTILE_SCRIPT_ID
      script.src = TURNSTILE_SCRIPT_SRC
      script.async = true
      script.defer = true
      script.addEventListener('load', renderWidget)
      script.addEventListener('error', () => onErrorRef.current('load'))
      document.head.appendChild(script)
    }

    return () => {
      disposed = true
      existingScript?.removeEventListener('load', renderWidget)
      if (widgetIdRef.current !== null && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
  }, [siteKey])

  useEffect(() => {
    if (resetSignal === 0 || widgetIdRef.current === null || !window.turnstile) return
    window.turnstile.reset(widgetIdRef.current)
    onTokenRef.current('')
  }, [resetSignal])

  return <div ref={containerRef} role="group" aria-label="Turnstile security check" />
}
