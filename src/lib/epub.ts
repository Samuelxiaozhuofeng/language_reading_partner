import ePub from 'epubjs'
import type { NavItem } from 'epubjs/types/navigation'
import type { PackagingMetadataObject } from 'epubjs/types/packaging'
import type Section from 'epubjs/types/section'
import type { SpineItem } from 'epubjs/types/section'
import type {
  BookChapterRecord,
  BookRecord,
  ChapterParagraphBlock,
} from '../types'
import {
  createChapterSentenceItems,
  createChapterSentences,
  createParagraphBlock,
  deriveChapterAnalysisState,
  paragraphsToText,
} from './chapterText'
import { segmentSpanishText } from './segment'

type ImportedChapterDraft = Pick<
  BookChapterRecord,
  | 'epubHref'
  | 'title'
  | 'order'
  | 'originalText'
  | 'sourceText'
  | 'paragraphBlocks'
  | 'sentences'
  | 'results'
  | 'activeRange'
  | 'lastReadEnd'
  | 'resumeAnchor'
>

type ImportedBookPayload = {
  book: BookRecord
  chapters: BookChapterRecord[]
  fileData: ArrayBuffer
}

type ExtractedParagraphDraft = Pick<
  ChapterParagraphBlock,
  'kind' | 'headingLevel' | 'text' | 'html' | 'sentenceTexts' | 'sentenceHtml'
> & {
  sentenceTexts: string[]
}

const INLINE_TAG_NAMES = new Set([
  'b',
  'cite',
  'code',
  'em',
  'i',
  'mark',
  's',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'u',
])

function stripHash(href: string) {
  return href.split('#')[0] ?? href
}

function flattenToc(items: NavItem[], output: NavItem[] = []) {
  for (const item of items) {
    output.push(item)
    if (item.subitems?.length) {
      flattenToc(item.subitems, output)
    }
  }

  return output
}

function getSectionIdentifier(section: Section) {
  return stripHash(section.href || section.url || '')
}

function resolveParagraphBlockMeta(tagName: string) {
  const normalizedTag = tagName.toLowerCase()

  if (/^h[1-6]$/u.test(normalizedTag)) {
    return {
      kind: 'heading' as const,
      headingLevel: Number(normalizedTag.slice(1)),
    }
  }

  if (normalizedTag === 'blockquote') {
    return {
      kind: 'quote' as const,
    }
  }

  if (normalizedTag === 'li') {
    return {
      kind: 'list-item' as const,
    }
  }

  if (normalizedTag === 'pre') {
    return {
      kind: 'preformatted' as const,
    }
  }

  return {
    kind: 'paragraph' as const,
  }
}

function unwrapElement(element: Element) {
  const parent = element.parentNode
  if (!parent) {
    return
  }

  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element)
  }

  parent.removeChild(element)
}

function sanitizeInlineElement(element: HTMLElement) {
  element
    .querySelectorAll('script, style, nav, aside, svg, noscript, iframe, object, img, picture, video, audio')
    .forEach((node) => node.remove())

  Array.from(element.querySelectorAll('*'))
    .reverse()
    .forEach((node) => {
      const normalizedTag = node.tagName.toLowerCase()

      if (normalizedTag === 'br') {
        node.replaceWith(element.ownerDocument.createTextNode(' '))
        return
      }

      if (!INLINE_TAG_NAMES.has(normalizedTag)) {
        unwrapElement(node)
        return
      }

      Array.from(node.attributes).forEach((attribute) => {
        node.removeAttribute(attribute.name)
      })
    })
}

function normalizeInlineTextNodes(element: HTMLElement) {
  const textNodes: Array<{ node: Text; start: number; end: number }> = []
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  let fullText = ''

  while (true) {
    const currentNode = walker.nextNode()
    if (!(currentNode instanceof Text)) {
      break
    }

    let nextText = currentNode.textContent?.replace(/\s+/g, ' ') ?? ''
    if (!nextText.trim()) {
      currentNode.textContent = ''
      continue
    }

    if (fullText.length === 0) {
      nextText = nextText.trimStart()
    } else if (fullText.endsWith(' ') && nextText.startsWith(' ')) {
      nextText = nextText.slice(1)
    }

    if (!nextText) {
      currentNode.textContent = ''
      continue
    }

    const start = fullText.length
    fullText += nextText
    currentNode.textContent = nextText
    textNodes.push({
      node: currentNode,
      start,
      end: fullText.length,
    })
  }

  const trimmedText = fullText.trimEnd()
  if (trimmedText.length < fullText.length) {
    const trailingWhitespaceCount = fullText.length - trimmedText.length
    const lastEntry = textNodes[textNodes.length - 1]
    if (lastEntry) {
      const currentText = lastEntry.node.textContent ?? ''
      lastEntry.node.textContent = currentText.slice(0, Math.max(0, currentText.length - trailingWhitespaceCount))
      lastEntry.end = trimmedText.length
    }
  }

  return {
    fullText: trimmedText,
    textNodes,
  }
}

