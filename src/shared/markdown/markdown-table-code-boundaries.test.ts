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

it('keeps later ordered markers and subsequent rows inside an active table', () => {
  const table = '| a | b |\n|---|---|\n2. first ` | second `\n| third ` | fourth ` |\n'
  const scanner = createMarkdownCodeSpanScanner(table)
  expect(scanner.findSpanEnd(table.indexOf('`'))).toBeNull()
  expect(scanner.findSpanEnd(table.indexOf('`', table.indexOf('third')))).toBeNull()

  const list = '| a | b |\n|---|---|\n1. ordinary `a|b`\n'
  const opener = list.indexOf('`')
  expect(createMarkdownCodeSpanScanner(list).findSpanEnd(opener)).toBe(
    list.indexOf('`', opener + 1) + 1
  )
})

it('ends a quoted table at a quote-stripped blank line', () => {
  const table = '> | a | b |\n> |---|---|\n> | first ` | second ` |\n'
  expect(createMarkdownCodeSpanScanner(table).findSpanEnd(table.indexOf('`'))).toBeNull()

  const paragraph = '> | a | b |\n> |---|---|\n>\n> ordinary `a|b`\n'
  const opener = paragraph.indexOf('`')
  expect(createMarkdownCodeSpanScanner(paragraph).findSpanEnd(opener)).toBe(
    paragraph.indexOf('`', opener + 1) + 1
  )
})

it('recognizes delimiter-shaped headers before scanning table cells', () => {
  const table = '---|---\n---|---\n| first ` | second ` |\n'
  expect(createMarkdownCodeSpanScanner(table).findSpanEnd(table.indexOf('`'))).toBeNull()
})
