import { useMemo, useState } from 'react'
import { shouldQueueAnkiOnThisDevice } from '../../lib/anki'
import { knowledgeKindLabelMap } from '../../lib/knowledge'
import type { PendingAnkiNote } from '../../types'

type PendingAnkiImportPanelProps = {
  notes: PendingAnkiNote[]
  onImport: () => Promise<string>
}

function PendingAnkiImportPanel({ notes, onImport }: PendingAnkiImportPanelProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const isMobileDevice = shouldQueueAnkiOnThisDevice()
  const failedCount = useMemo(
    () => notes.filter((note) => Boolean(note.lastError)).length,
    [notes],
  )
  const previewNotes = notes.slice(0, 3)
  const canImport = notes.length > 0 && !isMobileDevice && status !== 'loading'

  const handleImport = async () => {
    setStatus('loading')
    setMessage('正在连接桌面端 Anki...')

    try {
      const nextMessage = await onImport()
      setStatus('success')
      setMessage(nextMessage)
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'Anki 批量导入失败，请稍后重试。')
    }
  }

  return (
    <section className="panel resources-anki-panel">
      <div className="panel-header library-section-header">
        <div>
          <p className="section-kicker">Anki Queue</p>
          <h2>移动端 Anki 待导入</h2>
        </div>
        <p className="panel-meta">
          手机端保存的条目会先进入云端队列，在桌面端打开 Anki 后可一次性导入。
        </p>
      </div>

      <div className="export-panel">
        <div className="resources-status-strip">
          <span className="status-pill">{notes.length} 条待导入</span>
          <span className="status-pill">{failedCount ? `${failedCount} 条上次失败` : '暂无失败'}</span>
          <span className="status-pill">{isMobileDevice ? '请在桌面端导入' : '桌面端可导入'}</span>
        </div>

        {previewNotes.length > 0 ? (
          <div className="resource-list compact-resource-list">
            {previewNotes.map((note) => (
              <article className="resource-card" key={note.id}>
                <div className="resource-card-main">
                  <div className="result-card-header resource-card-tags">
                    <span className="sentence-index">{knowledgeKindLabelMap[note.kind]}</span>
                    <span className="status-pill">{note.language === 'ja' ? '日语' : '通用外语'}</span>
                  </div>
                  <h3>{note.text || '未命名条目'}</h3>
                  <p className="resource-card-description">{note.explanation || note.sentenceText}</p>
                  {note.lastError ? <p className="notice error">{note.lastError}</p> : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>当前没有移动端保存的 Anki 待导入条目。</p>
          </div>
        )}

        <div className="export-actions">
          <button
            className="primary-button"
            disabled={!canImport}
            type="button"
            onClick={() => void handleImport()}
          >
            {status === 'loading' ? '导入中...' : '一键导入到 Anki'}
          </button>
          <span className="panel-meta">
            导入前请确认桌面端 Anki 已打开，且设置页的 Anki 字段映射已配置完成。
          </span>
        </div>

        {message ? (
          <p className={`notice ${status === 'success' ? 'success' : status === 'error' ? 'error' : ''}`}>
            {message}
          </p>
        ) : null}
      </div>
    </section>
  )
}

export default PendingAnkiImportPanel
