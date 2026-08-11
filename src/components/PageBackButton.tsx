import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useT } from '../hooks/useT'

const FALLBACK_PARENT_ROUTES: Array<[RegExp, string | ((pathname: string) => string)]> = [
  [/^\/events\/[^/]+\/edit$/, (pathname) => pathname.replace(/\/edit$/, '')],
  [/^\/events\/(new|bookmarks)$/, '/events'],
  [/^\/events\/[^/]+$/, '/events'],
  [/^\/profile\/me\/edit$/, '/profile/me'],
  [/^\/profile\/[^/]+\/(feedback|reports)$/, (pathname) => pathname.replace(/\/(feedback|reports)$/, '')],
  [/^\/messages\/(new|[^/]+)$/, '/messages'],
  [/^\/virtual-lovers\/new$/, '/virtual-lovers'],
  [/^\/virtual-lovers\/[^/]+\/chat$/, '/virtual-lovers'],
  [/^\/issues\/new$/, '/issues'],
  [/^\/issues\/[^/]+$/, '/issues'],
  [/^\/settings\/notifications$/, '/notifications'],
  [/^\/settings\/.+$/, '/events'],
  [/^\/(following|registrations\/me|events\/bookmarks|reports\/me)$/, '/events'],
]

function getFallbackRoute(pathname: string) {
  const match = FALLBACK_PARENT_ROUTES.find(([pattern]) => pattern.test(pathname))
  if (!match) return '/events'
  return typeof match[1] === 'function' ? match[1](pathname) : match[1]
}

export function PageBackButton() {
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useT()

  const handleBack = useCallback(() => {
    if (location.key !== 'default') {
      navigate(-1)
      return
    }
    navigate(getFallbackRoute(location.pathname), { replace: true })
  }, [location.key, location.pathname, navigate])

  const shouldShow = FALLBACK_PARENT_ROUTES.some(([pattern]) => pattern.test(location.pathname))
  if (!shouldShow) return null

  return (
    <div className="page-back-container">
      <button type="button" className="page-back-button" onClick={handleBack}>
        <span aria-hidden="true">←</span>
        <span>{t('common.back')}</span>
      </button>
    </div>
  )
}
