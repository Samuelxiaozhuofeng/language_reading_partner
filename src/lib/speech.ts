import { TextToSpeech } from '@capacitor-community/text-to-speech'
import { synthesizeEdgeTts } from './edgeTts'
import { isNativeAndroid } from './platform'
import { getCachedSpeech, putCachedSpeech } from './speechCache'

export class SpeechPackageMissingError extends Error {
  isMissingPackage: boolean

  constructor(message = '系统未安装当前语种语音包，请安装后重试') {
    super(message)
    this.name = 'SpeechPackageMissingError'
    this.isMissingPackage = true
  }
}

export function isSpeechPackageMissing(error: unknown): boolean {
  if (!error) {
    return false
  }
  if (error instanceof SpeechPackageMissingError) {
    return true
  }
  if (typeof error === 'object' && 'isMissingPackage' in error && (error as { isMissingPackage: unknown }).isMissingPackage === true) {
    return true
  }
  if (error instanceof Error && error.name === 'SpeechPackageMissingError') {
    return true
  }
  return false
}

export function getSpeechLocale(language?: string): string | null {
  if (!language) {
    return null
  }
  const normalized = language.toLowerCase()
  if (normalized === 'es') {
    return 'es-ES'
  }
  if (normalized === 'fr') {
    return 'fr-FR'
  }
  if (normalized === 'en') {
    return 'en-US'
  }
  return null
}

export function getSpeechVoice(language?: string): string | null {
  if (!language) {
    return null
  }
  const normalized = language.toLowerCase()
  if (normalized === 'es') {
    return 'es-ES-ElviraNeural'
  }
  if (normalized === 'fr') {
    return 'fr-FR-DeniseNeural'
  }
  if (normalized === 'en') {
    return 'en-US-JennyNeural'
  }
  return null
}

export function canSpeakLanguage(language?: string): boolean {
  if (!isNativeAndroid()) {
    return false
  }
  return Boolean(getSpeechLocale(language))
}

let activeRequestId = 0
let currentAudio: HTMLAudioElement | null = null
let currentAudioUrl: string | null = null

function cleanupAudio() {
  if (currentAudio) {
    try {
      currentAudio.pause()
      currentAudio.currentTime = 0
      currentAudio.removeAttribute('src')
      currentAudio.load()
    } catch {
      // ignore
    }
    currentAudio = null
  }
  if (currentAudioUrl) {
    try {
      URL.revokeObjectURL(currentAudioUrl)
    } catch {
      // ignore
    }
    currentAudioUrl = null
  }
}

export async function stopSpeaking(): Promise<void> {
  activeRequestId++
  cleanupAudio()
  if (!isNativeAndroid()) {
    return
  }
  try {
    await TextToSpeech.stop()
  } catch (error) {
    console.warn('TextToSpeech.stop failed:', error)
  }
}

export async function openSpeechInstall(): Promise<void> {
  if (!isNativeAndroid()) {
    return
  }
  try {
    await TextToSpeech.openInstall()
  } catch (error) {
    console.warn('TextToSpeech.openInstall failed:', error)
  }
}

function playAudioBuffer(bytes: Uint8Array): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    cleanupAudio()
    const copy = new Uint8Array(bytes.byteLength)
    copy.set(bytes)
    const blob = new Blob([copy], { type: 'audio/mpeg' })
    const url = URL.createObjectURL(blob)
    currentAudioUrl = url

    const audio = new Audio(url)
    currentAudio = audio

    const removeListeners = () => {
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
    }

    const handleEnded = () => {
      removeListeners()
      if (currentAudio === audio) {
        cleanupAudio()
      }
      resolve()
    }

    const handleError = () => {
      removeListeners()
      if (currentAudio === audio) {
        cleanupAudio()
      }
      reject(new Error('音频播放失败'))
    }

    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)

    const playPromise = audio.play()
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        removeListeners()
        if (currentAudio === audio) {
          cleanupAudio()
        }
        reject(err)
      })
    }
  })
}

async function speakWithSystemTts(cleanWord: string, lang: string): Promise<void> {
  try {
    const res = await TextToSpeech.isLanguageSupported({ lang })
    if (res && res.supported === false) {
      throw new SpeechPackageMissingError('系统未安装当前语种语音包，请安装后重试')
    }
  } catch (error) {
    if (isSpeechPackageMissing(error)) {
      throw error
    }
    console.warn('TextToSpeech.isLanguageSupported check failed:', error)
  }

  try {
    await TextToSpeech.stop()
  } catch {
    // ignore stop error before speaking
  }

  try {
    await TextToSpeech.speak({
      text: cleanWord,
      lang,
      rate: 0.9,
      pitch: 1,
      volume: 1,
      queueStrategy: 0,
    })
  } catch (error) {
    console.error('TextToSpeech.speak failed:', error)
    const rawMessage = error instanceof Error ? error.message : String(error)
    const lower = rawMessage.toLowerCase()
    if (lower.includes('missing') || lower.includes('not supported') || lower.includes('install') || lower.includes('language')) {
      throw new SpeechPackageMissingError('系统缺少语音包，请安装后重试')
    }
    throw new Error('朗读失败，请稍后重试')
  }
}

export async function speakWord(word: string, language?: string): Promise<void> {
  if (!isNativeAndroid()) {
    return
  }

  const cleanWord = word.trim()
  if (!cleanWord) {
    return
  }

  const lang = getSpeechLocale(language)
  const voice = getSpeechVoice(language)
  if (!lang || !voice) {
    return
  }

  const requestId = ++activeRequestId

  // Stop any active audio and native TTS before starting
  cleanupAudio()
  try {
    await TextToSpeech.stop()
  } catch {
    // ignore
  }

  if (activeRequestId !== requestId) {
    return
  }

  // 1. Try local cache
  const cachedBytes = await getCachedSpeech(lang, cleanWord)
  if (activeRequestId !== requestId) {
    return
  }

  if (cachedBytes && cachedBytes.length > 0) {
    try {
      await playAudioBuffer(cachedBytes)
      return
    } catch (cachedPlayError) {
      console.warn('播放缓存音频失败，将尝试重新请求或系统降级:', cachedPlayError)
    }
  }

  if (activeRequestId !== requestId) {
    return
  }

  // 2. Try Edge TTS
  try {
    const freshBytes = await synthesizeEdgeTts(cleanWord, voice)
    if (activeRequestId !== requestId) {
      return
    }
    void putCachedSpeech(lang, cleanWord, freshBytes)
    await playAudioBuffer(freshBytes)
    return
  } catch (edgeError) {
    console.warn('Edge TTS 朗读失败，降级至系统 TTS:', edgeError)
  }

  if (activeRequestId !== requestId) {
    return
  }

  // 3. Fallback to System TTS
  await speakWithSystemTts(cleanWord, lang)
}
