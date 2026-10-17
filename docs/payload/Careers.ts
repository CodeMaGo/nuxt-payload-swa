/**
 * Reference Payload 3 collection matching the model this app expects.
 * Copy into your Payload project (e.g. src/collections/Careers.ts) and add it
 * to `collections` in payload.config.ts. Not used by this repository's build.
 */
import type { CollectionConfig } from 'payload'
import { triggerSiteRebuild } from './triggerSiteRebuild'

export const Careers: CollectionConfig = {
  slug: 'careers',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'department', 'location', '_status', 'closingDate'],
  },
  versions: {
    drafts: true, // provides `_status`; set PAYLOAD_DRAFTS=false if you disable this
  },
  access: {
    // Public visitors and the site's API key may read published vacancies only.
    read: ({ req }) => (req.user ? true : { _status: { equals: 'published' } }),
  },
  hooks: {
    afterChange: [triggerSiteRebuild],
    afterDelete: [triggerSiteRebuild],
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { position: 'sidebar', description: 'Lowercase words separated by hyphens' },
      validate: (value: unknown) =>
        typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
          ? true
          : 'Use lowercase letters, numbers and hyphens only',
    },
    { name: 'department', type: 'text' },
    { name: 'location', type: 'text' },
    {
      name: 'employmentType',
      type: 'select',
      options: ['Full-time', 'Part-time', 'Contract', 'Temporary', 'Internship'],
    },
    { name: 'description', type: 'richText' },
    { name: 'applicationUrl', type: 'text' },
    { name: 'closingDate', type: 'date' },
    { name: 'publishedAt', type: 'date', admin: { position: 'sidebar' } },
  ],
}
