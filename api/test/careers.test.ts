import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleGetCareer, handleListCareers, isValidSlug, parsePagination } from '../../shared/careers/http'
import { fetchAllPublishedSlugs, payloadConfigFromEnv } from '../../shared/careers/payload-client'
import { safeUrl, toExcerpt, toPlainText } from '../../shared/careers/rich-text'

const env = { PAYLOAD_URL: 'https://cms.example.com/', PAYLOAD_API_KEY: 'secret' }
const silent = () => {}

function mockFetch(...responses: Array<{ status?: number; body?: unknown }>) {
  const fn = vi.fn()
  for (const { status = 200, body = {} } of responses) {
    fn.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }))
  }
  vi.stubGlobal('fetch', fn)
  return fn
}

function requestedUrl(fn: ReturnType<typeof vi.fn>, call = 0) {
  return new URL(fn.mock.calls[call]![0] as string)
}

afterEach(() => vi.unstubAllGlobals())

describe('payloadConfigFromEnv', () => {
  it('requires PAYLOAD_URL', () => {
    expect(() => payloadConfigFromEnv({})).toThrow('PAYLOAD_URL')
  })

  it('builds an API-key header and strips trailing slashes', () => {
    const config = payloadConfigFromEnv({ ...env, PAYLOAD_API_KEY_COLLECTION: 'service-accounts' })
    expect(config.baseUrl).toBe('https://cms.example.com')
    expect(config.headers.Authorization).toBe('service-accounts API-Key secret')
    expect(config.drafts).toBe(true)
  })

  it('omits auth when no key is set and honours PAYLOAD_DRAFTS=false', () => {
    const config = payloadConfigFromEnv({ PAYLOAD_URL: 'http://x', PAYLOAD_DRAFTS: 'false' })
    expect(config.headers.Authorization).toBeUndefined()
    expect(config.drafts).toBe(false)
  })
})

describe('parsePagination', () => {
  it('clamps and defaults values', () => {
    expect(parsePagination(new URLSearchParams())).toEqual({ limit: 10, page: 1 })
    expect(parsePagination(new URLSearchParams('limit=500&page=0'))).toEqual({ limit: 50, page: 1 })
    expect(parsePagination(new URLSearchParams('limit=abc&page=3'))).toEqual({ limit: 10, page: 3 })
  })
})

describe('isValidSlug', () => {
  it.each([
    ['senior-software-engineer', true],
    ['role-2', true],
    ['Bad Slug', false],
    ['../etc', false],
    ['a'.repeat(201), false],
    [undefined, false],
  ])('%s -> %s', (slug, expected) => {
    expect(isValidSlug(slug)).toBe(expected)
  })
})

describe('handleListCareers', () => {
  it('queries published careers with selection, sort and pagination', async () => {
    const fetchFn = mockFetch({
      body: {
        docs: [{ id: 1, title: 'Engineer', slug: 'engineer', internalNotes: 'hidden' }],
        totalDocs: 1, limit: 20, totalPages: 1, page: 2, hasNextPage: false, hasPrevPage: true,
      },
    })

    const result = await handleListCareers(new URLSearchParams('limit=20&page=2'), env, silent)

    expect(result.status).toBe(200)
    const url = requestedUrl(fetchFn)
    expect(url.pathname).toBe('/api/careers')
    expect(url.searchParams.get('where[_status][equals]')).toBe('published')
    expect(url.searchParams.get('sort')).toBe('-publishedAt')
    expect(url.searchParams.get('limit')).toBe('20')
    expect(url.searchParams.get('page')).toBe('2')
    expect(url.searchParams.get('select[title]')).toBe('true')
    expect(url.searchParams.get('depth')).toBe('0')
    expect(fetchFn.mock.calls[0]![1].headers.Authorization).toBe('users API-Key secret')

    const body = result.body as unknown as { docs: Record<string, unknown>[] }
    expect(body.docs[0]).toMatchObject({ id: '1', title: 'Engineer' })
    expect(body.docs[0]).not.toHaveProperty('internalNotes')
  })

  it('returns 502 when Payload fails', async () => {
    mockFetch({ status: 503 })
    const result = await handleListCareers(new URLSearchParams(), env, silent)
    expect(result).toMatchObject({ status: 502, headers: { 'Cache-Control': 'no-store' } })
  })

  it('returns 500 when misconfigured', async () => {
    const result = await handleListCareers(new URLSearchParams(), {}, silent)
    expect(result.status).toBe(500)
  })
})

describe('handleGetCareer', () => {
  it('rejects invalid slugs without calling Payload', async () => {
    const fetchFn = mockFetch()
    const result = await handleGetCareer('Not Valid!', env, silent)
    expect(result.status).toBe(400)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('returns 404 when no published career matches', async () => {
    const fetchFn = mockFetch({ body: { docs: [] } })
    const result = await handleGetCareer('missing-role', env, silent)
    expect(result.status).toBe(404)
    expect(requestedUrl(fetchFn).searchParams.get('where[slug][equals]')).toBe('missing-role')
  })

  it('returns the career', async () => {
    mockFetch({ body: { docs: [{ id: 'abc', title: 'PM', slug: 'pm' }] } })
    const result = await handleGetCareer('pm', env, silent)
    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({ id: 'abc', slug: 'pm', department: null })
  })
})

describe('fetchAllPublishedSlugs', () => {
  it('follows pagination and selects only the slug', async () => {
    const fetchFn = mockFetch(
      { body: { docs: [{ slug: 'a' }, { slug: 'b' }], hasNextPage: true } },
      { body: { docs: [{ slug: 'c' }], hasNextPage: false } },
    )
    const slugs = await fetchAllPublishedSlugs(payloadConfigFromEnv(env))
    expect(slugs).toEqual(['a', 'b', 'c'])
    expect(requestedUrl(fetchFn, 1).searchParams.get('page')).toBe('2')
    expect(requestedUrl(fetchFn).searchParams.get('select[title]')).toBeNull()
  })
})

describe('rich text helpers', () => {
  const lexical = {
    root: {
      type: 'root',
      children: [
        { type: 'heading', tag: 'h2', children: [{ type: 'text', text: 'About' }] },
        { type: 'paragraph', children: [{ type: 'text', text: 'Build great things.' }] },
      ],
    },
  }

  it('flattens Lexical to plain text', () => {
    expect(toPlainText(lexical)).toBe('About Build great things.')
    expect(toPlainText('  plain   text ')).toBe('plain text')
    expect(toPlainText(null)).toBe('')
  })

  it('builds excerpts from the first paragraph', () => {
    expect(toExcerpt(lexical, 100)).toBe('Build great things.')
    expect(toExcerpt('plain', 100)).toBe('plain')
  })

  it('truncates on a word boundary', () => {
    expect(toPlainText('one two three four five six', 14)).toBe('one two three…')
  })

  it('only allows safe URLs', () => {
    expect(safeUrl('https://example.com')).toBe('https://example.com')
    expect(safeUrl('/careers')).toBe('/careers')
    expect(safeUrl('javascript:alert(1)')).toBeUndefined()
    expect(safeUrl('//evil.com')).toBeUndefined()
  })
})
