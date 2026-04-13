import { formatTime } from './appState'
import { knowledgeKindLabelMap } from './knowledge'
import type { SavedKnowledgeResource } from '../types'

export type ResourceExportOptions = {
  includeBookTitle: boolean
  includeChapterTitle: boolean
  includeSavedAt: boolean
}

function escapeMarkdown(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '  \n').trim()
}

function buildMetadataLines(resource: SavedKnowledgeResource, options: ResourceExportOptions) {
  const lines: string[] = []

  if (options.includeBookTitle) {
    lines.push(`- 书籍：${escapeMarkdown(resource.bookTitle || '未绑定书籍')}`)
  }

  if (options.includeChapterTitle) {
    lines.push(`- 章节：${escapeMarkdown(resource.chapterTitle || '未绑定章节')}`)
  }

  if (options.includeSavedAt) {
    lines.push(`- 收藏时间：${escapeMarkdown(formatTime(resource.savedAt))}`)
  }

  return lines
}

export function renderResourcesAsMarkdown(
  resources: SavedKnowledgeResource[],
  options: ResourceExportOptions,
) {
  const lines = [
    '# 学习资源导出',
    '',
    `导出时间：${formatTime(new Date().toISOString())}`,
    `知识点数量：${resources.length}`,
    '',
  ]

  for (const [index, resource] of resources.entries()) {
    lines.push(`## ${index + 1}. ${escapeMarkdown(resource.text || '未命名条目')}`)
    lines.push('')
    lines.push(`- 类型：${knowledgeKindLabelMap[resource.kind]}`)

    const metadataLines = buildMetadataLines(resource, options)
    lines.push(...metadataLines)

    lines.push('')
    lines.push('### 知识点说明')
    lines.push(escapeMarkdown(resource.explanation || '暂无说明'))
    lines.push('')

    if (resource.meaning) {
      lines.push('### 释义')
      lines.push(escapeMarkdown(resource.meaning))
      lines.push('')
    }

    if (resource.grammarText) {
      lines.push('### 语法解析')
      lines.push(escapeMarkdown(resource.grammarText))
      lines.push('')
    }

    lines.push('### 来源句子')
    lines.push(escapeMarkdown(resource.sentenceText || '未提供来源句子'))
    lines.push('')
  }

  return `${lines.join('\n').trim()}\n`
}

export function downloadMarkdownFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = filename
  anchor.click()

  URL.revokeObjectURL(url)
}
