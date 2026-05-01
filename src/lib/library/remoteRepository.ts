import type {
  AnalysisResult,
  BookChapterRecord,
  BookLanguage,
  BookRecord,
  ChapterAnalysisState,
  ChapterParagraphBlock,
  CollectionRecord,
  KnowledgeKind,
  ReadingResumeAnchor,
  SavedKnowledgeResource,
  SentenceItem,
  SentenceRange,
} from '../../types'
import { supabase } from '../supabase/client'
import type { Database, Json } from '../supabase/database'

const BOOK_FILES_BUCKET = 'book-files'

type BookRow = Database['public']['Tables']['books']['Row']
type BookInsert = Database['public']['Tables']['books']['Insert']
type BookUpdate = Database['public']['Tables']['books']['Update']
type ChapterRow = Database['public']['Tables']['chapters']['Row']
type ChapterInsert = Database['public']['Tables']['chapters']['Insert']
type ChapterUpdate = Database['public']['Tables']['chapters']['Update']
type CollectionRow = Database['public']['Tables']['collections']['Row']
type CollectionInsert = Database['public']['Tables']['collections']['Insert']
type ResourceRow = Database['public']['Tables']['resources']['Row']
type ResourceInsert = Database['public']['Tables']['resources']['Insert']

function getClient() {
  if (!supabase) {
    throw new Error('缺少 Supabase 配置，无法访问云端书架。')
  }

  return supabase
}

function toJson(value: unknown): Json {
  return value as Json
}

function sortBooks(books: BookRecord[]) {
  return books.sort((left, right) => {
    const leftTime = left.lastOpenedAt ?? left.importedAt
    const rightTime = right.lastOpenedAt ?? right.importedAt
    return rightTime.localeCompare(leftTime)
  })
}

function buildBookFilePath(userId: string, bookId: string) {
  return `${userId}/${bookId}/original.epub`
}

function toBook(row: BookRow): BookRecord {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    language: (row.language ?? undefined) as BookLanguage | undefined,
    sourceType: (row.source_type ?? undefined) as BookRecord['sourceType'],
    coverUrl: row.cover_url ?? undefined,
    collectionId: row.collection_id ?? undefined,
    epubFilePath: row.epub_file_path ?? undefined,
    importedAt: row.imported_at,
    chapterCount: row.chapter_count,
    lastReadChapterId: row.last_read_chapter_id ?? undefined,
    lastOpenedAt: row.last_opened_at ?? undefined,
    analysisState: row.analysis_state as ChapterAnalysisState,
  }
}

function toBookInsert(userId: string, book: BookRecord): BookInsert {
  return {
    id: book.id,
    user_id: userId,
    title: book.title,
    author: book.author,
    language: book.language ?? null,
    source_type: book.sourceType ?? null,
    cover_url: book.coverUrl ?? null,
    collection_id: book.collectionId ?? null,
    epub_file_path: book.epubFilePath ?? null,
    imported_at: book.importedAt,
    chapter_count: book.chapterCount,
    last_read_chapter_id: book.lastReadChapterId ?? null,
    last_opened_at: book.lastOpenedAt ?? null,
    analysis_state: book.analysisState,
  }
}

function toCollection(row: CollectionRow): CollectionRecord {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
  }
}

function toCollectionInsert(userId: string, collection: CollectionRecord): CollectionInsert {
  return {
    id: collection.id,
    user_id: userId,
    name: collection.name,
    created_at: collection.createdAt,
  }
}

function toChapter(row: ChapterRow): BookChapterRecord {
  return {
    id: row.id,
    bookId: row.book_id,
    title: row.title,
    order: row.order_index,
    epubHref: row.epub_href ?? undefined,
    originalText: row.original_text,
    sourceText: row.source_text,
    paragraphBlocks: row.paragraph_blocks as ChapterParagraphBlock[],
    sentences: row.sentences as SentenceItem[],
    results: row.results as Record<string, AnalysisResult>,
    analysisState: row.analysis_state as ChapterAnalysisState,
    activeRange: row.active_range as SentenceRange | null,
    lastReadEnd: row.last_read_end,
    lastOpenedAt: row.last_opened_at ?? undefined,
    resumeAnchor: row.resume_anchor as ReadingResumeAnchor | null,
  }
}

