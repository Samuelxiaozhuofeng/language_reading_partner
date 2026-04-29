import { useEffect, useRef, useState } from 'react'
import { toUserFacingAnkiError } from '../../lib/anki'
import { buildKnowledgeSignature, knowledgeKindLabelMap } from '../../lib/knowledge'
import type {
  AnalysisHighlight,
  AnalysisResult,
  SentenceItem,
  VocabularyExplanation,
} from '../../types'
import { ClickableSentenceWords } from './ClickableSentenceWords'
import { JapaneseChunkView } from './JapaneseChunkView'
import { renderGrammarText } from './readingHighlights'
import { buildSelectionKey, type HighlightSelection } from './readingShared'
import {
  useVocabularyExplanation,
  type VocabularyExplanationInteraction,
} from './useVocabularyExplanation'
import { VocabularyExplanationPanel } from './VocabularyExplanationPanel'
import type { JapaneseChunkSelection } from '../../lib/japaneseUtils'
import type { BookLanguage } from '../../types'

type SentenceDetailPanelProps = {
  activeSelection: HighlightSelection | null
  activeChunkSelection: JapaneseChunkSelection | null
  bookLanguage: BookLanguage
  onAddToAnki: (
    sentence: SentenceItem,
    result: AnalysisResult,
    highlight: AnalysisHighlight,
  ) => Promise<void>
  onExplainVocabulary: (context: string, word: string) => Promise<VocabularyExplanation>
  onOpenResources: () => void
  onRemoveHighlight: (signature: string) => void
  onRetrySentence?: (sentenceId: string) => void
  onSaveHighlight: (
    sentence: SentenceItem,
    result: AnalysisResult,
    highlight: AnalysisHighlight,
  ) => void
  onSelectHighlight: (sentenceId: string, highlightId: string) => void
  onSelectChunk: (sentenceId: string, chunkIndex: number) => void
  result?: AnalysisResult
  renderVocabularySource?: boolean
  savedHighlightSignatures: Set<string>
  sentence: SentenceItem
  showFurigana?: boolean
  vocabularyInteraction?: VocabularyExplanationInteraction
}

