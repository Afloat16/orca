import { isSafeGitRefName } from '../../../shared/git/status/git-status-upstream-ref'
import { isRemoteHeadRef } from '../../../shared/source-control/hosted-review/hosted-review-refs'
import { isSafeReviewHeadFetchRemote } from '../../../shared/worktree/hosted-review/review-head-tracking-ref'
import {
  probeExactRefsViaForEachRef,
  type ExactRefProbeExecOptions
} from '../../git/refs/resolution/exact-ref-probe'

export type PullRequestGitExec = (
  args: string[],
  options?: { maxBuffer?: number; timeoutMs?: number }
) => Promise<{ stdout: string; stderr?: string }>

export type PullRequestRemoteRefState = {
  remotes: string[]
  refs: string[]
  probeUnknown: boolean
}

function* iterateGitOutputLines(output: string): Generator<string> {
  let lineStart = 0
  for (let index = 0; index < output.length; index++) {
    const code = output.charCodeAt(index)
    if (code !== 10 && code !== 13) {
      continue
    }
    yield output.slice(lineStart, index)
    if (code === 13 && output.charCodeAt(index + 1) === 10) {
      index++
    }
    lineStart = index + 1
  }
  if (lineStart <= output.length) {
    yield output.slice(lineStart)
  }
}

function splitGitLines(output: string): string[] {
  const lines: string[] = []
  for (const rawLine of iterateGitOutputLines(output)) {
    const line = rawLine.trim()
    if (line.length > 0 && isSafeReviewHeadFetchRemote(line)) {
      lines.push(line)
    }
  }
  return lines
}

/** Keep stale tracking refs from turning an unconfigured remote into a fetch option. */
function hasSafeRemoteComponent(ref: string, remotes: readonly string[]): boolean {
  const shortRef = ref.startsWith('refs/remotes/') ? ref.slice('refs/remotes/'.length) : ref
  const remote = [...remotes]
    .sort((left, right) => right.length - left.length)
    .find((candidate) => shortRef.startsWith(`${candidate}/`))
  const fallbackRemote = shortRef.split('/')[0] ?? ''
  return isSafeReviewHeadFetchRemote(remote ?? fallbackRemote)
}

async function safeExec(
  execGit: PullRequestGitExec,
  args: string[],
  options: ExactRefProbeExecOptions
): Promise<string> {
  try {
    const { stdout } = await execGit(args, options)
    return stdout.trim()
  } catch {
    return ''
  }
}

export function canQueryRemoteBaseRefs(base: string): boolean {
  return isSafeGitRefName(`refs/remotes/${base}`)
}

async function listExactRemoteBaseRefs(
  execGit: PullRequestGitExec,
  base: string,
  remotes: readonly string[],
  options: ExactRefProbeExecOptions,
  branchOnly: boolean
): Promise<{ refs: string[]; probeUnknown: boolean }> {
  // Only configured remote prefixes qualify a base; slash-containing branch names still need remote candidate probes.
  const isConfiguredQualifiedBase =
    !branchOnly && base.includes('/') && remotes.some((remote) => base.startsWith(`${remote}/`))
  // Bare names are suffixes, not complete remote-tracking refs; probe exact spelling only for qualified candidates.
  const exactRefNames = new Set<string>([
    ...(!branchOnly && base.includes('/') ? [base] : []),
    ...(isConfiguredQualifiedBase
      ? []
      : [`origin/${base}`, `upstream/${base}`, ...remotes.map((remote) => `${remote}/${base}`)])
  ])
  const refs = [...exactRefNames].filter((ref) => isSafeGitRefName(`refs/remotes/${ref}`))
  const qualifiedRefs = refs.map((ref) => `refs/remotes/${ref}`)
  const result = await probeExactRefsViaForEachRef(execGit, qualifiedRefs, options)
  const present = new Set(result.presentRefs)
  return {
    refs: refs.filter((ref) => present.has(`refs/remotes/${ref}`)),
    probeUnknown: result.unknownRefs.length > 0
  }
}

