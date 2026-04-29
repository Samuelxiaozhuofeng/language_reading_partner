import type { IpadicFeatures, Tokenizer } from 'kuromoji'
import * as kuromoji from 'kuromoji/build/kuromoji.js'
import type { JapaneseToken } from '../types'

let tokenizerPromise: Promise<Tokenizer<IpadicFeatures>> | null = null

export function isKuromojiReady() {
  return Boolean(tokenizerPromise)
}

export function getTokenizer() {
  if (!tokenizerPromise) {
    tokenizerPromise = new Promise((resolve, reject) => {
      kuromoji.builder({ dicPath: '/dict/' }).build((error, tokenizer) => {
        if (error) {
          tokenizerPromise = null
          reject(error)
          return
        }

        resolve(tokenizer)
      })
    })
  }

  return tokenizerPromise
}

export async function tokenizeJapanese(text: string): Promise<JapaneseToken[]> {
  const tokenizer = await getTokenizer()
  return tokenizer.tokenize(text).map((token) => ({
    surface: token.surface_form,
    reading: token.reading ?? token.surface_form,
    baseForm: token.basic_form === '*' ? token.surface_form : token.basic_form,
    pos: token.pos,
  }))
}