function toChapterInsert(userId: string, chapter: BookChapterRecord): ChapterInsert {
  return {
    id: chapter.id,
    user_id: userId,
    book_id: chapter.bookId,
    title: chapter.title,
    order_index: chapter.order,
    epub_href: chapter.epubHref ?? null,
    original_text: chapter.originalText,
    source_text: chapter.sourceText,
    paragraph_blocks: toJson(chapter.paragraphBlocks),
    sentences: toJson(chapter.sentences),
    results: toJson(chapter.results),
    analysis_state: chapter.analysisState,
    active_range: toJson(chapter.activeRange),
    last_read_end: chapter.lastReadEnd,
    last_opened_at: chapter.lastOpenedAt ?? null,
    resume_anchor: toJson(chapter.resumeAnchor ?? null),
  }
}

function toChapterUpdate(chapter: BookChapterRecord): ChapterUpdate {
  return {
    book_id: chapter.bookId,
    title: chapter.title,
    order_index: chapter.order,
    epub_href: chapter.epubHref ?? null,
    original_text: chapter.originalText,
    source_text: chapter.sourceText,
    paragraph_blocks: toJson(chapter.paragraphBlocks),
    sentences: toJson(chapter.sentences),
    results: toJson(chapter.results),
    analysis_state: chapter.analysisState,
    active_range: toJson(chapter.activeRange),
    last_read_end: chapter.lastReadEnd,
    last_opened_at: chapter.lastOpenedAt ?? null,
    resume_anchor: toJson(chapter.resumeAnchor ?? null),
  }
}

function toResource(row: ResourceRow): SavedKnowledgeResource {
  return {
    id: row.id,
    signature: row.signature,
    text: row.text,
    kind: row.kind as KnowledgeKind,
    explanation: row.explanation,
    grammarText: row.grammar_text,
    meaning: row.meaning ?? undefined,
    sentenceId: row.sentence_id,
    sentenceText: row.sentence_text,
    savedAt: row.saved_at,
    bookId: row.book_id ?? undefined,
    bookTitle: row.book_title ?? undefined,
    chapterId: row.chapter_id ?? undefined,
    chapterTitle: row.chapter_title ?? undefined,
  }
}

function toResourceInsert(userId: string, resource: SavedKnowledgeResource): ResourceInsert {
  return {
    id: resource.id,
    user_id: userId,
    signature: resource.signature,
    text: resource.text,
    kind: resource.kind,
    explanation: resource.explanation,
    grammar_text: resource.grammarText,
    meaning: resource.meaning ?? null,
    sentence_id: resource.sentenceId,
    sentence_text: resource.sentenceText,
    saved_at: resource.savedAt,
    book_id: resource.bookId ?? null,
    book_title: resource.bookTitle ?? null,
    chapter_id: resource.chapterId ?? null,
    chapter_title: resource.chapterTitle ?? null,
  }
}

async function uploadBookFile(userId: string, bookId: string, fileData: ArrayBuffer) {
  const client = getClient()
  const filePath = buildBookFilePath(userId, bookId)
  const { error } = await client.storage
    .from(BOOK_FILES_BUCKET)
    .upload(filePath, new Blob([fileData], { type: 'application/epub+zip' }), {
      contentType: 'application/epub+zip',
      upsert: true,
    })

  if (error) {
    throw new Error(`EPUB 文件上传失败：${error.message}`)
  }

  return filePath
}

async function removeBookFiles(filePaths: string[]) {
  const uniqueFilePaths = Array.from(new Set(filePaths.filter(Boolean)))
  if (uniqueFilePaths.length === 0) {
    return
  }

  const { error } = await getClient().storage.from(BOOK_FILES_BUCKET).remove(uniqueFilePaths)
  if (error) {
    throw new Error(`EPUB 文件删除失败：${error.message}`)
  }
}

