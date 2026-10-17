/**
 * Payload hook that asks GitHub Actions to rebuild the static site when a
 * vacancy is published, changed or deleted. Copy into your Payload project.
 *
 * Payload environment variables:
 *   GITHUB_REPOSITORY  e.g. "my-org/careers-site"
 *   GITHUB_DISPATCH_TOKEN  fine-grained PAT for that repo with "Contents: read and write"
 */
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

export const triggerSiteRebuild: CollectionAfterChangeHook & CollectionAfterDeleteHook = async ({ doc, req }) => {
  const repo = process.env.GITHUB_REPOSITORY
  const token = process.env.GITHUB_DISPATCH_TOKEN

  // Saving a draft does not change the public site; skip it.
  if (!repo || !token || doc?._status === 'draft') return doc

  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ event_type: 'payload-content-changed', client_payload: { slug: doc?.slug } }),
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) req.payload.logger.warn(`Site rebuild request failed: HTTP ${response.status}`)
  } catch (error) {
    // Never block editors because the rebuild trigger failed.
    req.payload.logger.warn({ err: error }, 'Site rebuild request failed')
  }

  return doc
}
