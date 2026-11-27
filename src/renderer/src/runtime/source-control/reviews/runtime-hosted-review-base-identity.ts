import type { RuntimeClientTarget } from '../../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import type { HostedReviewCreationEligibility } from '../../../../../shared/source-control/hosted-review/hosted-review-contracts'
import { normalizeHostedReviewBaseRef } from '../../../../../shared/source-control/hosted-review/hosted-review-refs'
import { callRuntimeRpc } from '../../rpc/calls/runtime-rpc-call'
import { toRuntimeWorktreeSelector } from '../../rpc/targets/runtime-worktree-selector'

type HostedReviewBaseIdentityInput = {
  repoPath: string
  repoId?: string
  worktreePath?: string
  worktreeId?: string | null
  connectionId?: string | null
  base: string
  head?: string
  wakeWslDistro?: boolean
}

/** A legacy host can strip a literal prefix again; require proof from the transport used for the write. */
export async function requireHostedReviewBaseIdentity(
  target: RuntimeClientTarget,
  input: HostedReviewBaseIdentityInput
): Promise<void> {
  const { repoPath, repoId, worktreePath, worktreeId, connectionId, base, head, wakeWslDistro } =
    input
  const eligibility =
    target.kind === 'environment'
      ? await callRuntimeRpc<HostedReviewCreationEligibility>(
          target,
          'hostedReview.getCreationEligibility',
          {
            repo: repoId ?? repoPath,
            ...(worktreeId
              ? { worktree: toRuntimeWorktreeSelector(worktreeId) }
              : worktreePath
                ? { worktree: `path:${worktreePath}` }
                : {}),
            branch: head || 'HEAD',
            base,
            wakeWslDistro
          },
          { timeoutMs: 30_000 }
        )
      : await window.api.hostedReview.getCreationEligibility({
          repoPath,
          repoId,
          worktreePath,
          connectionId,
          branch: head || 'HEAD',
          base,
          wakeWslDistro
        })
  if (eligibility.requestedBaseBranch !== normalizeHostedReviewBaseRef(base)) {
    throw new Error(
      'The workspace host could not verify the selected base branch. Update Orca on that host and retry.'
    )
  }
}
