import en from './en'
import zhTW from './zh-TW'

export type Locale = 'zh-TW' | 'en'

export const locales: { value: Locale; label: string }[] = [
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'en', label: 'English' },
]

export const defaultLocale: Locale = 'zh-TW'

const translations = { 'zh-TW': zhTW, en } as const

export type TranslationKeys = typeof zhTW

export function getTranslations(locale: Locale): TranslationKeys {
  return translations[locale]
}

export function t(locale: Locale, key: string, params?: Record<string, string | number>): string {
  const keys = key.split('.')
  let value: unknown = translations[locale]
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = (value as Record<string, unknown>)[k]
    } else {
      return key
    }
  }
  if (typeof value !== 'string') return key
  if (!params) return value
  return value.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in params ? String(params[name]) : `{${name}}`,
  )
}
