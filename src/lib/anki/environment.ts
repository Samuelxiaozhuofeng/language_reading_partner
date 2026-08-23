import { isNativeAndroid } from '../platform'

function hasMobileUserAgent(userAgent: string) {
  return /Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(userAgent)
}

function hasCoarsePrimaryPointer() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }

  return window.matchMedia('(pointer: coarse)').matches && window.matchMedia('(hover: none)').matches
}

export function shouldUseAnkiDroid(): boolean {
  return isNativeAndroid()
}

export function shouldQueueAnkiOnThisDevice() {
  if (isNativeAndroid()) {
    return false
  }

  if (typeof navigator === 'undefined') {
    return false
  }

  return hasMobileUserAgent(navigator.userAgent) || hasCoarsePrimaryPointer()
}
