import { useCallback, useEffect, useState } from 'react'
import {
  canSpeakLanguage,
  isSpeechPackageMissing,
  openSpeechInstall,
  speakWord,
  stopSpeaking,
} from '../../lib/speech'
import type { BookLanguage } from '../../types'

type WordLookupPopoverProps = {
  ankiMessage?: string
  ankiStatus?: 'idle' | 'loading' | 'success' | 'error'
  bookLanguage: BookLanguage
  context?: string
  error?: string | null
  explanation?: string | null
  loading?: boolean
  onAddToAnki?: () => Promise<void>
  onClose: () => void
  word: string
}

export function WordLookupPopover({
  ankiMessage,
  ankiStatus = 'idle',
  bookLanguage,
  context,
  error,
  explanation,
  loading = false,
  onAddToAnki,
  onClose,
  word,
}: WordLookupPopoverProps) {
  const [speechError, setSpeechError] = useState<{
    message: string
    isMissingPackage: boolean
  } | null>(null)

  const isPlayable = canSpeakLanguage(bookLanguage)

  const handleSpeak = useCallback(async () => {
    if (!isPlayable || !word) {
      return
    }
    try {
      await speakWord(word, bookLanguage)
      setSpeechError(null)
    } catch (err) {
      const isMissing = isSpeechPackageMissing(err)
      const message = err instanceof Error ? err.message : '朗读失败'
      setSpeechError({ message, isMissingPackage: isMissing })
    }
  }, [isPlayable, word, bookLanguage])

  const handleSpeakSentence = useCallback(async () => {
    const sentence = context?.trim()
    if (!isPlayable || !sentence) {
      return
    }
    try {
      await speakWord(sentence, bookLanguage)
      setSpeechError(null)
    } catch (err) {
      const isMissing = isSpeechPackageMissing(err)
      const message = err instanceof Error ? err.message : '朗读失败'
      setSpeechError({ message, isMissingPackage: isMissing })
    }
  }, [isPlayable, context, bookLanguage])

  useEffect(() => {
    if (!word || !isPlayable) {
      return
    }
    let cancelled = false
    void speakWord(word, bookLanguage)
      .then(() => {
        if (!cancelled) {
          setSpeechError(null)
        }
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return
        }
        const isMissing = isSpeechPackageMissing(err)
        const message = err instanceof Error ? err.message : '朗读失败'
        setSpeechError({ message, isMissingPackage: isMissing })
      })
    return () => {
      cancelled = true
    }
  }, [word, isPlayable, bookLanguage])

  const handleClose = useCallback(() => {
    void stopSpeaking()
    onClose()
  }, [onClose])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        void stopSpeaking()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  useEffect(() => {
    return () => {
      void stopSpeaking()
    }
  }, [])

  if (!word) {
    return null
  }
  const canAddToAnki = Boolean(
    explanation && !loading && !error && onAddToAnki && ankiStatus !== 'loading',
  )

  return (
    <div
      aria-modal="true"
      className="reading-overlay is-sheet word-lookup-overlay"
      dir="ltr"
      role="dialog"
      onClick={handleClose}
    >
      <div
        className="reading-sheet-frame word-lookup-frame"
        onClick={(event) => event.stopPropagation()}
      >
        <section className="reading-inspector is-sheet word-lookup-card">
          <div className="sheet-pull-handle" />
          <div className="reading-inspector-header word-lookup-header">
            <div>
              <p className="section-kicker">Word Lookup</p>
              <div className="word-lookup-title-row">
                <h3 className="word-lookup-title">{word}</h3>
                {isPlayable ? (
                  <button
                    aria-label="发音"
                    className="word-lookup-speak-button"
                    type="button"
                    onClick={() => void handleSpeak()}
                  >
                    <svg aria-hidden="true" className="word-lookup-speak-icon" viewBox="0 0 24 24">
                      <path
                        d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      />
                    </svg>
                    <span className="word-lookup-speak-text">发音</span>
                  </button>
                ) : null}
              </div>
            </div>
            <div className="reading-inspector-actions">
              <button
                className="ghost-button reading-inspector-close"
                type="button"
                onClick={handleClose}
              >
                关闭
              </button>
            </div>
          </div>

          {speechError ? (
            <div className="word-lookup-speech-error notice error">
              <span>{speechError.message}</span>
              {speechError.isMissingPackage ? (
                <button
                  className="ghost-button word-lookup-install-button"
                  type="button"
                  onClick={() => void openSpeechInstall()}
                >
                  去安装语音包
                </button>
              ) : null}
            </div>
          ) : null}

          {context ? (
            <div className="word-lookup-context">
              <p className="word-lookup-context-text">
                {context}
                {isPlayable ? (
                  <button
                    aria-label="朗读句子"
                    className="word-lookup-inline-speak"
                    type="button"
                    onClick={() => void handleSpeakSentence()}
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24">
                      <path
                        d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      />
                    </svg>
                  </button>
                ) : null}
              </p>
            </div>
          ) : null}

          <div className="word-lookup-body">
            {loading ? (
              <p className="notice">正在请求词汇解释...</p>
            ) : error ? (
              <p className="notice error">{error}</p>
            ) : explanation ? (
              <>
                <div className="word-lookup-explanation">
                  <p>{explanation}</p>
                </div>
                {onAddToAnki ? (
                  <div className="panel-actions knowledge-detail-actions">
                    <button
                      className="secondary-button"
                      disabled={!canAddToAnki}
                      type="button"
                      onClick={() => void onAddToAnki()}
                    >
                      {ankiStatus === 'loading' ? '添加到 Anki 中...' : '添加到 Anki'}
                    </button>
                  </div>
                ) : null}
                {ankiStatus !== 'idle' && ankiMessage ? (
                  <p
                    className={`notice ${
                      ankiStatus === 'success'
                        ? 'success'
                        : ankiStatus === 'error'
                          ? 'error'
                          : ''
                    }`}
                  >
                    {ankiMessage}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="notice">暂无解释</p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
