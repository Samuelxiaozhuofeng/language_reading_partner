import { useMemo } from 'react'
import { formatTime } from '../lib/appState'
import { knowledgeKindLabelMap } from '../lib/knowledge'
import type { KnowledgeKind, SavedKnowledgeResource } from '../types'

export type ResourcesPageProps = {
  activeKind: KnowledgeKind | 'all'
  canBackToReading?: boolean
  onBackToLibrary: () => void
  onBackToReading?: () => void
  onDeleteResource: (resourceId: string) => void
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
  onKindChange,
  resources,
  subtitle = '把你在阅读中遇到的语法点、词汇搭配和表达整理成一个可回看、可筛选的学习清单。',
  title = '学习资源',
}: ResourcesPageProps) {
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