export async function getBooks(userId: string) {
  const { data, error } = await getClient()
    .from('books')
    .select('*')
    .eq('user_id', userId)

  if (error) {
    throw new Error(`书籍载入失败：${error.message}`)
  }

  return sortBooks((data ?? []).map(toBook))
}

export async function getBook(userId: string, bookId: string) {
  const { data, error } = await getClient()
    .from('books')
    .select('*')
    .eq('user_id', userId)
    .eq('id', bookId)
    .maybeSingle()

  if (error) {
    throw new Error(`书籍载入失败：${error.message}`)
  }

  return data ? toBook(data) : null
}

export async function getCollections(userId: string) {
  const { data, error } = await getClient()
    .from('collections')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`集合载入失败：${error.message}`)
  }

  return (data ?? []).map(toCollection)
}

export async function saveCollection(userId: string, collection: CollectionRecord) {
  const { error } = await getClient()
    .from('collections')
    .upsert(toCollectionInsert(userId, collection))

  if (error) {
    throw new Error(`集合保存失败：${error.message}`)
  }
}

export async function deleteCollection(userId: string, collectionId: string) {
  const client = getClient()
  const collection = await client
    .from('collections')
    .select('id')
    .eq('user_id', userId)
    .eq('id', collectionId)
    .maybeSingle()

  if (collection.error) {
    throw new Error(`集合载入失败：${collection.error.message}`)
  }

  if (!collection.data) {
    throw new Error('集合不存在，可能已经被删除。')
  }

  const movedBooks = await client
    .from('books')
    .update({ collection_id: null })
    .eq('user_id', userId)
    .eq('collection_id', collectionId)

  if (movedBooks.error) {
    throw new Error(`集合内书籍移动失败：${movedBooks.error.message}`)
  }

  const deleted = await client
    .from('collections')
    .delete()
    .eq('user_id', userId)
    .eq('id', collectionId)

  if (deleted.error) {
    throw new Error(`集合删除失败：${deleted.error.message}`)
  }
}

export async function updateBookCollection(
  userId: string,
  bookId: string,
  collectionId: string | null,
) {
  const client = getClient()
  if (collectionId) {
    const collection = await client
      .from('collections')
      .select('id')
      .eq('user_id', userId)
      .eq('id', collectionId)
      .maybeSingle()

    if (collection.error) {
      throw new Error(`目标集合载入失败：${collection.error.message}`)
    }

    if (!collection.data) {
      throw new Error('目标集合不存在，可能已经被删除。')
    }
  }

  const { data, error } = await client
    .from('books')
    .update({ collection_id: collectionId })
    .eq('user_id', userId)
    .eq('id', bookId)
    .select()
    .maybeSingle()

  if (error) {
    throw new Error(`书籍集合更新失败：${error.message}`)
  }

  return data ? toBook(data) : null
}

export async function getChaptersByBook(userId: string, bookId: string) {
  const { data, error } = await getClient()
    .from('chapters')
    .select('*')
    .eq('user_id', userId)
    .eq('book_id', bookId)
    .order('order_index', { ascending: true })

  if (error) {
    throw new Error(`章节载入失败：${error.message}`)
  }

  return (data ?? []).map(toChapter)
}

export async function getChapter(userId: string, chapterId: string) {
  const { data, error } = await getClient()
    .from('chapters')
    .select('*')
    .eq('user_id', userId)
    .eq('id', chapterId)
    .maybeSingle()

  if (error) {
    throw new Error(`章节载入失败：${error.message}`)
  }

  return data ? toChapter(data) : null
}

export async function getBookFile(userId: string, bookId: string) {
  const book = await getBook(userId, bookId)
  if (!book?.epubFilePath) {
    return null
  }

  const { data, error } = await getClient().storage
    .from(BOOK_FILES_BUCKET)
    .download(book.epubFilePath)

  if (error) {
    throw new Error(`EPUB 文件下载失败：${error.message}`)
  }

  return data.arrayBuffer()
}

