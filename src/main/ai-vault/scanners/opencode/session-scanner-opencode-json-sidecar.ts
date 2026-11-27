import { createHash } from 'node:crypto'
import { basename, join } from 'node:path'
import type { AiVaultScanIssue } from '../../../../shared/ai-vault/contracts/ai-vault-types'
import {
  wslGatedReaddir,
  wslGatedStat
} from '../../../native-chat/transcript-filesystem/wsl-transcript-fs-access'
import { isMissingTranscriptPathError } from '../../discovery/session-path-absence'
import type { SessionSidecarObservation } from '../../parse-cache/session-sidecar-stat'
import { recordSessionScanIssue, scanIssueTextFromError } from '../../parsing/session-scan-issues'
import { throwIfAiVaultScanCancelled } from '../../scan-lifecycle/ai-vault-scan-cancellation'

/** OpenCode updates message/part files independently of the session metadata file. */
export async function observeOpenCodeJsonSidecar(
  storageDir: string,
  sessionPath: string,
  issues: AiVaultScanIssue[],
  signal?: AbortSignal
): Promise<SessionSidecarObservation> {
  const messageDir = join(storageDir, 'message', basename(sessionPath, '.json'))
  const hash = createHash('sha256')
  let mtimeMs = 0
  let sizeBytes = 0
  const observe = async (directory: string, name: string): Promise<void> => {
    const stat = await wslGatedStat(join(directory, name), 'scan', signal)
    hash.update(JSON.stringify([directory, name, stat.mtimeMs, stat.size, stat.dev, stat.ino]))
    mtimeMs = Math.max(mtimeMs, stat.mtimeMs)
    sizeBytes += stat.size
  }
  try {
    for (const message of await jsonFiles(messageDir, signal)) {
      await observe(messageDir, message)
      // Storage.write(["message", sessionID, id]) uses the same id as the part directory.
      const messageId = basename(message, '.json')
      if (!messageId) {
        continue
      }
      const partDir = join(storageDir, 'part', messageId)
      for (const part of await jsonFiles(partDir, signal)) {
        await observe(partDir, part)
      }
    }
    return {
      path: messageDir,
      mtimeMs,
      sizeBytes,
      contentSignature: hash.digest('hex')
    }
  } catch (error) {
    throwIfAiVaultScanCancelled(signal)
    recordSessionScanIssue(issues, {
      agent: 'opencode',
      path: messageDir,
      ...scanIssueTextFromError(error)
    })
    return 'unknown'
  }
}

async function jsonFiles(directory: string, signal?: AbortSignal): Promise<string[]> {
  try {
    return (await wslGatedReaddir(directory, 'scan', signal))
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => entry.name)
      .sort()
  } catch (error) {
    throwIfAiVaultScanCancelled(signal)
    if (isMissingTranscriptPathError(error)) {
      return []
    }
    throw error
  }
}
