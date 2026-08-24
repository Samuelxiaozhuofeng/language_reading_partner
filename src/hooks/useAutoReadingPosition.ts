import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type { ReadingMode, SentenceItem } from '../types'

const SAVE_DELAY_MS = 450
const RESTORE_GRACE_MS = 700

type UseAutoReadingPositionOptions = {
  enabled: boolean
  mode: ReadingMode
  observeKey: string
  pagedLeadSentence: SentenceItem | null
  rootRef: RefObject<HTMLElement | null>
  sentences: SentenceItem[]
  onRemember: (sentence: SentenceItem, sentenceIndex: number) => void
}

export function useAutoReadingPosition({
  enabled,
  mode,
  observeKey,
  pagedLeadSentence,
  rootRef,
  sentences,
  onRemember,
}: UseAutoReadingPositionOptions) {
  const lastSavedIdRef = useRef<string | null>(null)
  const readyRef = useRef(false)

  useEffect(() => {
    readyRef.current = false
    lastSavedIdRef.current = null
    const timerId = window.setTimeout(() => {
      readyRef.current = true
    }, RESTORE_GRACE_MS)
    return () => window.clearTimeout(timerId)
  }, [mode, observeKey])

  useEffect(() => {
    if (!enabled || mode !== 'paged' || !pagedLeadSentence) {
      return
    }

    const timerId = window.setTimeout(() => {
      rememberSentence(pagedLeadSentence, sentences, lastSavedIdRef, readyRef, onRemember)
    }, SAVE_DELAY_MS)

    return () => window.clearTimeout(timerId)
  }, [enabled, mode, onRemember, pagedLeadSentence, sentences])

  useEffect(() => {
    if (!enabled || mode !== 'scroll') {
      return
    }

    const root = rootRef.current
    if (!root) {
      return
    }

    let debounceId: number | null = null
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)[0]
        const sentenceId = (visible?.target as HTMLElement | undefined)?.dataset.sentenceId
        if (!sentenceId) {
          return
        }

        const sentence = sentences.find((item) => item.id === sentenceId) ?? null
        if (debounceId !== null) {
          window.clearTimeout(debounceId)
        }
        debounceId = window.setTimeout(() => {
          rememberSentence(sentence, sentences, lastSavedIdRef, readyRef, onRemember)
        }, SAVE_DELAY_MS)
      },
      {
        root,
        rootMargin: '-10% 0px -70% 0px',
        threshold: 0.01,
      },
    )

    root.querySelectorAll('[data-sentence-id]').forEach((node) => observer.observe(node))

    return () => {
      observer.disconnect()
      if (debounceId !== null) {
        window.clearTimeout(debounceId)
      }
    }
  }, [enabled, mode, observeKey, onRemember, rootRef, sentences])
}

function rememberSentence(
  sentence: SentenceItem | null,
  sentences: SentenceItem[],
  lastSavedIdRef: { current: string | null },
  readyRef: { current: boolean },
  onRemember: (sentence: SentenceItem, sentenceIndex: number) => void,
) {
  if (!readyRef.current || !sentence || lastSavedIdRef.current === sentence.id) {
    return
  }

  const sentenceIndex = sentences.findIndex((item) => item.id === sentence.id)
  if (sentenceIndex < 0) {
    return
  }

  lastSavedIdRef.current = sentence.id
  onRemember(sentence, sentenceIndex)
}
