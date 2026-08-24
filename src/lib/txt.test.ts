import test from 'node:test'
import assert from 'node:assert/strict'
import { decodeTxtBuffer, isTxtFile, titleFromTxtFileName } from './txt.ts'

test('detects txt files by name or mime type', () => {
  assert.equal(isTxtFile(new File(['a'], 'book.txt', { type: '' })), true)
  assert.equal(isTxtFile(new File(['a'], 'book.TXT', { type: '' })), true)
  assert.equal(isTxtFile(new File(['a'], 'notes.txt', { type: 'text/plain' })), true)
  assert.equal(isTxtFile(new File(['a'], 'book.epub', { type: 'application/epub+zip' })), false)
})

test('uses the file name without extension as the book title', () => {
  assert.equal(titleFromTxtFileName('测试专用.txt'), '测试专用')
  assert.equal(titleFromTxtFileName('.txt'), '未命名文本')
})

test('strips a UTF-8 BOM from txt bytes', () => {
  const encoded = new TextEncoder().encode('المفعولُ معه')
  const withBom = new Uint8Array(encoded.length + 3)
  withBom.set([0xef, 0xbb, 0xbf])
  withBom.set(encoded, 3)
  assert.equal(decodeTxtBuffer(withBom.buffer), 'المفعولُ معه')
})
