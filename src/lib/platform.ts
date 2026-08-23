import { Capacitor } from '@capacitor/core'

export function isNativeAndroid(): boolean {
  return Capacitor.getPlatform() === 'android'
}