function resolveTextBoundary(
  textNodes: Array<{ node: Text; start: number; end: number }>,
  offset: number,
) {
  const lastEntry = textNodes[textNodes.length - 1]
  if (!lastEntry) {
    return null
  }

  if (offset >= lastEntry.end) {
    return {
      node: lastEntry.node,
      offset: lastEntry.node.textContent?.length ?? 0,
    }
  }

  for (const entry of textNodes) {
    if (offset >= entry.start && offset <= entry.end) {
      return {
        node: entry.node,
        offset: offset - entry.start,
      }
    }
  }

  return null
}

function extractInlineSentenceHtml(element: HTMLElement, sentenceTexts: string[]) {
  const clone = element.cloneNode(true) as HTMLElement
  sanitizeInlineElement(clone)
  const { fullText, textNodes } = normalizeInlineTextNodes(clone)

  if (!fullText || textNodes.length === 0) {
    return {
      html: undefined,
      sentenceHtml: undefined,
      text: '',
    }
  }

  const sentenceHtml: string[] = []
  let searchCursor = 0

  for (const sentenceText of sentenceTexts) {
    const sentenceStart = fullText.indexOf(sentenceText, searchCursor)
    if (sentenceStart === -1) {
      return {
        html: clone.innerHTML.trim() || undefined,
        sentenceHtml: undefined,
        text: fullText,
      }
    }

    const sentenceEnd = sentenceStart + sentenceText.length
    const startBoundary = resolveTextBoundary(textNodes, sentenceStart)
    const endBoundary = resolveTextBoundary(textNodes, sentenceEnd)
    if (!startBoundary || !endBoundary) {
      return {
        html: clone.innerHTML.trim() || undefined,
        sentenceHtml: undefined,
        text: fullText,
      }
    }

    const range = clone.ownerDocument.createRange()
    range.setStart(startBoundary.node, startBoundary.offset)
    range.setEnd(endBoundary.node, endBoundary.offset)

    const container = clone.ownerDocument.createElement('div')
    container.append(range.cloneContents())
    sentenceHtml.push(container.innerHTML.trim() || sentenceText)
    searchCursor = sentenceEnd
  }

  return {
    html: clone.innerHTML.trim() || undefined,
    sentenceHtml,
    text: fullText,
  }
}

function extractParagraphDraft(element: Element): ExtractedParagraphDraft | null {
  const blockMeta = resolveParagraphBlockMeta(element.tagName)
  const sentenceTexts = segmentSpanishText(element.textContent ?? '')
  const inlineExtraction =
    element instanceof HTMLElement
      ? extractInlineSentenceHtml(element, sentenceTexts)
      : {
          html: undefined,
          sentenceHtml: undefined,
          text: (element.textContent ?? '').replace(/\s+/g, ' ').trim(),
        }

  if (!inlineExtraction.text) {
    return null
  }

  return {
    kind: blockMeta.kind,
    headingLevel: blockMeta.headingLevel,
    text: inlineExtraction.text,
    html: inlineExtraction.html,
    sentenceTexts,
    sentenceHtml:
      inlineExtraction.sentenceHtml?.length === sentenceTexts.length
        ? inlineExtraction.sentenceHtml
        : undefined,
  }
}

function extractParagraphBlocks(html: string): ChapterParagraphBlock[] {
  const parser = new DOMParser()
  const document = parser.parseFromString(html, 'text/html')
  document.querySelectorAll('script, style, nav, aside, svg, noscript').forEach((node) => node.remove())

  const candidates = Array.from(
    document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, blockquote, pre'),
  )
  const paragraphDrafts = candidates
    .map((element) => extractParagraphDraft(element))
    .filter((paragraph): paragraph is ExtractedParagraphDraft => Boolean(paragraph))

  if (paragraphDrafts.length > 0) {
    const sentenceTexts = paragraphDrafts.flatMap((paragraph) => paragraph.sentenceTexts)
    const sentences = createChapterSentenceItems(sentenceTexts)
    let sentenceCursor = 0

    return paragraphDrafts.map((paragraph) => {
      const paragraphSentenceIds = sentences
        .slice(sentenceCursor, sentenceCursor + paragraph.sentenceTexts.length)
        .map((sentence) => sentence.id)
      sentenceCursor += paragraph.sentenceTexts.length

      return createParagraphBlock(paragraph.text, {
        kind: paragraph.kind,
        headingLevel: paragraph.headingLevel,
        html: paragraph.html,
        sentenceIds: paragraphSentenceIds.length > 0 ? paragraphSentenceIds : undefined,
        sentenceTexts: paragraph.sentenceTexts,
        sentenceHtml:
          paragraph.sentenceHtml?.length === paragraphSentenceIds.length
            ? paragraph.sentenceHtml
            : undefined,
      })
    })
  }

  const fallbackText = createParagraphBlock(document.body?.textContent ?? '')
  return fallbackText.text ? [fallbackText] : []
}

