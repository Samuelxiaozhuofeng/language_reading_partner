import type { ChapterReadingParagraph } from '../../lib/readingFlow'
import type { SentenceItem } from '../../types'
import {
  buildParagraphText,
  CHAPTER_PAGE_BOTTOM_SAFE_LINES,
  type ChapterPageLayout,
  type ChapterReadingPage,
  getSentenceDisplayText,
} from './readingShared'

type PaginateChapterParagraphsOptions = {
  fontSize: number
  measureContainer: HTMLDivElement | null
  pageLayout: ChapterPageLayout
  viewportHeight: number
  viewportWidth: number
}

export function estimateParagraphHeight(
  sentences: SentenceItem[],
  pageBodyWidth: number,
  fontSize: number,
) {
  const effectiveWidth = Math.max(260, pageBodyWidth)
  const charsPerLine = Math.max(18, Math.floor(effectiveWidth / Math.max(7.4, fontSize * 0.56)))
  const lineHeight = fontSize * 2
  const paragraphText = buildParagraphText(sentences)

  if (!paragraphText) {
    return lineHeight
  }

  const estimatedLineCount = Math.max(1, Math.ceil(paragraphText.length / charsPerLine))
  return Math.ceil(estimatedLineCount * lineHeight)
}

export function measureParagraphHeight(
  measureContainer: HTMLDivElement,
  sentences: SentenceItem[],
  pageBodyWidth: number,
  fontSize: number,
) {
  measureContainer.style.width = `${Math.max(260, pageBodyWidth)}px`
  measureContainer.replaceChildren()

  const paragraph = document.createElement('p')
  paragraph.className = 'reading-paragraph reading-paragraph--measure'

  sentences.forEach((sentence, sentenceIndex) => {
    const sentenceButton = document.createElement('button')
    sentenceButton.className = 'reading-inline-sentence reading-inline-sentence--measure'
    sentenceButton.type = 'button'
    sentenceButton.tabIndex = -1
    sentenceButton.textContent = getSentenceDisplayText(sentence)
    paragraph.appendChild(sentenceButton)

    if (sentenceIndex < sentences.length - 1) {
      paragraph.appendChild(document.createTextNode(' '))
    }
  })

  measureContainer.appendChild(paragraph)
  const height = Math.ceil(paragraph.getBoundingClientRect().height)
  measureContainer.replaceChildren()

  return height || estimateParagraphHeight(sentences, pageBodyWidth, fontSize)
}

export function paginateChapterParagraphs(
  paragraphs: ChapterReadingParagraph[],
  options: PaginateChapterParagraphsOptions,
) {
  if (paragraphs.length === 0) {
    return [] as ChapterReadingPage[]
  }

  const pageBodyWidth =
    options.pageLayout.bodyWidth || Math.max(360, Math.round(options.viewportWidth - 52))
  const bottomSafeSpace = Math.max(18, Math.round(options.fontSize * CHAPTER_PAGE_BOTTOM_SAFE_LINES))
  const pageBodyHeight =
    Math.max(
      180,
      (options.pageLayout.bodyHeight ||
        Math.max(320, Math.round(options.viewportHeight - options.fontSize * 9.6))) -
        bottomSafeSpace,
    )
  const paragraphGap = Math.max(16, Math.round(options.fontSize * 1.1))
  const measuredHeightCache = new Map<string, number>()
  const pages: ChapterReadingPage[] = []
  let currentParagraphs: ChapterReadingParagraph[] = []
  let currentHeight = 0
  let pageIndex = 0

  const getParagraphHeight = (sentences: SentenceItem[]) => {
    const cacheKey = sentences.map((sentence) => sentence.id).join('|')
    const cachedHeight = measuredHeightCache.get(cacheKey)
    if (cachedHeight) {
      return cachedHeight
    }

    const measuredHeight = options.measureContainer
      ? measureParagraphHeight(
          options.measureContainer,
          sentences,
          pageBodyWidth,
          options.fontSize,
        )
      : estimateParagraphHeight(sentences, pageBodyWidth, options.fontSize)

    measuredHeightCache.set(cacheKey, measuredHeight)
    return measuredHeight
  }

  const pushPage = () => {
    if (currentParagraphs.length === 0) {
      return
    }

    pages.push({
      id: `reading-page-${pageIndex}`,
      paragraphs: currentParagraphs,
    })
    pageIndex += 1
    currentParagraphs = []
    currentHeight = 0
  }

  const pushParagraphChunk = (paragraphId: string, sentences: SentenceItem[]) => {
    const paragraphHeight = getParagraphHeight(sentences)
    const nextHeight =
      currentParagraphs.length === 0
        ? paragraphHeight
        : currentHeight + paragraphGap + paragraphHeight

    if (currentParagraphs.length > 0 && nextHeight > pageBodyHeight) {
      pushPage()
    }

    currentParagraphs = [
      ...currentParagraphs,
      {
        id: `${paragraphId}-${currentParagraphs.length}`,
        sentences,
      },
    ]
    currentHeight =
      currentParagraphs.length === 1 ? paragraphHeight : currentHeight + paragraphGap + paragraphHeight
  }

  paragraphs.forEach((paragraph) => {
    const paragraphHeight = getParagraphHeight(paragraph.sentences)

    if (paragraphHeight <= pageBodyHeight) {
      pushParagraphChunk(paragraph.id, paragraph.sentences)
      return
    }

    let chunk: SentenceItem[] = []
    let chunkHeight = 0

    paragraph.sentences.forEach((sentence) => {
      const nextChunk = [...chunk, sentence]
      const nextChunkHeight = getParagraphHeight(nextChunk)

      if (chunk.length > 0 && nextChunkHeight > pageBodyHeight) {
        pushParagraphChunk(paragraph.id, chunk)
        chunk = [sentence]
        chunkHeight = getParagraphHeight(chunk)
        return
      }

      chunk = nextChunk
      chunkHeight = nextChunkHeight
    })

    if (chunk.length > 0 && chunkHeight > 0) {
      pushParagraphChunk(paragraph.id, chunk)
    }
  })

  pushPage()
  return pages
}
