import type { ChapterReadingParagraph } from '../../lib/readingFlow'
import type { SentenceItem } from '../../types'
import {
  buildParagraphText,
  CHAPTER_PAGE_BOTTOM_SAFE_LINES,
  getReadingBlockClassName,
  getChapterParagraphGap,
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
  paragraph: ChapterReadingParagraph,
  pageBodyWidth: number,
  fontSize: number,
) {
  const effectiveWidth = Math.max(260, pageBodyWidth)
  const charsPerLine = Math.max(18, Math.floor(effectiveWidth / Math.max(7.4, fontSize * 0.56)))
  const lineHeight = fontSize * 2
  const paragraphText = buildParagraphText(paragraph.sentences)

  if (!paragraphText) {
    return lineHeight
  }

  const estimatedLineCount = Math.max(1, Math.ceil(paragraphText.length / charsPerLine))
  const headingBoost =
    paragraph.kind === 'heading'
      ? Math.max(1.3, 1.75 - Math.min(0.5, (paragraph.headingLevel ?? 2) * 0.1))
      : paragraph.kind === 'quote'
        ? 1.12
        : paragraph.kind === 'preformatted'
          ? 1.18
          : 1

  return Math.ceil(estimatedLineCount * lineHeight * headingBoost)
}

export function measureParagraphHeight(
  measureContainer: HTMLDivElement,
  paragraphData: ChapterReadingParagraph,
  pageBodyWidth: number,
  fontSize: number,
) {
  measureContainer.style.width = `${Math.max(260, pageBodyWidth)}px`
  measureContainer.replaceChildren()

  const paragraph = document.createElement('div')
  paragraph.className = `${getReadingBlockClassName(paragraphData)} reading-paragraph--measure`

  paragraphData.sentences.forEach((sentence, sentenceIndex) => {
    const sentenceButton = document.createElement('button')
    sentenceButton.className = 'reading-inline-sentence reading-inline-sentence--measure'
    sentenceButton.type = 'button'
    sentenceButton.tabIndex = -1
    const sentenceHtml = paragraphData.sentenceHtmlById?.[sentence.id]
    if (sentenceHtml) {
      const content = document.createElement('span')
      content.innerHTML = sentenceHtml
      sentenceButton.appendChild(content)
    } else {
      sentenceButton.textContent = getSentenceDisplayText(sentence)
    }
    paragraph.appendChild(sentenceButton)

    if (sentenceIndex < paragraphData.sentences.length - 1) {
      paragraph.appendChild(document.createTextNode(' '))
    }
  })

  measureContainer.appendChild(paragraph)
  const height = Math.ceil(paragraph.getBoundingClientRect().height)
  measureContainer.replaceChildren()

  return height || estimateParagraphHeight(paragraphData, pageBodyWidth, fontSize)
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
  const paragraphGap = getChapterParagraphGap(options.fontSize)
  const measuredHeightCache = new Map<string, number>()
  const pages: ChapterReadingPage[] = []
  let currentParagraphs: ChapterReadingParagraph[] = []
  let currentHeight = 0
  let pageIndex = 0

  const getParagraphHeight = (paragraph: ChapterReadingParagraph) => {
    const cacheKey = [
      paragraph.kind ?? 'paragraph',
      paragraph.headingLevel ?? 0,
      paragraph.sentences.map((sentence) => sentence.id).join('|'),
    ].join(':')
    const cachedHeight = measuredHeightCache.get(cacheKey)
    if (cachedHeight) {
      return cachedHeight
    }

    const measuredHeight = options.measureContainer
      ? measureParagraphHeight(
          options.measureContainer,
          paragraph,
          pageBodyWidth,
          options.fontSize,
        )
      : estimateParagraphHeight(paragraph, pageBodyWidth, options.fontSize)

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

  const pushParagraphChunk = (paragraph: ChapterReadingParagraph, sentences: SentenceItem[]) => {
    const paragraphChunk = {
      ...paragraph,
      sentences,
    }
    const paragraphHeight = getParagraphHeight(paragraphChunk)
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
        ...paragraphChunk,
        id: `${paragraph.id}-${currentParagraphs.length}`,
        sentences,
      },
    ]
    currentHeight =
      currentParagraphs.length === 1 ? paragraphHeight : currentHeight + paragraphGap + paragraphHeight
  }

  paragraphs.forEach((paragraph) => {
    const paragraphHeight = getParagraphHeight(paragraph)

    if (paragraphHeight <= pageBodyHeight) {
      pushParagraphChunk(paragraph, paragraph.sentences)
      return
    }

    let chunk: SentenceItem[] = []
    let chunkHeight = 0

    paragraph.sentences.forEach((sentence) => {
      const nextChunk = [...chunk, sentence]
      const nextChunkHeight = getParagraphHeight({
        ...paragraph,
        sentences: nextChunk,
      })

      if (chunk.length > 0 && nextChunkHeight > pageBodyHeight) {
        pushParagraphChunk(paragraph, chunk)
        chunk = [sentence]
        chunkHeight = getParagraphHeight({
          ...paragraph,
          sentences: chunk,
        })
        return
      }

      chunk = nextChunk
      chunkHeight = nextChunkHeight
    })

    if (chunk.length > 0 && chunkHeight > 0) {
      pushParagraphChunk(paragraph, chunk)
    }
  })

  pushPage()
  return pages
}