export async function saveImportedBook(
  userId: string,
  book: BookRecord,
  chapters: BookChapterRecord[],
  fileData?: ArrayBuffer | null,
) {
  const epubFilePath = fileData
    ? await uploadBookFile(userId, book.id, fileData)
    : book.epubFilePath
  const nextBook: BookRecord = epubFilePath ? { ...book, epubFilePath } : { ...book }
  const client = getClient()
  const savedBook = await client.from('books').upsert(toBookInsert(userId, nextBook)).select().single()

  if (savedBook.error) {
    throw new Error(`书籍保存失败：${savedBook.error.message}`)
  }

  if (chapters.length > 0) {
    const savedChapters = await client
      .from('chapters')
      .upsert(chapters.map((chapter) => toChapterInsert(userId, chapter)))

    if (savedChapters.error) {
      throw new Error(`章节保存失败：${savedChapters.error.message}`)
    }
  }

  return toBook(savedBook.data)
}

export async function saveBook(userId: string, book: BookRecord) {
  const { data, error } = await getClient()
    .from('books')
    .upsert(toBookInsert(userId, book))
    .select()
    .single()

  if (error) {
    throw new Error(`书籍保存失败：${error.message}`)
  }

  return toBook(data)
}

export async function saveChapter(userId: string, chapter: BookChapterRecord) {
  const { data, error } = await getClient()
    .from('chapters')
    .upsert(toChapterInsert(userId, chapter))
    .select()
    .single()

  if (error) {
    throw new Error(`章节保存失败：${error.message}`)
  }

  return toChapter(data)
}

export async function updateChapterSnapshot(userId: string, chapter: BookChapterRecord) {
  const { data, error } = await getClient()
    .from('chapters')
    .update(toChapterUpdate(chapter))
    .eq('user_id', userId)
    .eq('id', chapter.id)
    .select('id')
    .maybeSingle()

  if (error) {
    throw new Error(`章节保存失败：${error.message}`)
  }

  if (!data) {
    throw new Error('章节保存失败：没有匹配到可更新的章节。')
  }
}

export async function updateBookSnapshotSummary(userId: string, book: BookRecord) {
  const values: BookUpdate = {
    chapter_count: book.chapterCount,
    last_read_chapter_id: book.lastReadChapterId ?? null,
    last_opened_at: book.lastOpenedAt ?? null,
    analysis_state: book.analysisState,
  }
  const { data, error } = await getClient()
    .from('books')
    .update(values)
    .eq('user_id', userId)
    .eq('id', book.id)
    .select('id')
    .maybeSingle()

  if (error) {
    throw new Error(`书籍摘要保存失败：${error.message}`)
  }

  if (!data) {
    throw new Error('书籍摘要保存失败：没有匹配到可更新的书籍。')
  }
}

export async function updateBookReadingProgress(
  userId: string,
  bookId: string,
  chapterId: string,
  lastOpenedAt: string,
) {
  const { data, error } = await getClient()
    .from('books')
    .update({
      last_read_chapter_id: chapterId,
      last_opened_at: lastOpenedAt,
    })
    .eq('user_id', userId)
    .eq('id', bookId)
    .select('id')
    .maybeSingle()

  if (error) {
    throw new Error(`书籍阅读进度更新失败：${error.message}`)
  }

  if (!data) {
    throw new Error('书籍阅读进度更新失败：没有匹配到可更新的书籍。')
  }
}

export async function updateChapterLastOpenedAt(
  userId: string,
  chapterId: string,
  lastOpenedAt: string,
) {
  const { data, error } = await getClient()
    .from('chapters')
    .update({ last_opened_at: lastOpenedAt })
    .eq('user_id', userId)
    .eq('id', chapterId)
    .select('id')
    .maybeSingle()

  if (error) {
    throw new Error(`章节打开时间更新失败：${error.message}`)
  }

  if (!data) {
    throw new Error('章节打开时间更新失败：没有匹配到可更新的章节。')
  }
}

