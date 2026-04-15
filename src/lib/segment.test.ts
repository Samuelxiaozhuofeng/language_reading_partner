import test from 'node:test'
import assert from 'node:assert/strict'

import { segmentSpanishText } from './segment.ts'

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
