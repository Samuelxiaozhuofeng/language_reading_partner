import { ClickableSentenceWords } from './ClickableSentenceWords'
import { JapaneseChunkView } from './JapaneseChunkView'
import type { JapaneseChunkSelection } from '../../lib/japaneseUtils'
import type { ChapterReadingParagraph } from '../../lib/readingFlow'
import { getSentenceDisplayText } from './readingShared'
import type { AnalysisResult, BookLanguage, SentenceItem } from '../../types'

type ChapterInlineSentencesProps = {
  activeChunkSelection: JapaneseChunkSelection | null
  activeWord?: string
  bookLanguage: BookLanguage
  effectiveActiveSentenceId: string | null
  isAndroid: boolean
  isWordLookupLoading?: boolean
  onOpenSentence: (sentenceId: string) => void
  onSelectChunk: (sentenceId: string, chunkIndex: number) => void
  onWordClick: (sentence: SentenceItem, word: string) => void
  paragraph: ChapterReadingParagraph
  resumeHighlightSentenceId: string | null
  results: Record<string, AnalysisResult>
  showFurigana?: boolean
}

export function ChapterInlineSentences({
  activeChunkSelection,
  activeWord,
  bookLanguage,
  effectiveActiveSentenceId,
  isAndroid,
  isWordLookupLoading = false,
  onOpenSentence,
  onSelectChunk,
  onWordClick,
  paragraph,
  resumeHighlightSentenceId,
  results,
  showFurigana,
}: ChapterInlineSentencesProps) {
  return paragraph.sentences.map((sentence) => {
    const sentenceClassName = `reading-inline-sentence ${
      effectiveActiveSentenceId === sentence.id ? 'is-active' : ''
    } ${resumeHighlightSentenceId === sentence.id ? 'is-resumed' : ''}`

    if (bookLanguage === 'ja') {
      return isAndroid ? (
        <span
          className="reading-inline-sentence-ja"
          data-sentence-id={sentence.id}
          key={sentence.id}
        >
          <JapaneseChunkView
            sentenceId={sentence.id}
            showFurigana={showFurigana}
            text={getSentenceDisplayText(sentence)}
            tokens={sentence.tokens}
            onChunkClick={(chunkIndex) => {
              const token = sentence.tokens?.[chunkIndex]
              if (token?.surface) {
                onWordClick(sentence, token.surface)
              }
            }}
          />
        </span>
      ) : (
        <span
          className="reading-inline-sentence-ja"
          data-sentence-id={sentence.id}
          key={sentence.id}
          role="button"
          tabIndex={0}
          onClick={() => onOpenSentence(sentence.id)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onOpenSentence(sentence.id)
            }
          }}
        >
          <JapaneseChunkView
            activeChunkSelection={activeChunkSelection}
            chunks={results[sentence.id]?.chunkAnalysis}
            sentenceId={sentence.id}
            showFurigana={showFurigana}
            text={getSentenceDisplayText(sentence)}
            tokens={sentence.tokens}
            onChunkClick={(chunkIndex) => onSelectChunk(sentence.id, chunkIndex)}
          />
        </span>
      )
    }

    return (
      <span className={sentenceClassName} data-sentence-id={sentence.id} key={sentence.id}>
        <ClickableSentenceWords
          activeWord={activeWord}
          disabled={isWordLookupLoading}
          text={getSentenceDisplayText(sentence)}
          onWordClick={(word) => onWordClick(sentence, word)}
        />
      </span>
    )
  })
}
