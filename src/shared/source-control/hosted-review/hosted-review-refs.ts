import type { BaseRefSearchResult } from '../../repository/repo-types'

export function normalizeHostedReviewHeadRef(ref: string): string {
  return ref.trim().replace(/^(?:refs\/heads\/|refs\/remotes\/[^/]+\/)/, '')
}

export function normalizeHostedReviewBaseRef(ref: string): string {
  const normalized = normalizeHostedReviewHeadRef(ref)
  // An explicit namespace already identified the branch; its own prefix is literal.
  return ref.trim().startsWith('refs/')
    ? normalized
    : normalized.replace(/^(origin|upstream)\//, '')
}

/** Branch names from search/provider results must not be reinterpreted as remote shorthand. */
export function hostedReviewBaseRefForBranch(branch: string): string {
  const name = branch.trim()
  return name ? `refs/heads/${name}` : ''
}

export function resolveGeneratedHostedReviewBaseRef(generated: string, requested: string): string {
  const base = generated.trim()
  const original = requested.trim()
  if (!base || base === original || base === normalizeHostedReviewBaseRef(original)) {
    return original
  }
  return base.startsWith('refs/') ? base : hostedReviewBaseRefForBranch(base)
}

/** Exclude only a remote's direct symbolic HEAD, preserving branches like feature/HEAD. */
export function isRemoteHeadRef(ref: string, remotes: readonly string[] = []): boolean {
  // Every true result ends in `/HEAD`, so ordinary refs can skip the remote copy+sort.
  if (!ref.endsWith('/HEAD')) {
    return false
  }
  const shortRef = ref.startsWith('refs/remotes/') ? ref.slice('refs/remotes/'.length) : ref
  const remote = [...remotes]
    .sort((left, right) => right.length - left.length)
    .find((candidate) => shortRef.startsWith(`${candidate}/`))
  if (remote) {
    return shortRef.slice(remote.length + 1) === 'HEAD'
  }
  // Unconfigured stale remotes are unambiguous only as <remote>/HEAD.
  return shortRef.split('/').length === 2 && shortRef.endsWith('/HEAD')
}

export function normalizeCreateReviewBaseSearchResults(
  results: readonly BaseRefSearchResult[]
): string[] {
  const seen = new Set<string>()
  const branches: string[] = []
  for (const result of results) {
    // APIs need branch names; detailed search resolves remote-qualified refs, including slash-containing remote names.
    const branch = result.localBranchName
      ? result.localBranchName.trim()
      : normalizeHostedReviewBaseRef(result.refName)
    if (!branch || seen.has(branch)) {
      continue
    }
    seen.add(branch)
    branches.push(branch)
  }
  return branches
}
