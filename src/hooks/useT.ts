import { useCallback } from 'react'
import { useLanguage } from '../context/LanguageContext'
import { t as translate } from '../i18n'

export function useT() {
  const { locale } = useLanguage()

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      return translate(locale, key, params)
    },
    [locale],
  )

  return { t, locale } as const
}
