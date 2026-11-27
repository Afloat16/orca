import {
  throwIfAiVaultScanCancelled,
  waitForAiVaultScan
} from '../../scan-lifecycle/ai-vault-scan-cancellation'
import {
  wslGatedReaddir,
  wslGatedReadFile
} from '../../../native-chat/transcript-filesystem/wsl-transcript-fs-access'
import { isMissingTranscriptPathError } from '../../discovery/session-path-absence'
import { noteTranscriptSourceFailure } from '../../parsing/session-scanner-jsonl-reader'
import { basename, dirname, join } from 'node:path'
import type { AiVaultSession } from '../../../../shared/ai-vault/contracts/ai-vault-types'
import type { FileWithMtime, SessionAccumulator } from '../../session-scanner-types'
import type { TranscriptMessageSink } from '../../transcripts/session-transcript-consumers'
import {
  createAccumulator,
  finalizeSession,
  sessionIdFromFileName,
  updateTimeline
} from '../../parsing/session-scanner-accumulator'
import {
  addSessionContent,
  addPreviewMessage,
  SESSION_PREVIEW_MESSAGE_LIMIT
} from '../../parsing/session-scanner-messages'
import { decodeSessionMessage } from '../../transcripts/session-decoded-message'
import { shouldCaptureFullFirstUserPrompt } from '../../prompts/session-scanner-first-user-prompt'
import { asRecord } from '../../parsing/session-record-fields'
import { extractString } from '../../../../shared/text/trimmed-string'
import { timeObjectValue, timestampMs } from '../../parsing/session-record-time'
import {
  extractPreviewContentText,
  normalizeTitleText
} from '../../parsing/session-scanner-text-normalization'
import { tokenTotal } from '../../parsing/session-scanner-token-values'
import { openCodeToolInput, openCodeToolOutcome } from './session-scanner-opencode-tool-state'

/** Scope discovery reads cwd without opening message files. */
export function openCodeSessionCwd(record: Record<string, unknown>): string | null {
  return extractString(record.directory)
}

export async function parseOpenCodeSessionFile(
  file: FileWithMtime,
  platform: NodeJS.Platform = process.platform,
  messages?: TranscriptMessageSink,
  signal?: AbortSignal
): Promise<AiVaultSession | null> {
  const parsed: unknown = JSON.parse(
    await waitForAiVaultScan(wslGatedReadFile(file.path, 'utf-8', 'scan', signal), signal)
  )
  const record = asRecord(parsed)
  if (!record) {
    return null
  }
  const sessionId = extractString(record.id) ?? sessionIdFromFileName(file.path)
  const accumulator = createAccumulator({ agent: 'opencode', file, sessionId, messages })
  accumulator.title = normalizeTitleText(extractString(record.title) ?? '')
  accumulator.cwd = openCodeSessionCwd(record)
  updateTimeline(accumulator, timeObjectValue(record.time, 'created'))
  updateTimeline(accumulator, timeObjectValue(record.time, 'updated'))
  await consumeOpenCodeMessages(accumulator, findOpenCodeStorageRoot(file.path), sessionId, signal)
  return finalizeSession(accumulator, platform)
}

type OpenCodeJsonFile = { name: string; record: Record<string, unknown> }

const OPENCODE_JSON_PREVIEW_MESSAGE_WINDOW = 100

async function readOpenCodeJsonDirectory(
  directory: string,
  signal?: AbortSignal
): Promise<OpenCodeJsonFile[]> {
  let entries
  try {
    entries = await waitForAiVaultScan(wslGatedReaddir(directory, 'scan', signal), signal)
  } catch (error) {
    throwIfAiVaultScanCancelled(signal)
    if (!isMissingTranscriptPathError(error)) {
      noteTranscriptSourceFailure(error)
      throw error
    }
    return []
  }
  const records: OpenCodeJsonFile[] = []
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) {
      continue
    }
    const record = await readOpenCodeJsonRecord(join(directory, entry.name), signal)
    if (record) {
      records.push({ name: entry.name, record })
    }
  }
  return records
}

/** Malformed JSON stays skippable; an I/O refusal must not become a complete cached transcript. */
export async function readOpenCodeJsonRecord(
  path: string,
  signal?: AbortSignal
): Promise<Record<string, unknown> | null> {
  let content: string
  try {
    content = await waitForAiVaultScan(wslGatedReadFile(path, 'utf-8', 'scan', signal), signal)
  } catch (error) {
    throwIfAiVaultScanCancelled(signal)
    noteTranscriptSourceFailure(error)
    throw error
  }
  try {
    const parsed: unknown = JSON.parse(content)
    return asRecord(parsed)
  } catch (error) {
    if (error instanceof SyntaxError) {
      return null
    }
    throw error
  }
}

