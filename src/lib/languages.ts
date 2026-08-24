import type { BookLanguage } from '../types'

export const SUPPORTED_BOOK_LANGUAGES: BookLanguage[] = ['es', 'ja', 'ar', 'fr', 'en']

export function languageLabel(lang?: BookLanguage | string | null): string {
  if (lang === 'es') {
    return '西班牙语'
  }
  if (lang === 'ja') {
    return '日本語'
  }
  if (lang === 'ar') {
    return '阿拉伯语'
  }
  if (lang === 'fr') {
    return '法语'
  }
  if (lang === 'en') {
    return '英语'
  }
  return '未知语言'
}

export function isRtlLanguage(lang?: BookLanguage | string | null): boolean {
  return lang === 'ar'
}

export function languageDir(lang?: BookLanguage | string | null): 'rtl' | 'ltr' {
  return isRtlLanguage(lang) ? 'rtl' : 'ltr'
}

export function languageHtmlLang(lang?: BookLanguage | string | null): string {
  if (lang === 'ja') {
    return 'ja'
  }
  if (lang === 'ar') {
    return 'ar'
  }
  if (lang === 'fr') {
    return 'fr'
  }
  if (lang === 'en') {
    return 'en'
  }
  return 'es'
}
