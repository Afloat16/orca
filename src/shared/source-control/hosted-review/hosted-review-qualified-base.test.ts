import { expect, it } from 'vitest'
import {
  hostedReviewBaseRefForBranch,
  normalizeHostedReviewBaseRef,
  normalizeCreateReviewBaseSearchResults,
  resolveGeneratedHostedReviewBaseRef
} from './hosted-review-refs'

it('keeps a literal branch identity through explicit refs, search and generated fields', () => {
  const names = [
    'origin/topic',
    'upstream/topic',
    'refs/remotes/origin/topic',
    'team/topic',
    'main'
  ]
  for (const branch of names) {
    const ref = hostedReviewBaseRefForBranch(branch)
    expect(normalizeHostedReviewBaseRef(ref)).toBe(branch)
    expect(resolveGeneratedHostedReviewBaseRef(branch, ref)).toBe(ref)
  }
  expect(normalizeHostedReviewBaseRef('refs/remotes/origin/origin/topic')).toBe('origin/topic')
  expect(normalizeHostedReviewBaseRef('origin/main')).toBe('main')
  expect(normalizeHostedReviewBaseRef('refs/remotes/origin/main')).toBe('main')
  expect(
    normalizeCreateReviewBaseSearchResults([
      { refName: 'origin/origin/topic', localBranchName: 'origin/topic' },
      { refName: 'refs/heads/origin/topic', localBranchName: 'origin/topic' },
      { refName: 'upstream/main', localBranchName: 'main' }
    ])
  ).toEqual(['origin/topic', 'main'])
})