async function sectionToDraft(
  section: Section,
  request: (path: string) => Promise<object>,
  order: number,
  title: string,
  sourceHref?: string,
) {
  await section.load(request)
  const html = section.document?.documentElement?.outerHTML ?? ''
  const paragraphBlocks = extractParagraphBlocks(html)
  const originalText = paragraphsToText(paragraphBlocks)
  const sourceText = originalText
  const storedSentenceTexts = paragraphBlocks.flatMap((paragraph) => paragraph.sentenceTexts ?? [])
  const sentences =
    storedSentenceTexts.length > 0 && storedSentenceTexts.every(Boolean)
      ? createChapterSentenceItems(storedSentenceTexts)
      : createChapterSentences(sourceText)
  section.unload()

  if (storedSentenceTexts.length > 0 && storedSentenceTexts.every(Boolean)) {
    let sentenceCursor = 0
    paragraphBlocks.forEach((paragraph) => {
      if (!paragraph.sentenceIds?.length) {
        return
      }

      paragraph.sentenceIds = sentences
        .slice(sentenceCursor, sentenceCursor + paragraph.sentenceIds.length)
        .map((sentence) => sentence.id)
      sentenceCursor += paragraph.sentenceIds.length
    })
  }

  return {
    title: title.trim() || `第 ${order + 1} 章`,
    order,
    epubHref: sourceHref || section.href || section.url || undefined,
    originalText,
    sourceText,
    paragraphBlocks,
    sentences,
    results: {},
    activeRange: null,
    lastReadEnd: -1,
    resumeAnchor: null,
  } satisfies ImportedChapterDraft
}

async function resolveCoverDataUrl(bookInstance: ReturnType<typeof ePub>) {
  try {
    const coverUrl = await bookInstance.coverUrl()
    if (!coverUrl) {
      return undefined
    }

    const response = await fetch(coverUrl)
    const blob = await response.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  } catch {
    return undefined
  }
}

function buildBookRecord(metadata: PackagingMetadataObject, chapterCount: number, coverUrl?: string): BookRecord {
  return {
    id: crypto.randomUUID(),
    title: metadata.title?.trim() || '未命名 EPUB',
    author: metadata.creator?.trim() || '作者未知',
    sourceType: 'epub',
    coverUrl,
    importedAt: new Date().toISOString(),
    chapterCount,
    analysisState: 'idle',
  }
}

async function buildChaptersFromToc(
  bookInstance: ReturnType<typeof ePub>,
  toc: NavItem[],
) {
  const flattened = flattenToc(toc)
  const seen = new Set<string>()
  const drafts: ImportedChapterDraft[] = []

  for (const item of flattened) {
    if (!item.href) {
      continue
    }

    const section = bookInstance.section(item.href)
    if (!section) {
      continue
    }

    const key = getSectionIdentifier(section)
    if (!key || seen.has(key)) {
      continue
    }

    seen.add(key)
    drafts.push(
      await sectionToDraft(
        section,
        bookInstance.load.bind(bookInstance) as (path: string) => Promise<object>,
        drafts.length,
        item.label || '未命名章节',
        item.href,
      ),
    )
  }

  return drafts
}

async function buildChaptersFromSpine(
  bookInstance: ReturnType<typeof ePub>,
  spineItems: SpineItem[],
) {
  const drafts: ImportedChapterDraft[] = []

  for (const item of spineItems) {
    const section = bookInstance.section(item.index)
    if (!section) {
      continue
    }

    drafts.push(
      await sectionToDraft(
        section,
        bookInstance.load.bind(bookInstance) as (path: string) => Promise<object>,
        drafts.length,
        item.href || `第 ${item.index + 1} 章`,
        item.href,
      ),
    )
  }

  return drafts
}

export async function importEpubBook(file: File): Promise<ImportedBookPayload> {
  const arrayBuffer = await file.arrayBuffer()
  const bookInstance = ePub(arrayBuffer)

  try {
    await bookInstance.ready
    const [metadata, navigation, spineItems, coverUrl] = await Promise.all([
      bookInstance.loaded.metadata,
      bookInstance.loaded.navigation,
      bookInstance.loaded.spine,
      resolveCoverDataUrl(bookInstance),
    ])

    const chapterDrafts =
      navigation.toc.length > 0
        ? await buildChaptersFromToc(bookInstance, navigation.toc)
        : await buildChaptersFromSpine(bookInstance, spineItems)

    if (chapterDrafts.length === 0) {
      throw new Error('这本 EPUB 没有找到可导入的章节内容。')
    }

    const book = buildBookRecord(metadata, chapterDrafts.length, coverUrl)
    const chapters: BookChapterRecord[] = chapterDrafts.map((chapterDraft) => ({
      id: crypto.randomUUID(),
      bookId: book.id,
      ...chapterDraft,
      analysisState: deriveChapterAnalysisState(chapterDraft.sentences, chapterDraft.results),
    }))

    return { book, chapters, fileData: arrayBuffer }
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }

    throw new Error('EPUB 导入失败，请确认文件没有损坏且未加密。')
  } finally {
    bookInstance.destroy()
  }
}
