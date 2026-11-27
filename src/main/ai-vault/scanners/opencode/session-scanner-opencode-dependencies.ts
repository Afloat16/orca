import { createHash, type Hash } from 'node:crypto'
import { extractString } from '../../../../shared/text/trimmed-string'
import { readOpenCodeJsonRecord } from './session-scanner-opencode-parser'
import { basename, extname, join, relative } from 'node:path'
import {
  wslGatedReaddir,
  wslGatedStat
} from '../../../native-chat/transcript-filesystem/wsl-transcript-fs-access'
import { isMissingTranscriptPathError } from '../../discovery/session-path-absence'
import { throwIfAiVaultScanCancelled } from '../../scan-lifecycle/ai-vault-scan-cancellation'

/** Message and part writes do not touch the session JSON. Keep their observed revision separate. */
export async function openCodeDependencySignature(
  storageRoot: string,
  sessionPath: string,
  signal?: AbortSignal
): Promise<string> {
  const digest = createHash('sha256')
  const sessionId = basename(sessionPath, extname(sessionPath))
  const messages = join(storageRoot, 'message', sessionId)

  const namesIn = async (directory: string): Promise<string[]> => {
    try {
      const entries = await wslGatedReaddir(directory, 'scan', signal)
      return entries
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
  const observe = async (path: string, revision: Hash): Promise<void> => {
    throwIfAiVaultScanCancelled(signal)
    const observed = await wslGatedStat(path, 'scan', signal)
    revision.update(
      JSON.stringify([
        relative(storageRoot, path),
        observed.size,
        observed.mtimeMs,
        observed.ctimeMs
      ])
    )
  }
  for (const name of await namesIn(messages)) {
    const messagePath = join(messages, name)
    await observe(messagePath, digest)
    const parts = join(storageRoot, 'part', basename(name, '.json'))
    const partRevision = createHash('sha256')
    try {
      for (const part of await namesIn(parts)) {
        await observe(join(parts, part), partRevision)
      }
      digest.update(partRevision.digest('hex'))
    } catch (error) {
      throwIfAiVaultScanCancelled(signal)
      // Read message content only when a failed dependency might be unused by the parser.
      const message = await readOpenCodeJsonRecord(messagePath, signal)
      const role = extractString(message?.role)
      if ((role === 'user' || role === 'assistant') && message?.content == null) {
        throw error
      }
      digest.update('unused-parts')
    }
  }
  throwIfAiVaultScanCancelled(signal)
  return digest.digest('hex')
}
