import { useMemo, useState } from 'react'
import { formatTime } from '../lib/appState'
import { knowledgeKindLabelMap } from '../lib/knowledge'
import {
  downloadMarkdownFile,
  renderResourcesAsMarkdown,
  type ResourceExportOptions,
} from '../lib/resourceExport'
import type { KnowledgeKind, SavedKnowledgeResource } from '../types'

export type ResourcesPageProps = {
  activeKind: KnowledgeKind | 'all'
  canBackToReading?: boolean
  onBackToLibrary: () => void
  onBackToReading?: () => void
  onDeleteResource: (resourceId: string) => void
  onDeleteResources: (resourceIds: string[]) => void | Promise<void>
  onKindChange: (kind: KnowledgeKind | 'all') => void
  resources: SavedKnowledgeResource[]
  subtitle?: string
  title?: string
}

function ResourcesPage({
  activeKind,
  canBackToReading = true,
  onBackToLibrary,
  onBackToReading,
  onDeleteResource,
  onDeleteResources,
  onKindChange,
  resources,
  subtitle = '把你在阅读中遇到的语法点、词汇搭配和表达整理成一个可回看、可筛选的学习清单。',
  title = '学习资源',
}: ResourcesPageProps) {
  const [exportOptions, setExportOptions] = useState<ResourceExportOptions>({
    includeBookTitle: true,
    includeChapterTitle: true,
    includeSavedAt: true,
  })
  const [removeAfterExport, setRemoveAfterExport] = useState(false)
  const [exportMessage, setExportMessage] = useState('')
  const [exportError, setExportError] = useState('')

  const availableKinds = useMemo(() => {
    const counts = new Map<KnowledgeKind, number>()

    for (const resource of resources) {
      counts.set(resource.kind, (counts.get(resource.kind) ?? 0) + 1)
    }

    return Array.from(counts.entries())
      .map(([kind, count]) => ({
        kind,
        count,
        label: knowledgeKindLabelMap[kind],
      }))
      .sort((left, right) => {
        if (left.count !== right.count) {
          return right.count - left.count
        }

        return left.label.localeCompare(right.label, 'zh-CN')
      })
  }, [resources])

  const visibleResources = useMemo(() => {
    if (activeKind === 'all') {
      return resources
    }

    return resources.filter((resource) => resource.kind === activeKind)
  }, [activeKind, resources])

  const totalKinds = availableKinds.length
  const backToReadingDisabled = !onBackToReading || !canBackToReading

  const renderCheckbox = (
    checked: boolean,
    label: string,
    onChange: (checked: boolean) => void,
  ) => (
    <label className="export-checkbox">
      <input checked={checked} type="checkbox" onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  )

  const handleExport = async () => {
    if (resources.length === 0) {
      setExportMessage('')
      setExportError('当前没有可导出的知识点。')
      return
    }

    try {
      const markdown = renderResourcesAsMarkdown(resources, exportOptions)
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
      downloadMarkdownFile(markdown, `学习资源导出-${timestamp}.md`)

      if (removeAfterExport) {
        await onDeleteResources(resources.map((resource) => resource.id))
      }

      setExportError('')
      setExportMessage(
        removeAfterExport
          ? `已导出 ${resources.length} 条知识点，并按你的设置从本地学习资源中删除。`
          : `已导出 ${resources.length} 条知识点为 Markdown 文件。`,
      )
    } catch (error) {
      setExportMessage('')
      setExportError(error instanceof Error ? error.message : '导出失败，请稍后重试。')
    }
  }

  return (
    <main className="resources-page">
      <header className="hero-panel">
        <div className="hero-copy">
          <div className="hero-topline">
            <p className="eyebrow">Spanish Reading Copilot</p>
            <div className="hero-actions">
              <button className="page-tab" type="button" onClick={onBackToLibrary}>
                返回书架
              </button>
              <button
                className="ghost-button"
                disabled={backToReadingDisabled}
                type="button"
                onClick={() => onBackToReading?.()}
              >
                返回阅读
              </button>
            </div>
          </div>

          <h1>{title}</h1>
          <p className="hero-description">{subtitle}</p>

          <div className="library-hero-actions">
            <button className="primary-button" type="button" onClick={onBackToLibrary}>
              回到书架继续阅读
            </button>
            <button
              className="ghost-button"
              disabled={backToReadingDisabled}
              type="button"
              onClick={() => onBackToReading?.()}
            >
              回到当前阅读位置
            </button>
          </div>
        </div>

        <div className="hero-metrics library-metrics">
          <div className="metric-card">
            <span className="metric-label">收藏总数</span>
            <strong>{resources.length}</strong>
            <p>条学习资源</p>
          </div>
          <div className="metric-card">
            <span className="metric-label">当前筛选</span>
            <strong>{activeKind === 'all' ? '全部' : knowledgeKindLabelMap[activeKind]}</strong>
            <p>{totalKinds ? `${totalKinds} 个类别` : '暂无分类'}</p>
          </div>
          <div className="metric-card">
            <span className="metric-label">当前展示</span>
            <strong>{visibleResources.length}</strong>
            <p>条记录</p>
          </div>
        </div>
      </header>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="section-kicker">Export</p>
            <h2>导出全部知识点</h2>
          </div>
          <p className="panel-meta">导出会生成结构化 Markdown 文件，不受当前筛选影响，默认包含全部收藏内容。</p>
        </div>

        <div className="export-panel">
          <div className="export-options-grid">
            <div className="export-option-group">
              <span>导出字段</span>
              {renderCheckbox(exportOptions.includeBookTitle, '书籍', (checked) =>
                setExportOptions((current) => ({
                  ...current,
                  includeBookTitle: checked,
                })),
              )}
              {renderCheckbox(exportOptions.includeChapterTitle, '章节', (checked) =>
                setExportOptions((current) => ({
                  ...current,
                  includeChapterTitle: checked,
                })),
              )}
              {renderCheckbox(exportOptions.includeSavedAt, '收藏时间', (checked) =>
                setExportOptions((current) => ({
                  ...current,
                  includeSavedAt: checked,
                })),
              )}
            </div>

            <div className="export-option-group">
              <span>导出后处理</span>
              {renderCheckbox(removeAfterExport, '导出后删除知识点', setRemoveAfterExport)}
            </div>
          </div>

          <div className="export-actions">
            <button className="primary-button" type="button" onClick={() => void handleExport()}>
              导出 Markdown
            </button>
            <span className="panel-meta">导出的文件会下载到浏览器默认下载目录。</span>
          </div>

          {exportMessage ? <p className="notice success">{exportMessage}</p> : null}
          {exportError ? <p className="notice error">{exportError}</p> : null}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="section-kicker">Resources</p>
            <h2>按知识点类型筛选</h2>
          </div>
          <p className="panel-meta">
            你可以把 AI 解释里的语法点、词汇、搭配或固定表达收集起来，后面统一在这里复习。
          </p>
        </div>

        <div
          aria-label="资源类型筛选"
          className="model-chip-list"
          role="tablist"
          style={{ marginBottom: 20 }}
        >
          <button
            className={`model-chip ${activeKind === 'all' ? 'is-active' : ''}`}
            type="button"
            onClick={() => onKindChange('all')}
          >
            全部
            <span style={{ marginLeft: 8, opacity: 0.72 }}>{resources.length}</span>
          </button>

          {availableKinds.map((kindItem) => (
            <button
              className={`model-chip ${activeKind === kindItem.kind ? 'is-active' : ''}`}
              key={kindItem.kind}
              type="button"
              onClick={() => onKindChange(kindItem.kind)}
            >
              {kindItem.label}
              <span style={{ marginLeft: 8, opacity: 0.72 }}>{kindItem.count}</span>
            </button>
          ))}
        </div>

        {visibleResources.length === 0 ? (
          <div className="empty-state">
            <p>当前筛选下还没有内容。你可以先从阅读页保存一些语法点或词汇，再回来查看。</p>
          </div>
        ) : (
          <div className="history-list">
            {visibleResources.map((resource) => (
              <article
                className="history-card"
                key={resource.id}
                style={{
                  display: 'grid',
                  gap: 14,
                  padding: 20,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 16,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'grid', gap: 8, minWidth: 0, flex: 1 }}>
                    <div className="result-card-header" style={{ marginBottom: 0 }}>
                      <span className="sentence-index">{knowledgeKindLabelMap[resource.kind]}</span>
                      <span className="status-pill">已收藏</span>
                    </div>
                    <h3 style={{ margin: 0 }}>{resource.text || '未命名条目'}</h3>
                    <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.7 }}>
                      {resource.explanation || '暂无说明'}
                    </p>
                  </div>

                  <button
                    className="ghost-button danger-button"
                    type="button"
                    onClick={() => onDeleteResource(resource.id)}
                  >
                    删除条目
                  </button>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gap: 10,
                    paddingTop: 4,
                    borderTop: '1px solid rgba(61, 58, 56, 0.12)',
                  }}
                >
                  <div style={{ display: 'grid', gap: 6 }}>
                      <span className="panel-meta" style={{ margin: 0 }}>
                        来源句子
                      </span>
                      <p style={{ margin: 0, lineHeight: 1.8 }}>
                      {resource.sentenceText || '未提供来源句子'}
                      </p>
                    </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: 10,
                    }}
                  >
                    <div>
                      <span className="panel-meta" style={{ margin: 0 }}>
                        书籍
                      </span>
                      <p style={{ margin: '6px 0 0', lineHeight: 1.6 }}>
                        {resource.bookTitle || '未绑定书籍'}
                      </p>
                    </div>
                    <div>
                      <span className="panel-meta" style={{ margin: 0 }}>
                        章节
                      </span>
                      <p style={{ margin: '6px 0 0', lineHeight: 1.6 }}>
                        {resource.chapterTitle || '未绑定章节'}
                      </p>
                    </div>
                    <div>
                      <span className="panel-meta" style={{ margin: 0 }}>
                        收藏时间
                      </span>
                      <p style={{ margin: '6px 0 0', lineHeight: 1.6 }}>
                        {formatTime(resource.savedAt)}
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

export default ResourcesPage