// Rebuild arbitrary directory order by creation time; undated files sort last so they cannot displace the first prompt.
async function readOpenCodeMessagesInOrder(
  messageDir: string,
  signal?: AbortSignal
): Promise<OpenCodeJsonFile[]> {
  const messages = (await readOpenCodeJsonDirectory(messageDir, signal)).map((entry) => {
    const createdMs = timestampMs(timeObjectValue(entry.record.time, 'created'))
    return {
      ...entry,
      createdMs: Number.isFinite(createdMs) ? createdMs : Number.POSITIVE_INFINITY
    }
  })
  return messages.sort((a, b) => a.createdMs - b.createdMs || a.name.localeCompare(b.name))
}

// MessageV2.parts lists part/<message file key>/ and sorts by part ID, which names each file.
async function readOpenCodeMessageParts(
  storageRoot: string,
  messageFileName: string,
  signal?: AbortSignal
): Promise<Record<string, unknown>[]> {
  const parts = await readOpenCodeJsonDirectory(
    join(storageRoot, 'part', basename(messageFileName, '.json')),
    signal
  )
  parts.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  return parts.flatMap(({ record }) => {
    if (record.type !== 'tool') {
      return [record]
    }
    const state = asRecord(record.state)
    return [
      { type: 'tool_use', name: record.tool, input: openCodeToolInput(state?.input) },
      { type: 'tool_result', content: openCodeToolOutcome(state) }
    ]
  })
}

// Listing keeps only the newest previews, so read the newest messages' parts until
// one more preview than is kept turns up; the window bounds tool-only tails like the SQLite preview query.
async function readOpenCodePreviewTail(
  storageRoot: string,
  messages: readonly OpenCodeJsonFile[],
  signal?: AbortSignal
): Promise<Map<number, unknown>> {
  const tail = new Map<number, unknown>()
  let previews = 0
  for (
    let index = messages.length - 1;
    index >= 0 &&
    previews <= SESSION_PREVIEW_MESSAGE_LIMIT &&
    tail.size < OPENCODE_JSON_PREVIEW_MESSAGE_WINDOW;
    index--
  ) {
    const { name, record } = messages[index]
    const role = extractString(record.role)
    if (role !== 'user' && role !== 'assistant') {
      continue
    }
    const content = record.content ?? (await readOpenCodeMessageParts(storageRoot, name, signal))
    tail.set(index, content)
    const { blocks } = decodeSessionMessage(role, content, null, { includeTools: false })
    const textParts = blocks.flatMap((block) => (block.kind === 'text' ? [block.text] : []))
    if (extractPreviewContentText(textParts, role) !== null) {
      previews++
    }
  }
  return tail
}

export async function consumeOpenCodeMessages(
  accumulator: SessionAccumulator,
  storageRoot: string | null,
  sessionId: string,
  signal?: AbortSignal
): Promise<void> {
  if (!storageRoot) {
    return
  }
  const messages = await readOpenCodeMessagesInOrder(
    join(storageRoot, 'message', sessionId),
    signal
  )
  const listing = !accumulator.messages.active
  // The on-demand first-prompt read keeps only firstUserPrompt, so it skips the preview tail.
  const fullFirstUserPrompt = shouldCaptureFullFirstUserPrompt()
  const previewTail =
    listing && !fullFirstUserPrompt
      ? await readOpenCodePreviewTail(storageRoot, messages, signal)
      : null
  for (const [index, { name, record: message }] of messages.entries()) {
    await waitForAiVaultScan(accumulator.messages.drain?.() ?? Promise.resolve(), signal)
    const role = extractString(message.role)
    if (role === 'user' || role === 'assistant') {
      accumulator.messageCount++
      updateTimeline(accumulator, timeObjectValue(message.time, 'created'))
      const summary = asRecord(message.summary)
      if (role === 'user') {
        accumulator.title ??= extractString(summary?.title) ?? extractString(summary?.body)
      }
      const timestamp = timeObjectValue(message.time, 'created')
      const readsParts =
        !listing || (fullFirstUserPrompt && role === 'user' && !accumulator.firstUserPrompt)
      const content =
        message.content ??
        previewTail?.get(index) ??
        (readsParts ? await readOpenCodeMessageParts(storageRoot, name, signal) : undefined)
      const hasPreview = addSessionContent(accumulator, role, content, timestamp, {
        preserveBlockOrder: message.content == null
      })
      if (!hasPreview) {
        addPreviewMessage(accumulator, {
          role,
          text: extractString(summary?.body) ?? extractString(summary?.title),
          timestamp
        })
      }
      accumulator.model =
        extractString(asRecord(message.model)?.modelID) ||
        extractString(message.modelID) ||
        accumulator.model
      accumulator.totalTokens += tokenTotal(message.tokens)
    }
  }
}

function findOpenCodeStorageRoot(filePath: string): string | null {
  const sessionDir = dirname(filePath)
  const sessionRoot = dirname(sessionDir)
  if (basename(sessionRoot) !== 'session') {
    return null
  }
  return dirname(sessionRoot)
}
