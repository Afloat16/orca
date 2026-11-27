export const CSV_DELIMITER_SNIFF_SCAN_CODE_UNITS = 64 * 1024

export function detectCsvDelimiter(filePath: string, content: string): string {
  if (filePath.toLowerCase().endsWith('.tsv')) {
    return '\t'
  }
  // Strip the UTF-8 BOM before sniffing so it cannot affect first-cell classification.
  let text = content
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1)
  }
  // Quoted header cells may span physical lines; sniff the first nonblank record.
  const firstRecord = findFirstNonEmptyCsvSniffRecord(text)
  const tabs = countDelimiterOutsideQuotes(firstRecord, '\t')
  const semicolons = countDelimiterOutsideQuotes(firstRecord, ';')
  const commas = countDelimiterOutsideQuotes(firstRecord, ',')
  // Keep the existing comma/tab choice unless semicolon strictly wins.
  const existingDelimiter = tabs > commas ? '\t' : ','
  if (semicolons > commas && semicolons > tabs) {
    return hasConsistentExistingCsvColumns(text, existingDelimiter) ? existingDelimiter : ';'
  }
  return existingDelimiter
}

// Header punctuation should not replace an otherwise consistent comma/tab table.
function hasConsistentExistingCsvColumns(text: string, delimiter: string): boolean {
  const scanLength = Math.min(text.length, CSV_DELIMITER_SNIFF_SCAN_CODE_UNITS)
  const records: { delimiters: number; semicolons: number }[] = []
  let delimiters = 0
  let semicolons = 0
  let inQuotes = false
  let fieldIsEmpty = true
  let hasContent = false
  const pushRecord = (): void => {
    if (hasContent) {
      records.push({ delimiters, semicolons })
    }
    delimiters = 0
    semicolons = 0
    fieldIsEmpty = true
    hasContent = false
  }

  for (let index = 0; index < scanLength && records.length < 8; index += 1) {
    const ch = text[index]
    if (inQuotes) {
      if (ch === '"') {
        if (text[index + 1] === '"' && index + 1 < scanLength) {
          fieldIsEmpty = false
          index += 1
        } else {
          inQuotes = false
        }
      } else {
        fieldIsEmpty = false
      }
      continue
    }
    if (ch === '"' && fieldIsEmpty) {
      inQuotes = true
      hasContent = true
      continue
    }
    if (ch === '\r' || ch === '\n') {
      pushRecord()
      if (ch === '\r' && text[index + 1] === '\n') {
        index += 1
      }
      continue
    }
    if (ch === delimiter) {
      delimiters += 1
      fieldIsEmpty = true
    } else {
      fieldIsEmpty = false
    }
    if (ch === ';') {
      semicolons += 1
    }
    hasContent ||= !isCsvSniffWhitespace(text.charCodeAt(index))
  }
  if (scanLength === text.length && records.length < 8 && !inQuotes) {
    pushRecord()
  }
  const first = records[0]
  return Boolean(
    first &&
    first.delimiters > 0 &&
    records.length > 1 &&
    records.every((record) => record.delimiters === first.delimiters) &&
    records.some((record) => record.semicolons !== first.semicolons)
  )
}

function findFirstNonEmptyCsvSniffRecord(text: string): string {
  const scanLength = Math.min(text.length, CSV_DELIMITER_SNIFF_SCAN_CODE_UNITS)
  let recordStart = 0
  let inQuotes = false
  let fieldIsEmpty = true
  let hasContent = false
  for (let index = 0; index < scanLength; index += 1) {
    const ch = text[index]
    if (inQuotes) {
      if (ch === '"') {
        if (text[index + 1] === '"' && index + 1 < scanLength) {
          index += 1
        } else {
          inQuotes = false
        }
      }
      continue
    }
    if (ch === '"' && fieldIsEmpty) {
      inQuotes = true
      fieldIsEmpty = false
      hasContent = true
      continue
    }
    if (ch === '\r' || ch === '\n') {
      if (hasContent) {
        return text.slice(recordStart, index)
      }
      recordStart = index + 1
      fieldIsEmpty = true
      continue
    }
    // Only field-start quotes continue the record; mid-cell quotes stay literal.
    fieldIsEmpty = ch === ',' || ch === ';' || ch === '\t'
    hasContent ||= !isCsvSniffWhitespace(text.charCodeAt(index))
  }
  return hasContent ? text.slice(recordStart, scanLength) : ''
}

function isCsvSniffWhitespace(codeUnit: number): boolean {
  return (
    codeUnit === 0x09 ||
    codeUnit === 0x0b ||
    codeUnit === 0x0c ||
    codeUnit === 0x20 ||
    codeUnit === 0xa0
  )
}

function countDelimiterOutsideQuotes(record: string, delimiter: string): number {
  let count = 0
  let inQuotes = false
  for (let index = 0; index < record.length; index += 1) {
    const ch = record[index]
    if (ch === '"') {
      if (inQuotes && record[index + 1] === '"') {
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (!inQuotes && ch === delimiter) {
      count += 1
    }
  }
  return count
}
