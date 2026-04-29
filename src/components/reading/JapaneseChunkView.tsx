import {
  hasKanji,
  findChunkIndexByTokenIndex,
  getChunkTokenIndices,
  isParticle,
  katakanaToHiragana,
  type JapaneseChunkSelection,
} from '../../lib/japaneseUtils'
import type { JapaneseChunkExplanation, JapaneseToken } from '../../types'

type JapaneseChunkViewProps = {
  activeChunkSelection?: JapaneseChunkSelection | null
  chunks?: JapaneseChunkExplanation[]
  disabled?: boolean
  onChunkClick?: (chunkIndex: number) => void
  sentenceId: string
  showFurigana?: boolean
  tokens?: JapaneseToken[]
  text: string
}

export function JapaneseChunkView({
  activeChunkSelection,
  chunks,
  disabled = false,
  onChunkClick,
  sentenceId,
  showFurigana = true,
  tokens,
  text,
}: JapaneseChunkViewProps) {
  if (!tokens?.length) {
    return text
  }

  return (
    <span className="ja-chunk-line">
      {tokens.map((token, index) => {
        const tokenChunkIndex = findChunkIndexByTokenIndex(chunks, index)
        const isActive =
          activeChunkSelection?.sentenceId === sentenceId &&
          getChunkTokenIndices(
            chunks?.[activeChunkSelection.chunkIndex],
            activeChunkSelection.chunkIndex,
            tokens.length,
          ).includes(index)
        const className = [
          'ja-chunk',
          isParticle(token.pos) ? 'is-particle' : '',
          isActive ? 'is-active-chunk' : '',
        ].filter(Boolean).join(' ')
        const reading = katakanaToHiragana(token.reading)
        const content =
          showFurigana && hasKanji(token.surface) && reading ? (
            <ruby>
              {token.surface}
              <rt>{reading}</rt>
            </ruby>
          ) : (
            token.surface
          )

        return onChunkClick ? (
          <button
            className={className}
            disabled={disabled}
            key={`${token.surface}:${index}`}
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onChunkClick(tokenChunkIndex >= 0 ? tokenChunkIndex : index)
            }}
          >
            {content}
          </button>
        ) : (
          <span className={className} key={`${token.surface}:${index}`}>
            {content}
          </span>
        )
      })}
    </span>
  )
}
