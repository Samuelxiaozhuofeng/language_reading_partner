import { statusLabelMap } from '../../lib/appState'
import type { SentenceItem, SentenceRange } from '../../types'

type SentenceEditorPanelProps = {
  isChapterMode: boolean
  isRunning: boolean
  onRetrySentence: (sentenceId: string) => void
  onSentenceChange: (id: string, value: string) => void
  selectedRange: SentenceRange | null
  sentenceStartIndex: number
  sentences: SentenceItem[]
}

export default function SentenceEditorPanel({
  isChapterMode,
  isRunning,
  onRetrySentence,
  onSentenceChange,
  selectedRange,
  sentenceStartIndex,
  sentences,
}: SentenceEditorPanelProps) {
  return (
    <section className="panel editor-panel">
      <div className="panel-header">
        <div>
          <p className="section-kicker">Sentences</p>
          <h2>逐句校对</h2>
        </div>
        <p className="panel-meta">
          {isChapterMode ? '这里只显示当前区间内的句子。' : 'AI 会以编辑后的句子内容为准。'}
        </p>
      </div>

      <div className="sentence-list">
        {sentences.length === 0 ? (
          <div className="empty-state">
            <p>
              {isChapterMode
                ? selectedRange
                  ? '当前区间还没有可编辑的句子。'
                  : '先在 Step 2 选择一个句子区间，这里会显示对应内容。'
                : '先粘贴一段原文并点击“分句”，这里就会出现可编辑句子。'}
            </p>
          </div>
        ) : (
          sentences.map((sentence, index) => (
            <article className="sentence-card" key={sentence.id}>
              <div className="sentence-card-header">
                <span className="sentence-index">
                  #{isChapterMode ? sentenceStartIndex + index : index + 1}
                </span>
                <span className={`status-badge status-${sentence.status}`}>
                  {statusLabelMap[sentence.status]}
                </span>
              </div>

              <textarea
                className="sentence-textarea"
                value={sentence.editedText}
                onChange={(event) => onSentenceChange(sentence.id, event.target.value)}
                placeholder="句子内容"
              />

              {sentence.error ? <p className="sentence-error">{sentence.error}</p> : null}

              <div className="sentence-actions">
                <span>{sentence.editedText.trim().length} 字符</span>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => onRetrySentence(sentence.id)}
                  disabled={isRunning || !sentence.editedText.trim()}
                >
                  重试本句
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  )
}
