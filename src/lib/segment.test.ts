import test from 'node:test'
import assert from 'node:assert/strict'

import { sanitizeChunkAnalysis } from './analysisResult.ts'
import {
  doTokensMatchText,
  hasKanji,
  isParticle,
  katakanaToHiragana,
  toHtmlRuby,
} from './japaneseUtils.ts'
import { segmentJapaneseText, segmentSpanishText } from './segment.ts'

test('keeps U.S. inside the same sentence when it is not sentence-final', () => {
  const input =
    'In Colby’s view, Europe needed to take the lead on its own defense, and the U.S. needed to conserve its weapons for China and the Pacific.'

  assert.deepEqual(segmentSpanishText(input), [input])
})

test('merges title abbreviations back into the sentence', () => {
  assert.deepEqual(segmentSpanishText('Dr. Smith arrived. He sat down.'), [
    'Dr. Smith arrived.',
    'He sat down.',
  ])
})

test('preserves decimal numbers and following sentence boundary', () => {
  assert.deepEqual(segmentSpanishText('The value is 3.14. That is pi.'), [
    'The value is 3.14.',
    'That is pi.',
  ])
})

test('keeps paragraph boundaries even without ending punctuation', () => {
  assert.deepEqual(segmentSpanishText('Primera linea\n\nSegunda linea sin punto'), [
    'Primera linea',
    'Segunda linea sin punto',
  ])
})

test('keeps semicolon as a split point for shorter reading chunks', () => {
  assert.deepEqual(segmentSpanishText('Uno; dos. Tres?'), ['Uno;', 'dos.', 'Tres?'])
})

test('segments Japanese text by sentence punctuation', () => {
  assert.deepEqual(segmentJapaneseText('私は学生です。明日、京都へ行きます！'), [
    '私は学生です。',
    '明日、京都へ行きます！',
  ])
})

test('supports Japanese display helpers', () => {
  assert.equal(hasKanji('日本語'), true)
  assert.equal(hasKanji('かな'), false)
  assert.equal(katakanaToHiragana('ニホンゴ'), 'にほんご')
  assert.equal(isParticle('助詞'), true)
  assert.equal(isParticle('名詞'), false)
})

test('checks Japanese token text alignment', () => {
  assert.equal(
    doTokensMatchText(
      [
        { surface: '私', reading: 'ワタシ', baseForm: '私', pos: '名詞' },
        { surface: 'は', reading: 'ハ', baseForm: 'は', pos: '助詞' },
      ],
      '私は',
    ),
    true,
  )
})

test('converts Japanese tokens with kanji readings to escaped ruby HTML', () => {
  assert.equal(
    toHtmlRuby([
      { surface: '日本語', reading: 'ニホンゴ', baseForm: '日本語', pos: '名詞' },
      { surface: 'を', reading: 'ヲ', baseForm: 'を', pos: '助詞' },
      { surface: '<読む>', reading: 'ヨム', baseForm: '読む', pos: '動詞' },
    ]),
    '<ruby>日本語<rt>にほんご</rt></ruby>を<ruby>&lt;読む&gt;<rt>よむ</rt></ruby>',
  )
})

test('sanitizes Japanese chunk analysis from structured result values', () => {
  assert.deepEqual(
    sanitizeChunkAnalysis([
      {
        chunk: '私',
        reading: 'わたし',
        pos: '名詞',
        explanation: '表示说话者自己。',
      },
      {
        chunk: '',
        reading: 'は',
        pos: '助詞',
        explanation: '缺少 chunk 时丢弃。',
      },
    ]),
    [
      {
        chunk: '私',
        reading: 'わたし',
        pos: '名詞',
        explanation: '表示说话者自己。',
      },
    ],
  )
})

test('validates Japanese chunk analysis token coverage', () => {
  const tokens = [
    { surface: '私', reading: 'ワタシ', baseForm: '私', pos: '名詞' },
    { surface: 'は', reading: 'ハ', baseForm: 'は', pos: '助詞' },
    { surface: '読ん', reading: 'ヨン', baseForm: '読む', pos: '動詞' },
    { surface: 'だ', reading: 'ダ', baseForm: 'だ', pos: '助動詞' },
  ]

  assert.deepEqual(
    sanitizeChunkAnalysis(
      [
        {
          chunk: '私は',
          reading: 'わたしは',
          pos: '名詞句',
          grammar_role: '主题',
          token_indices: [0, 1],
          depends_on: '提示整句主题',
          explanation: '表示整句的主题。',
        },
        {
          chunk: '読んだ',
          reading: 'よんだ',
          pos: '動詞句',
          grammar_role: '谓语核心',
          token_indices: [2, 3],
          head_chunk_index: null,
          depends_on: null,
          explanation: '表示过去发生的动作。',
        },
      ],
      tokens,
    ),
    [
      {
        chunk: '私は',
        reading: 'わたしは',
        pos: '名詞句',
        grammarRole: '主题',
        tokenIndices: [0, 1],
        dependsOn: '提示整句主题',
        explanation: '表示整句的主题。',
      },
      {
        chunk: '読んだ',
        reading: 'よんだ',
        pos: '動詞句',
        grammarRole: '谓语核心',
        tokenIndices: [2, 3],
        explanation: '表示过去发生的动作。',
      },
    ],
  )

  assert.throws(
    () =>
      sanitizeChunkAnalysis(
        [
          {
            chunk: '私',
            reading: 'わたし',
            pos: '名詞',
            token_indices: [0],
            explanation: '漏掉了后续 token。',
          },
        ],
        tokens,
      ),
    /覆盖所有非标点 token/,
  )
})

test('allows Japanese chunk token indices to skip punctuation tokens', () => {
  const tokens = [
    { surface: '「', reading: '「', baseForm: '「', pos: '記号' },
    { surface: 'という', reading: 'トイウ', baseForm: 'という', pos: '助詞' },
    { surface: '事', reading: 'コト', baseForm: '事', pos: '名詞' },
    { surface: 'で', reading: 'デ', baseForm: 'で', pos: '助動詞' },
    { surface: '」', reading: '」', baseForm: '」', pos: '記号' },
    { surface: 'の', reading: 'ノ', baseForm: 'の', pos: '助詞' },
  ]

  assert.deepEqual(
    sanitizeChunkAnalysis(
      [
        {
          chunk: 'という事での',
          reading: 'ということでの',
          pos: '連語',
          token_indices: [1, 2, 3, 5],
          explanation: '引用符をまたぐ表現として説明する。',
        },
      ],
      tokens,
    ),
    [
      {
        chunk: 'という事での',
        reading: 'ということでの',
        pos: '連語',
        tokenIndices: [1, 2, 3, 5],
        explanation: '引用符をまたぐ表現として説明する。',
      },
    ],
  )
})

test('rejects Japanese chunk token index gaps over non-punctuation tokens', () => {
  const tokens = [
    { surface: '私', reading: 'ワタシ', baseForm: '私', pos: '名詞' },
    { surface: 'は', reading: 'ハ', baseForm: 'は', pos: '助詞' },
    { surface: '読む', reading: 'ヨム', baseForm: '読む', pos: '動詞' },
  ]

  assert.throws(
    () =>
      sanitizeChunkAnalysis(
        [
          {
            chunk: '私読む',
            reading: 'わたしよむ',
            pos: '不正な語块',
            token_indices: [0, 2],
            explanation: '非标点 token を飛ばしている。',
          },
        ],
        tokens,
      ),
    /連続|连续递增/,
  )
})