export function SentenceDetailPanel({
  activeSelection,
  activeChunkSelection,
  bookLanguage,
  onAddToAnki,
  onExplainVocabulary,
  onOpenResources,
  onRemoveHighlight,
  onRetrySentence,
  onSaveHighlight,
  onSelectHighlight,
  onSelectChunk,
  result,
  renderVocabularySource = true,
  savedHighlightSignatures,
  sentence,
  showFurigana = true,
  vocabularyInteraction,
}: SentenceDetailPanelProps) {
  const knowledgeDetailCardRef = useRef<HTMLDivElement | null>(null)
  const [ankiSubmitState, setAnkiSubmitState] = useState<{
    message: string
    selectionKey: string
    status: 'idle' | 'loading' | 'success' | 'error'
  }>({
    message: '',
    selectionKey: '',
    status: 'idle',
  })
  const internalVocabularyInteraction = useVocabularyExplanation({
    onAddToAnki,
    onExplainVocabulary,
    result,
    sentence,
  })
  const activeVocabularyInteraction =
    vocabularyInteraction ?? internalVocabularyInteraction
  const highlights = result?.highlights ?? []
  const activeChunk =
    activeChunkSelection?.sentenceId === sentence.id
      ? result?.chunkAnalysis?.[activeChunkSelection.chunkIndex]
      : undefined
  const selectedHighlight = highlights.find(
    (highlight) =>
      activeSelection?.sentenceId === sentence.id &&
      activeSelection.highlightId === highlight.id,
  )
  const selectedSignature = selectedHighlight
    ? buildKnowledgeSignature(selectedHighlight.kind, selectedHighlight.text)
    : null
  const isSelectedSaved = selectedSignature
    ? savedHighlightSignatures.has(selectedSignature)
    : false
  const selectedHighlightKey = selectedHighlight
    ? buildSelectionKey(sentence.id, selectedHighlight.id)
    : ''
  const visibleAnkiStatus =
    ankiSubmitState.selectionKey === selectedHighlightKey ? ankiSubmitState.status : 'idle'
  const visibleAnkiMessage =
    ankiSubmitState.selectionKey === selectedHighlightKey ? ankiSubmitState.message : ''

  const canRetrySentence =
    Boolean(onRetrySentence) &&
    sentence.status !== 'queued' &&
    sentence.status !== 'running' &&
    Boolean((sentence.editedText || sentence.text).trim())
  const retryButtonLabel = sentence.status === 'error' ? '重试本句' : '单独解析本句'

  useEffect(() => {
    if (!selectedHighlight || !knowledgeDetailCardRef.current) {
      return
    }

    const detailCard = knowledgeDetailCardRef.current
    const scrollContainer = detailCard.closest('.reading-inspector')

    if (!(scrollContainer instanceof HTMLElement)) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      const detailRect = detailCard.getBoundingClientRect()
      const containerRect = scrollContainer.getBoundingClientRect()
      const scrollPadding = 16
      const isAboveViewport = detailRect.top < containerRect.top + scrollPadding
      const isBelowViewport = detailRect.bottom > containerRect.bottom - scrollPadding

      if (!isAboveViewport && !isBelowViewport) {
        return
      }

      const nextScrollTop = isAboveViewport
        ? scrollContainer.scrollTop + detailRect.top - containerRect.top - scrollPadding
        : scrollContainer.scrollTop + detailRect.bottom - containerRect.bottom + scrollPadding

      scrollContainer.scrollTo({
        top: Math.max(0, nextScrollTop),
        behavior: 'smooth',
      })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [selectedHighlight])

  if (!result) {
    return (
      <div className="result-placeholder">
        <p>
          {sentence.status === 'error'
            ? '这句解析失败了，可以单独重试本句。'
            : sentence.status === 'running' || sentence.status === 'queued'
              ? 'AI 正在处理中...'
              : '这句还没有开始解析。'}
        </p>
        {onRetrySentence ? (
          <button
            className="secondary-button result-placeholder-action"
            type="button"
            disabled={!canRetrySentence}
            onClick={() => onRetrySentence(sentence.id)}
          >
            {retryButtonLabel}
          </button>
        ) : null}
      </div>
    )
  }

  const handleAddToAnki = async () => {
    if (!selectedHighlight || !selectedHighlightKey) {
      return
    }

    setAnkiSubmitState({
      message: '正在添加到 Anki...',
      selectionKey: selectedHighlightKey,
      status: 'loading',
    })

    try {
      await onAddToAnki(sentence, result, selectedHighlight)
      setAnkiSubmitState({
        message: `已将「${selectedHighlight.text}」添加到 Anki。`,
        selectionKey: selectedHighlightKey,
        status: 'success',
      })
    } catch (error) {
      setAnkiSubmitState({
        message: toUserFacingAnkiError(error),
        selectionKey: selectedHighlightKey,
        status: 'error',
      })
    }
  }

  return (
    <div className="analysis-stack">
      {renderVocabularySource ? (
        <section>
          <h3>原句</h3>
          <p className="analysis-paragraph vocabulary-source-sentence">
            {bookLanguage === 'ja' ? (
              <JapaneseChunkView
                activeChunkSelection={activeChunkSelection}
                sentenceId={sentence.id}
                showFurigana={showFurigana}
                text={activeVocabularyInteraction.sentenceText}
                tokens={sentence.tokens}
                onChunkClick={(chunkIndex) => onSelectChunk(sentence.id, chunkIndex)}
              />
            ) : (
              <ClickableSentenceWords
                activeWord={activeVocabularyInteraction.state?.word}
                disabled={activeVocabularyInteraction.state?.status === 'loading'}
                text={activeVocabularyInteraction.sentenceText}
                onWordClick={(word) => void activeVocabularyInteraction.handleWordClick(word)}
              />
            )}
          </p>
        </section>
      ) : null}
      <section>
        <h3>语法</h3>
        <div className="analysis-paragraph">
          {result.grammar
            ? renderGrammarText(
                result.grammar,
                highlights,
                activeSelection,
                sentence.id,
                savedHighlightSignatures,
                (highlightId) => onSelectHighlight(sentence.id, highlightId),
              )
            : '模型未稳定返回语法说明。'}
        </div>

        {highlights.length > 0 ? (
          <>
            <div className="knowledge-chip-list">
              {highlights.map((highlight) => {
                const signature = buildKnowledgeSignature(highlight.kind, highlight.text)
                const isSaved = savedHighlightSignatures.has(signature)
                const isActive =
                  activeSelection?.sentenceId === sentence.id &&
                  activeSelection.highlightId === highlight.id

                return (
                  <button
                    className={`knowledge-chip ${isActive ? 'is-active' : ''} ${isSaved ? 'is-saved' : ''}`}
                    key={highlight.id}
                    type="button"
                    onClick={() => onSelectHighlight(sentence.id, highlight.id)}
                  >
                    <span>{highlight.text}</span>
                    <span>{knowledgeKindLabelMap[highlight.kind]}</span>
                  </button>
                )
              })}
            </div>

            {selectedHighlight ? (
              <div className="knowledge-detail-card" ref={knowledgeDetailCardRef}>
                <div className="knowledge-detail-header">
                  <div>
                    <p className="section-kicker">Knowledge Point</p>
                    <h4>{selectedHighlight.text}</h4>
                  </div>
                  <span className="status-pill">
                    {knowledgeKindLabelMap[selectedHighlight.kind]}
                  </span>
                </div>

                <p>{selectedHighlight.explanation}</p>

                <div className="panel-actions knowledge-detail-actions">
                  {isSelectedSaved && selectedSignature ? (
                    <button
                      className="ghost-button danger-button"
                      type="button"
                      onClick={() => onRemoveHighlight(selectedSignature)}
                    >
                      取消收藏
                    </button>
                  ) : (
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => onSaveHighlight(sentence, result, selectedHighlight)}
                    >
                      保存到学习资源
                    </button>
                  )}

                  <button
                    className="secondary-button"
                    type="button"
                    disabled={visibleAnkiStatus === 'loading'}
                    onClick={() => void handleAddToAnki()}
                  >
                    {visibleAnkiStatus === 'loading' ? '添加到 Anki 中...' : '添加到 Anki'}
                  </button>

                  <button className="ghost-button" type="button" onClick={onOpenResources}>
                    打开学习资源
                  </button>
                </div>

                {visibleAnkiStatus !== 'idle' ? (
                  <p className={`notice ${visibleAnkiStatus === 'success' ? 'success' : visibleAnkiStatus === 'error' ? 'error' : ''}`}>
                    {visibleAnkiMessage}
                  </p>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </section>
      {bookLanguage === 'ja' && result.chunkAnalysis?.length ? (
        <section>
          <h3>词块解析</h3>
          <div className="chunk-analysis-list">
            {result.chunkAnalysis.map((chunk, index) => {
              const isActive =
                activeChunkSelection?.sentenceId === sentence.id &&
                activeChunkSelection.chunkIndex === index

              return (
                <button
                  className={`chunk-analysis-item ${isActive ? 'is-active-chunk' : ''}`}
                  key={`${chunk.chunk}:${index}`}
                  type="button"
                  onClick={() => onSelectChunk(sentence.id, index)}
                >
                  <span className="chunk-main">{chunk.chunk}</span>
                  {chunk.reading ? <span className="chunk-reading">{chunk.reading}</span> : null}
                  {chunk.pos ? <span className="chunk-pos">{chunk.pos}</span> : null}
                  <span className="chunk-explanation">{chunk.explanation}</span>
                </button>
              )
            })}
          </div>

          {activeChunk ? (
            <div className="chunk-analysis-focus">
              <strong>{activeChunk.chunk}</strong>
              <span>{[activeChunk.reading, activeChunk.pos].filter(Boolean).join(' / ')}</span>
              <p>{activeChunk.explanation}</p>
            </div>
          ) : null}
        </section>
      ) : null}
      <section>
        <h3>内容</h3>
        <p>{result.meaning || '模型未稳定返回内容解读。'}</p>
      </section>

      {bookLanguage === 'es' ? (
        <VocabularyExplanationPanel
          detailRef={activeVocabularyInteraction.detailRef}
          state={activeVocabularyInteraction.state}
          onAddToAnki={activeVocabularyInteraction.handleAddToAnki}
          onClose={activeVocabularyInteraction.handleClose}
        />
      ) : null}
    </div>
  )
}
