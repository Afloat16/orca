import '../worker/session-search-worker.test-fixture'
import { mkdir, rm, stat, utimes, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import {
  flushSessionParseCachePersist,
  initSessionParseCachePersistence,
  resetSessionParseCachePersistenceForTests
} from '../../ai-vault/parse-cache/session-parse-cache-persistence'
import { resetSessionParseCacheForTests } from '../../ai-vault/parse-cache/session-parse-cache-store'
import { withFullFirstUserPromptCapture } from '../../ai-vault/prompts/session-scanner-first-user-prompt-capture'
import { scanAiVaultSessions } from '../../ai-vault/session-scanner'
import { resetTranscriptConsumersForTests } from '../../ai-vault/transcripts/session-transcript-consumers'
import { SessionSearchDirectoryListings } from '../discovery/session-search-directory-listings'
import { SessionSearchEngine } from '../query/session-search-engine'
import { SessionSearchStore } from '../storage/session-search-store'
import { SessionSearchWorkerStore } from '../worker/session-search-worker-store'
import { registerSessionSearchIndexConsumer } from './session-search-index-consumer'
import {
  openSessionSearchIndexerHarness,
  type SessionSearchIndexerHarness
} from './session-search-indexer-test-fixture'
import { runSessionSearchPass } from './session-search-pass'

let harness: SessionSearchIndexerHarness
let store: SessionSearchStore | SessionSearchWorkerStore | undefined
let sessionPath: string
let userPart: string

async function put(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(value))
}

beforeEach(async () => {
  resetSessionParseCacheForTests()
  harness = await openSessionSearchIndexerHarness('ss-opencode-json-refresh')
  const root = harness.roots.opencodeStorageDir!
  sessionPath = join(root, 'session', 'project', 'ses_refresh.json')
  userPart = join(root, 'part', 'msg_user', 'prt_01.json')
  await put(sessionPath, {
    id: 'ses_refresh',
    title: 'Saved conversation',
    directory: harness.root,
    time: { created: 1784109600000, updated: 1784109600001 }
  })
  await put(join(root, 'message', 'ses_refresh', 'msg_user.json'), {
    id: 'msg_user',
    sessionID: 'ses_refresh',
    role: 'user',
    time: { created: 1784109600000 }
  })
  await put(userPart, { id: 'prt_01', type: 'text', text: 'amber request' })
})

async function closeStore(): Promise<void> {
  resetTranscriptConsumersForTests()
  store?.close()
  if (store instanceof SessionSearchWorkerStore) {
    await store.retired()
  }
  store = undefined
}

afterEach(async () => {
  await closeStore()
  resetSessionParseCachePersistenceForTests()
  resetSessionParseCacheForTests()
  await harness.cleanup()
})

async function replacePrompt(text: string): Promise<void> {
  const before = await stat(userPart)
  await put(userPart, { id: 'prt_01', type: 'text', text })
  const later = new Date(before.mtimeMs + 4_000)
  await utimes(userPart, later, later)
  expect((await stat(userPart)).size).toBe(before.size)
}

async function listedPrompt(): Promise<string | undefined> {
  const result = await withFullFirstUserPromptCapture(() =>
    scanAiVaultSessions({ ...harness.roots, unlimited: true })
  )
  expect(result.sessions.map((session) => session.sessionId)).toEqual(['ses_refresh'])
  return result.sessions[0]?.firstUserPrompt
}

function pass(): Promise<unknown> {
  if (!store) {
    throw new Error('Search store is closed')
  }
  return runSessionSearchPass({
    store,
    roots: harness.roots,
    full: true,
    recentPerAgent: Number.POSITIVE_INFINITY,
    listings: new SessionSearchDirectoryListings()
  })
}

function matches(query: string): string[] {
  return harness.write((db) =>
    new SessionSearchEngine(db).search({ query }).hits.map((hit) => hit.sessionId)
  )
}

async function unchangedSession(before: { mtimeMs: number; size: number }): Promise<void> {
  const after = await stat(sessionPath)
  expect({ mtimeMs: after.mtimeMs, size: after.size }).toEqual(before)
}

it('refreshes History from changed, added and deleted parts after a parse-cache restart', async () => {
  const { mtimeMs, size } = await stat(sessionPath)
  const cacheOptions = { filePath: join(harness.root, 'cache', 'parse.json'), appVersion: 'test' }
  initSessionParseCachePersistence(cacheOptions)
  expect(await listedPrompt()).toBe('amber request')
  await flushSessionParseCachePersist()

  resetSessionParseCachePersistenceForTests()
  resetSessionParseCacheForTests()
  initSessionParseCachePersistence(cacheOptions)
  await replacePrompt('cedar request')
  expect(await listedPrompt()).toBe('cedar request')

  const added = join(dirname(userPart), 'prt_02.json')
  await put(added, { id: 'prt_02', type: 'text', text: 'retain this appendix' })
  expect(await listedPrompt()).toBe('cedar request\nretain this appendix')
  await rm(added)
  expect(await listedPrompt()).toBe('cedar request')
  await unchangedSession({ mtimeMs, size })
})

it.each(['direct', 'worker'] as const)(
  'refreshes durable %s search results when only OpenCode part files change',
  async (mode) => {
    const { mtimeMs, size } = await stat(sessionPath)
    const open = async (): Promise<void> => {
      store =
        mode === 'direct'
          ? new SessionSearchStore(harness.databasePath)
          : new SessionSearchWorkerStore(harness.databasePath, (error) => {
              throw error
            })
      registerSessionSearchIndexConsumer(store)
      if (store instanceof SessionSearchWorkerStore) {
        await store.prepare()
      }
    }
    await open()
    await pass()
    expect(matches('amber')).toEqual(['ses_refresh'])
    await closeStore()

    await replacePrompt('cedar request')
    await open()
    expect(matches('amber')).toEqual(['ses_refresh'])
    await pass()
    expect(matches('cedar')).toEqual(['ses_refresh'])
    expect(matches('amber')).toEqual([])

    await replacePrompt('birch request')
    await pass()
    expect(matches('birch')).toEqual(['ses_refresh'])
    expect(matches('cedar')).toEqual([])

    const added = join(dirname(userPart), 'prt_02.json')
    await put(added, { id: 'prt_02', type: 'text', text: 'violet appendix' })
    await pass()
    expect(matches('violet')).toEqual(['ses_refresh'])
    await rm(added)
    await pass()
    expect(matches('violet')).toEqual([])
    expect(matches('birch')).toEqual(['ses_refresh'])
    await unchangedSession({ mtimeMs, size })
  }
)
