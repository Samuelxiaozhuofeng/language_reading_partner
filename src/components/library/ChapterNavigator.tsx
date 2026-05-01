import { useMemo, useState } from 'react'
import { chapterStatusLabelMap, formatTime } from '../../lib/appState'
import type { BookChapterRecord } from '../../types'

const CHAPTER_RANGE_SIZE = 10

type ChapterNavigatorProps = {
  chapters: BookChapterRecord[]
  selectedChapterId: string | null
  onDeleteChapter: (chapterId: string) => void
  onOpenChapterReading: (chapterId: string) => void
  onOpenChapterWorkspace: (chapterId: string) => void
}

function getChapterLabel(chapter: BookChapterRecord) {
  return `第 ${chapter.order + 1} 章 · ${chapter.title}`
}

function getRecentChapter(chapters: BookChapterRecord[]) {
  return chapters.reduce<BookChapterRecord | null>((recentChapter, chapter) => {
    if (!chapter.lastOpenedAt) {
      return recentChapter
    }

    if (!recentChapter?.lastOpenedAt) {
      return chapter
    }

    return Date.parse(chapter.lastOpenedAt) > Date.parse(recentChapter.lastOpenedAt)
      ? chapter
      : recentChapter
  }, null)
}

function getDefaultChapterId(chapters: BookChapterRecord[], selectedChapterId: string | null) {
  const selectedChapter = chapters.find((chapter) => chapter.id === selectedChapterId)

  return selectedChapter?.id ?? getRecentChapter(chapters)?.id ?? chapters[0]?.id ?? ''
}

function getChapterRangeIndex(chapters: BookChapterRecord[], chapterId: string) {
  const chapterIndex = chapters.findIndex((chapter) => chapter.id === chapterId)

  return chapterIndex >= 0 ? Math.floor(chapterIndex / CHAPTER_RANGE_SIZE) : 0
}

function getChapterRanges(chapters: BookChapterRecord[]) {
  return Array.from({ length: Math.ceil(chapters.length / CHAPTER_RANGE_SIZE) }, (_, index) => {
    const rangeChapters = chapters.slice(
      index * CHAPTER_RANGE_SIZE,
      index * CHAPTER_RANGE_SIZE + CHAPTER_RANGE_SIZE,
    )
    const firstChapter = rangeChapters[0]
    const lastChapter = rangeChapters[rangeChapters.length - 1]

    return {
      index,
      label: `${firstChapter.order + 1}-${lastChapter.order + 1}`,
    }
  })
}

function filterChapters(chapters: BookChapterRecord[], query: string) {
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) {
    return chapters
  }

  if (/^\d+$/.test(normalizedQuery)) {
    return chapters.filter((chapter) => String(chapter.order + 1).includes(normalizedQuery))
  }

  return chapters.filter((chapter) => chapter.title.toLowerCase().includes(normalizedQuery))
}