function parseSuffixRemoteRefs(
  output: string,
  base: string,
  remotes: readonly string[],
  branchOnly: boolean
): string[] {
  const refs = new Set<string>()
  const remoteNames = [...remotes].sort((left, right) => right.length - left.length)
  for (const line of iterateGitOutputLines(output)) {
    const separator = line.indexOf(' ')
    if (separator === -1) {
      continue
    }
    const fullRef = line.slice(separator + 1).trim()
    if (!fullRef.startsWith('refs/remotes/') || !isSafeGitRefName(fullRef)) {
      continue
    }
    if (!hasSafeRemoteComponent(fullRef, remotes)) {
      continue
    }
    const shortRef = fullRef.slice('refs/remotes/'.length)
    const remote =
      remoteNames.find((name) => shortRef.startsWith(`${name}/`)) ?? shortRef.split('/')[0]
    if (
      !shortRef.includes('/') ||
      isRemoteHeadRef(shortRef, remotes) ||
      // Bare HEAD denotes the remote symbolic slot, not feature/HEAD.
      (base === 'HEAD' && shortRef.endsWith('/HEAD')) ||
      (branchOnly
        ? shortRef.slice(remote.length + 1) !== base
        : shortRef !== base && !shortRef.endsWith(`/${base}`))
    ) {
      continue
    }
    refs.add(shortRef)
    // Retain at most two candidates because resolution only needs zero/one/ambiguous.
    if (refs.size >= 2) {
      break
    }
  }
  return [...refs]
}

async function listSuffixRemoteBaseRefs(
  execGit: PullRequestGitExec,
  base: string,
  remotes: readonly string[],
  options: ExactRefProbeExecOptions,
  branchOnly: boolean
): Promise<string[]> {
  try {
    const { stdout } = await execGit(['show-ref', '--', base], options)
    return parseSuffixRemoteRefs(stdout, base, remotes, branchOnly)
  } catch {
    // Overflow/transport failure is inconclusive; preserve the bare candidate rather than block generation.
    return []
  }
}

function shouldSearchSuffixRemoteRefs(
  base: string,
  remotes: readonly string[],
  refs: readonly string[],
  probeUnknown: boolean,
  branchOnly: boolean
): boolean {
  if (
    probeUnknown ||
    refs.length >= 2 ||
    (!branchOnly &&
      (refs.includes(base) || remotes.some((remote) => base.startsWith(`${remote}/`))))
  ) {
    return false
  }
  return !['origin', 'upstream'].some(
    (remote) => remotes.includes(remote) || refs.includes(`${remote}/${base}`)
  )
}

export async function getPullRequestRemoteRefState(
  execGit: PullRequestGitExec,
  base: string,
  maxBuffer: number
): Promise<PullRequestRemoteRefState> {
  const branchOnly = base.startsWith('refs/heads/')
  const reference = base
  base = branchOnly
    ? reference.slice('refs/heads/'.length)
    : reference.startsWith('refs/remotes/')
      ? reference.slice('refs/remotes/'.length)
      : reference
  const probeOptions: ExactRefProbeExecOptions = { maxBuffer }
  const queryable = canQueryRemoteBaseRefs(base)
  const remotes = splitGitLines(await safeExec(execGit, ['remote'], probeOptions))
  const exactResult = queryable
    ? await listExactRemoteBaseRefs(execGit, base, remotes, probeOptions, branchOnly)
    : { refs: [], probeUnknown: false }
  const suffixRefs =
    queryable &&
    shouldSearchSuffixRemoteRefs(
      base,
      remotes,
      exactResult.refs,
      exactResult.probeUnknown,
      branchOnly
    )
      ? await listSuffixRemoteBaseRefs(execGit, base, remotes, probeOptions, branchOnly)
      : []
  return {
    remotes,
    refs: [...new Set([...exactResult.refs, ...suffixRefs])].filter(
      (ref) => !isRemoteHeadRef(ref, remotes) && hasSafeRemoteComponent(ref, remotes)
    ),
    probeUnknown: exactResult.probeUnknown
  }
}
