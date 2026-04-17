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
  createChapterSentences,
  createParagraphBlock,
  deriveChapterAnalysisState,
  paragraphsToText,
} from './chapterText'

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

function extractParagraphBlocks(html: string): ChapterParagraphBlock[] {
  const parser = new DOMParser()
  const document = parser.parseFromString(html, 'text/html')
  document.querySelectorAll('script, style, nav, aside, svg, noscript').forEach((node) => node.remove())

  const candidates = Array.from(
    document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, blockquote, pre'),
  )
  const paragraphs = candidates
    .map((element) =>
      createParagraphBlock(element.textContent ?? '', resolveParagraphBlockMeta(element.tagName)),
    )
    .filter((paragraph) => paragraph.text.length > 0)

  if (paragraphs.length > 0) {
    return paragraphs
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
  const sentences = createChapterSentences(sourceText)
  section.unload()

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