export default function ChapterNavigator({
  chapters,
  selectedChapterId,
  onDeleteChapter,
  onOpenChapterReading,
  onOpenChapterWorkspace,
}: ChapterNavigatorProps) {
  const orderedChapters = useMemo(
    () => [...chapters].sort((first, second) => first.order - second.order),
    [chapters],
  )
  const [quickChapterId, setQuickChapterId] = useState(() =>
    getDefaultChapterId(orderedChapters, selectedChapterId),
  )
  const [chapterQuery, setChapterQuery] = useState('')
  const [activeRangeIndex, setActiveRangeIndex] = useState(() =>
    getChapterRangeIndex(orderedChapters, quickChapterId),
  )
  const defaultChapterId = getDefaultChapterId(orderedChapters, selectedChapterId)
  const effectiveQuickChapterId = orderedChapters.some((chapter) => chapter.id === quickChapterId)
    ? quickChapterId
    : defaultChapterId
  const quickChapter = orderedChapters.find((chapter) => chapter.id === effectiveQuickChapterId)
  const trimmedQuery = chapterQuery.trim()
  const chapterRanges = useMemo(() => getChapterRanges(orderedChapters), [orderedChapters])
  const recentChapterId = useMemo(() => getRecentChapter(orderedChapters)?.id ?? null, [orderedChapters])
  const safeActiveRangeIndex = Math.min(activeRangeIndex, Math.max(0, chapterRanges.length - 1))
  const visibleChapters = useMemo(() => {
    if (trimmedQuery) {
      return filterChapters(orderedChapters, trimmedQuery)
    }

    const rangeStart = safeActiveRangeIndex * CHAPTER_RANGE_SIZE
    return orderedChapters.slice(rangeStart, rangeStart + CHAPTER_RANGE_SIZE)
  }, [orderedChapters, safeActiveRangeIndex, trimmedQuery])

  const handleQuickChapterChange = (chapterId: string) => {
    setQuickChapterId(chapterId)
    setActiveRangeIndex(getChapterRangeIndex(orderedChapters, chapterId))
  }

  const handleOpenChapterReading = (chapterId: string) => {
    handleQuickChapterChange(chapterId)
    onOpenChapterReading(chapterId)
  }

  const handleOpenChapterWorkspace = (chapterId: string) => {
    handleQuickChapterChange(chapterId)
    onOpenChapterWorkspace(chapterId)
  }

  return (
    <div className="chapter-navigator">
      <div className="chapter-nav-toolbar" aria-label="章节快速导航">
        <label className="chapter-nav-field">
          <span>章节选择</span>
          <select
            value={effectiveQuickChapterId}
            onChange={(event) => handleQuickChapterChange(event.target.value)}
          >
            {orderedChapters.map((chapter) => (
              <option key={chapter.id} value={chapter.id}>
                {getChapterLabel(chapter)}
              </option>
            ))}
          </select>
        </label>

        <label className="chapter-nav-field chapter-nav-search">
          <span>搜索章节</span>
          <input
            type="search"
            value={chapterQuery}
            onChange={(event) => setChapterQuery(event.target.value)}
            placeholder="输入章节号或标题"
          />
        </label>

        <div className="chapter-nav-actions">
          <button
            className="primary-button"
            type="button"
            onClick={() => quickChapter && handleOpenChapterReading(quickChapter.id)}
            disabled={!quickChapter}
          >
            阅读
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => quickChapter && handleOpenChapterWorkspace(quickChapter.id)}
            disabled={!quickChapter}
          >
            工作区
          </button>
        </div>
      </div>

      {chapterRanges.length > 1 && !trimmedQuery ? (
        <div className="chapter-range-tabs" aria-label="章节分段">
          {chapterRanges.map((range) => (
            <button
              className={`chapter-range-tab ${safeActiveRangeIndex === range.index ? 'is-active' : ''}`}
              key={range.index}
              type="button"
              onClick={() => setActiveRangeIndex(range.index)}
            >
              {range.label}
            </button>
          ))}
        </div>
      ) : null}

      {visibleChapters.length === 0 ? (
        <div className="empty-state compact chapter-empty-state">
          <p>没有匹配的章节。</p>
        </div>
      ) : (
        <div className="chapter-list" aria-label="章节目录">
          {visibleChapters.map((chapter) => (
            <article
              className={`chapter-card chapter-row ${selectedChapterId === chapter.id ? 'is-active' : ''} ${
                recentChapterId === chapter.id ? 'is-recent' : ''
              }`}
              key={chapter.id}
            >
              <div className="chapter-card-copy">
                <div className="chapter-card-header">
                  <span className="sentence-index">第 {chapter.order + 1} 章</span>
                  <span className="status-pill">{chapterStatusLabelMap[chapter.analysisState]}</span>
                </div>
                <h3>{chapter.title}</h3>
                <div className="chapter-card-meta">
                  <span>{chapter.sentences.length} 句可解析</span>
                  {chapter.lastOpenedAt ? <span>最近打开 {formatTime(chapter.lastOpenedAt)}</span> : null}
                </div>
              </div>

              <div className="chapter-card-actions">
                <button className="secondary-button" type="button" onClick={() => handleOpenChapterWorkspace(chapter.id)}>
                  工作区
                </button>
                <button className="ghost-button" type="button" onClick={() => handleOpenChapterReading(chapter.id)}>
                  阅读
                </button>
                <button className="ghost-button danger-button" type="button" onClick={() => onDeleteChapter(chapter.id)}>
                  删除
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
