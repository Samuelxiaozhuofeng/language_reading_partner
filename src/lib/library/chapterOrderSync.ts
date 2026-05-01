import type { BookChapterRecord } from '../../types'

export function getChaptersRequiringOrderSync(
  currentChapters: BookChapterRecord[],
  nextChapters: BookChapterRecord[],
) {
  const currentOrderById = new Map(
    currentChapters.map((chapter) => [chapter.id, chapter.order]),
  )

  return nextChapters
    .filter((chapter) => currentOrderById.get(chapter.id) !== chapter.order)
    .sort((left, right) => left.order - right.order)
}
