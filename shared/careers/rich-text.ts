/**
 * Helpers for Payload rich text (Lexical JSON). The description field may be a
 * plain string or a Lexical editor state: { root: { children: [...] } }.
 */

export interface LexicalNode {
  type: string
  text?: string
  format?: number | string
  tag?: string
  listType?: 'bullet' | 'number' | 'check'
  url?: string
  fields?: { url?: string; newTab?: boolean; linkType?: string }
  children?: LexicalNode[]
  [key: string]: unknown
}

export function isLexical(value: unknown): value is { root: LexicalNode } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'root' in value &&
    Array.isArray((value as { root?: LexicalNode }).root?.children)
  )
}

const BLOCK_TYPES = new Set(['paragraph', 'heading', 'listitem', 'quote'])

function collectText(node: LexicalNode, out: string[]) {
  if (node.type === 'text' && node.text) out.push(node.text)
  if (node.type === 'linebreak') out.push(' ')
  node.children?.forEach((child) => collectText(child, out))
  if (BLOCK_TYPES.has(node.type)) out.push(' ')
}

/** Flattens a string or Lexical value to plain text, optionally truncated on a word boundary. */
export function toPlainText(value: unknown, maxLength?: number): string {
  let text = ''
  if (typeof value === 'string') {
    text = value
  } else if (isLexical(value)) {
    const parts: string[] = []
    collectText(value.root, parts)
    text = parts.join('')
  }

  text = text.replace(/\s+/g, ' ').trim()
  if (!maxLength || text.length <= maxLength) return text

  const cut = text.slice(0, maxLength - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

/** Short summary for cards and meta tags: the first paragraph of rich text. */
export function toExcerpt(value: unknown, maxLength: number): string {
  if (isLexical(value)) {
    const first = value.root.children?.find((node) => node.type === 'paragraph')
    if (first) return toPlainText({ root: { type: 'root', children: [first] } }, maxLength)
  }
  return toPlainText(value, maxLength)
}

/** Allows only http(s), mailto, tel and site-relative URLs (blocks javascript: etc.). */
export function safeUrl(url: unknown): string | undefined {
  if (typeof url !== 'string') return undefined
  const trimmed = url.trim()
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed
  if (trimmed.startsWith('#')) return trimmed
  return undefined
}
