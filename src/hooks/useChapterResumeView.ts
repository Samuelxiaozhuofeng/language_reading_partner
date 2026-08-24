import { useEffect, useRef } from 'react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { ReadingMode } from '../types'

type UseChapterResumeViewOptions = {
  chapterBodyRef: RefObject<HTMLElement | null>
  chapterPageCount: number
  chapterReadingKey: string
  isChapterMode: boolean
  mode: ReadingMode
  resumeAnchorPageIndex: number
  resumeAnchorSentenceId: string | null
  setCurrentChapterPage: Dispatch<SetStateAction<number>>
  setResumeHighlightSentenceId: Dispatch<SetStateAction<string | null>>
}

export function useChapterResumeView({
  chapterBodyRef,
  chapterPageCount,
  chapterReadingKey,
  isChapterMode,
  mode,
  resumeAnchorPageIndex,
  resumeAnchorSentenceId,
  setCurrentChapterPage,
  setResumeHighlightSentenceId,
}: UseChapterResumeViewOptions) {
  const resumeAnchorSentenceIdRef = useRef(resumeAnchorSentenceId)
  const resumeAnchorPageIndexRef = useRef(resumeAnchorPageIndex)

  useEffect(() => {
    resumeAnchorSentenceIdRef.current = resumeAnchorSentenceId
    resumeAnchorPageIndexRef.current = resumeAnchorPageIndex
  }, [resumeAnchorPageIndex, resumeAnchorSentenceId])

  useEffect(() => {
    if (!isChapterMode) {
      return
    }

    const targetId = resumeAnchorSentenceIdRef.current
    const frameId = window.requestAnimationFrame(() => {
      setResumeHighlightSentenceId(targetId)
    })
    const timerId = window.setTimeout(() => {
      setResumeHighlightSentenceId((current) => (current === targetId ? null : current))
    }, 2600)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.clearTimeout(timerId)
    }
  }, [chapterReadingKey, isChapterMode, mode, setResumeHighlightSentenceId])

  useEffect(() => {
    if (!isChapterMode || mode !== 'paged') {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      if (resumeAnchorSentenceIdRef.current) {
        setCurrentChapterPage(resumeAnchorPageIndex)
        return
      }
      setCurrentChapterPage(0)
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [chapterReadingKey, isChapterMode, mode, resumeAnchorPageIndex, setCurrentChapterPage])


  useEffect(() => {
    if (!isChapterMode || mode !== 'paged') {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      setCurrentChapterPage((current) => Math.min(current, Math.max(0, chapterPageCount - 1)))
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [chapterPageCount, isChapterMode, mode, setCurrentChapterPage])

  useEffect(() => {
    if (!isChapterMode || mode !== 'scroll') {
      return
    }

    const targetId = resumeAnchorSentenceIdRef.current
    if (!targetId) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      const target = chapterBodyRef.current?.querySelector(`[data-sentence-id="${targetId}"]`)
      if (target instanceof HTMLElement) {
        target.scrollIntoView({ block: 'start', behavior: 'auto' })
      }
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [chapterBodyRef, chapterReadingKey, isChapterMode, mode])
}
