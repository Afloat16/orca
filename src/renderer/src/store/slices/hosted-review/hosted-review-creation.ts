import type { AppState } from '../../types'
import type { HostedReviewSlice } from './hosted-review'
import type {
  CreateHostedReviewResult,
  CreateStackedHostedReviewResult
} from '../../../../../shared/source-control/hosted-review/hosted-review-contracts'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import { requireHostedReviewBaseIdentity } from '@/runtime/source-control/reviews/runtime-hosted-review-base-identity'
import { normalizeHostedReviewBaseRef } from '../../../../../shared/source-control/hosted-review/hosted-review-refs'
import {
  findHostedReviewRepoByPath,
  hostedReviewRepoOwnerTarget
} from './hosted-review-cache-state'

export function createHostedReviewCreation(
  get: () => AppState
): Pick<HostedReviewSlice, 'createHostedReview' | 'createStackedHostedReview'> {
  return {
    createHostedReview: async (repoPath, input) => {
      const repo = findHostedReviewRepoByPath(
        get().repos,
        repoPath,
        input.repoId,
        input.repoOwnerExecutionHostId
      )
      if (!repo && input.repoOwnerExecutionHostId) {
        return {
          ok: false,
          code: 'validation',
          error: 'The workspace host is unresolved. Refresh the workspace and retry.'
        }
      }
      const target = hostedReviewRepoOwnerTarget(repo)
      const baseBranch = normalizeHostedReviewBaseRef(input.base)
      if (normalizeHostedReviewBaseRef(baseBranch) !== baseBranch) {
        await requireHostedReviewBaseIdentity(target, {
          repoPath,
          repoId: repo?.id ?? input.repoId ?? undefined,
          worktreePath: input.worktreePath,
          connectionId: repo?.connectionId ?? null,
          base: input.base,
          head: input.head,
          wakeWslDistro: true
        })
      }
      const {
        repoId: inputRepoId,
        repoOwnerExecutionHostId: _ownerHostId,
        ...hostedReviewInput
      } = input
      if (target.kind === 'environment') {
        const { worktreePath, ...runtimeInput } = hostedReviewInput
        return callRuntimeRpc<CreateHostedReviewResult>(
          target,
          'hostedReview.create',
          {
            repo: repo?.id ?? repoPath,
            ...(worktreePath ? { worktree: `path:${worktreePath}` } : {}),
            ...runtimeInput
          },
          { timeoutMs: 60_000 }
        )
      }
      return window.api.hostedReview.create({
        repoPath,
        repoId: repo?.id ?? inputRepoId ?? undefined,
        connectionId: repo?.connectionId ?? null,
        ...hostedReviewInput
      })
    },

    createStackedHostedReview: async (repoPath, input) => {
      const repo = findHostedReviewRepoByPath(
        get().repos,
        repoPath,
        input.repoId,
        input.repoOwnerExecutionHostId
      )
      if (!repo && input.repoOwnerExecutionHostId) {
        return {
          ok: false,
          code: 'validation',
          error: 'The workspace host is unresolved. Refresh the workspace and retry.'
        }
      }
      const target = hostedReviewRepoOwnerTarget(repo)
      const baseBranch = normalizeHostedReviewBaseRef(input.base)
      if (normalizeHostedReviewBaseRef(baseBranch) !== baseBranch) {
        await requireHostedReviewBaseIdentity(target, {
          repoPath,
          repoId: repo?.id ?? input.repoId ?? undefined,
          worktreePath: input.worktreePath,
          connectionId: repo?.connectionId ?? null,
          base: input.base,
          head: input.head,
          wakeWslDistro: true
        })
      }
      const {
        repoId: inputRepoId,
        repoOwnerExecutionHostId: _ownerHostId,
        ...hostedReviewInput
      } = input
      if (target.kind === 'environment') {
        const { worktreePath, ...runtimeInput } = hostedReviewInput
        return callRuntimeRpc<CreateStackedHostedReviewResult>(
          target,
          'hostedReview.createStacked',
          {
            repo: repo?.id ?? repoPath,
            ...(worktreePath ? { worktree: `path:${worktreePath}` } : {}),
            ...runtimeInput
          },
          { timeoutMs: 90_000 }
        )
      }
      return window.api.hostedReview.createStacked({
        repoPath,
        repoId: repo?.id ?? inputRepoId ?? undefined,
        connectionId: repo?.connectionId ?? null,
        ...hostedReviewInput
      })
    }
  }
}
