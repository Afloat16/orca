import { expect, it } from 'vitest'
import { createMarkdownCodeSpanScanner } from './markdown-code-span-scanner'

it('keeps code spans inside one GFM table cell while allowing escaped pipes', () => {
  const splitCells = '| first ` | second ` |\n| --- | --- |\n| third ` | fourth ` |\n'
  const scanner = createMarkdownCodeSpanScanner(splitCells)
  expect(scanner.findSpanEnd(splitCells.indexOf('`'))).toBeNull()
  expect(scanner.findSpanEnd(splitCells.indexOf('`', splitCells.indexOf('third')))).toBeNull()

  const escapedPipe = '| `a\\|b` | other |\n| --- | --- |\n'
  const opener = escapedPipe.indexOf('`')
  expect(createMarkdownCodeSpanScanner(escapedPipe).findSpanEnd(opener)).toBe(
    escapedPipe.indexOf('`', opener + 1) + 1
  )
  expect(createMarkdownCodeSpanScanner('ordinary `a|b` text').findSpanEnd(9)).toBe(14)

  for (const paragraph of [
    '| a | b |\n|---|---|\n# heading `a|b`\n',
    'ordinary `a|b`| extra\n---|---\n'
  ]) {
    const opener = paragraph.indexOf('`')
    expect(createMarkdownCodeSpanScanner(paragraph).findSpanEnd(opener)).toBe(
      paragraph.indexOf('`', opener + 1) + 1
    )
  }
})
