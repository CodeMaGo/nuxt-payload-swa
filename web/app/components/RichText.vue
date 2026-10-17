<script lang="ts">
// Renders a plain string or Payload Lexical rich text as Vue vnodes.
// No v-html: text is always escaped and link URLs are allow-listed.
import { Fragment, h, type VNodeChild } from 'vue'
import { isLexical, safeUrl, type LexicalNode } from '#careers/rich-text'

const FORMAT = { bold: 1, italic: 2, strikethrough: 4, underline: 8, code: 16, subscript: 32, superscript: 64 }
// The page title is the only <h1>; content headings start at <h2>.
const HEADING_TAGS: Record<string, string> = { h1: 'h2', h2: 'h2', h3: 'h3', h4: 'h4', h5: 'h5', h6: 'h6' }

function renderText(node: LexicalNode): VNodeChild {
  const format = typeof node.format === 'number' ? node.format : 0
  let out: VNodeChild = node.text ?? ''
  if (format & FORMAT.code) out = h('code', [out])
  if (format & FORMAT.bold) out = h('strong', [out])
  if (format & FORMAT.italic) out = h('em', [out])
  if (format & FORMAT.underline) out = h('u', [out])
  if (format & FORMAT.strikethrough) out = h('s', [out])
  if (format & FORMAT.subscript) out = h('sub', [out])
  if (format & FORMAT.superscript) out = h('sup', [out])
  return out
}

function renderNodes(nodes: LexicalNode[] = []): VNodeChild[] {
  return nodes.map(renderNode)
}

function renderNode(node: LexicalNode): VNodeChild {
  const children = () => renderNodes(node.children)

  switch (node.type) {
    case 'text':
      return renderText(node)
    case 'linebreak':
      return h('br')
    case 'paragraph':
      return h('p', children())
    case 'heading':
      return h(HEADING_TAGS[node.tag ?? ''] ?? 'h2', children())
    case 'list':
      return h(node.listType === 'number' ? 'ol' : 'ul', children())
    case 'listitem':
      return h('li', children())
    case 'quote':
      return h('blockquote', children())
    case 'horizontalrule':
      return h('hr')
    case 'link':
    case 'autolink': {
      const href = safeUrl(node.fields?.url ?? node.url)
      if (!href) return h(Fragment, children())
      const external = node.fields?.newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {}
      return h('a', { href, ...external }, children())
    }
    default:
      // Unknown or custom nodes (uploads, blocks): render any text they contain.
      return node.children ? h(Fragment, children()) : null
  }
}

function renderRichText(value: unknown): VNodeChild {
  if (typeof value === 'string') {
    const paragraphs = value.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
    return h('div', { class: 'rich-text' }, paragraphs.map((p) => h('p', p)))
  }
  if (isLexical(value)) {
    return h('div', { class: 'rich-text' }, renderNodes(value.root.children))
  }
  return null
}
</script>

<script setup lang="ts">
const props = defineProps<{ value?: unknown }>()
const Content = () => renderRichText(props.value)
</script>

<template>
  <Content />
</template>
