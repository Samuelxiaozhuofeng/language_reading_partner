import type { JapaneseToken } from '../types'

const KANJI_PATTERN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/
const KATAKANA_START = 0x30a1
const KATAKANA_END = 0x30f6
const KATAKANA_TO_HIRAGANA_OFFSET = 0x60

export type JapaneseChunkSelection = {
  sentenceId: string
  chunkIndex: number
}

export function hasKanji(text: string) {
  return KANJI_PATTERN.test(text)
}

export function katakanaToHiragana(text: string) {
  return Array.from(text, (char) => {
    const codePoint = char.codePointAt(0)
    if (
      codePoint !== undefined &&
      codePoint >= KATAKANA_START &&
      codePoint <= KATAKANA_END
    ) {
      return String.fromCodePoint(codePoint - KATAKANA_TO_HIRAGANA_OFFSET)
    }

    return char
  }).join('')
}

export function isParticle(pos: string) {
  return pos === '助詞' || pos.startsWith('助詞,') || pos.includes('助詞')
}

export function doTokensMatchText(tokens: JapaneseToken[] | undefined, text: string) {
  if (!tokens?.length) {
    return false
  }

  return tokens.map((token) => token.surface).join('') === text.replace(/\s+/g, '')
}
