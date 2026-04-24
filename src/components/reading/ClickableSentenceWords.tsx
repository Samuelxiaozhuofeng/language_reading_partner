import { useMemo } from 'react'
import { tokenizeSpanishWords } from '../../lib/vocabulary'

type ClickableSentenceWordsProps = {
  activeWord?: string
  disabled?: boolean
  onWordClick: (word: string) => void
  text: string
}

export function ClickableSentenceWords({
  activeWord,
  disabled = false,
  onWordClick,
  text,
}: ClickableSentenceWordsProps) {
  const tokens = useMemo(() => tokenizeSpanishWords(text), [text])

  if (tokens.length === 0) {
    return text
  }

  return (
    <span className="clickable-sentence-words">
      {tokens.map((token, index) =>
        token.kind === 'word' ? (
          <button
            className={`vocabulary-word-button ${activeWord === token.text ? 'is-active' : ''}`}
            disabled={disabled}
            key={`${token.text}:${index}`}
            type="button"
            onClick={() => onWordClick(token.text)}
          >
            {token.text}
          </button>
        ) : (
          <span key={`text:${index}`}>{token.text}</span>
        ),
      )}
    </span>
  )
}