export async function deleteChapterCascade(userId: string, chapterId: string) {
  const chapter = await getChapter(userId, chapterId)
  if (!chapter) {
    return null
  }

  const resources = await getClient()
    .from('resources')
    .delete()
    .eq('user_id', userId)
    .eq('chapter_id', chapterId)

  if (resources.error) {
    throw new Error(`章节学习资源删除失败：${resources.error.message}`)
  }

  const deleted = await getClient()
    .from('chapters')
    .delete()
    .eq('user_id', userId)
    .eq('id', chapterId)
    .select('id')
    .maybeSingle()

  if (deleted.error) {
    throw new Error(`章节删除失败：${deleted.error.message}`)
  }

  if (!deleted.data) {
    throw new Error('章节删除失败：没有匹配到可删除的章节。')
  }

  return chapter
}

export async function getSavedResources(userId: string) {
  const { data, error } = await getClient()
    .from('resources')
    .select('*')
    .eq('user_id', userId)
    .order('saved_at', { ascending: false })

  if (error) {
    throw new Error(`学习资源载入失败：${error.message}`)
  }

  return (data ?? []).map(toResource)
}

export async function getSavedResourceBySignature(userId: string, signature: string) {
  const { data, error } = await getClient()
    .from('resources')
    .select('*')
    .eq('user_id', userId)
    .eq('signature', signature)
    .maybeSingle()

  if (error) {
    throw new Error(`学习资源载入失败：${error.message}`)
  }

  return data ? toResource(data) : null
}

export async function saveKnowledgeResource(userId: string, resource: SavedKnowledgeResource) {
  const { data, error } = await getClient()
    .from('resources')
    .upsert(toResourceInsert(userId, resource), { onConflict: 'user_id,signature' })
    .select()
    .single()

  if (error) {
    throw new Error(`学习资源保存失败：${error.message}`)
  }

  return toResource(data)
}

export async function deleteKnowledgeResource(userId: string, resourceId: string) {
  const { error } = await getClient()
    .from('resources')
    .delete()
    .eq('user_id', userId)
    .eq('id', resourceId)

  if (error) {
    throw new Error(`学习资源删除失败：${error.message}`)
  }
}

export async function deleteKnowledgeResources(userId: string, resourceIds: string[]) {
  if (resourceIds.length === 0) {
    return
  }

  const { error } = await getClient()
    .from('resources')
    .delete()
    .eq('user_id', userId)
    .in('id', resourceIds)

  if (error) {
    throw new Error(`学习资源批量删除失败：${error.message}`)
  }
}

export async function deleteBookCascade(userId: string, bookId: string) {
  const book = await getBook(userId, bookId)
  if (!book) {
    return
  }

  await removeBookFiles(book.epubFilePath ? [book.epubFilePath] : [])

  const resources = await getClient()
    .from('resources')
    .delete()
    .eq('user_id', userId)
    .eq('book_id', bookId)

  if (resources.error) {
    throw new Error(`书籍学习资源删除失败：${resources.error.message}`)
  }

  const deleted = await getClient()
    .from('books')
    .delete()
    .eq('user_id', userId)
    .eq('id', bookId)

  if (deleted.error) {
    throw new Error(`书籍删除失败：${deleted.error.message}`)
  }
}

export async function clearLibraryDb(userId: string) {
  const books = await getBooks(userId)
  await removeBookFiles(books.flatMap((book) => (book.epubFilePath ? [book.epubFilePath] : [])))

  const client = getClient()
  const resources = await client.from('resources').delete().eq('user_id', userId)
  if (resources.error) {
    throw new Error(`学习资源清空失败：${resources.error.message}`)
  }

  const booksDeletion = await client.from('books').delete().eq('user_id', userId)
  if (booksDeletion.error) {
    throw new Error(`书籍清空失败：${booksDeletion.error.message}`)
  }

  const collections = await client.from('collections').delete().eq('user_id', userId)
  if (collections.error) {
    throw new Error(`集合清空失败：${collections.error.message}`)
  }
}
