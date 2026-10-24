import { describe, expect, it } from 'vitest'
import { LEGAL_DOCS } from './legal'
import { legalSource } from './legalDocs'
import { parseMarkdown } from './markdownLite'

// Every inline node of a block, flattened
function inlines(block) {
  const lists = [
    block.children,
    ...(block.items ?? []),
    block.header,
    ...(block.rows ?? []).flat(),
  ].filter(Boolean)
  const out = []
  const walk = (nodes) => {
    for (const node of nodes) {
      out.push(node)
      if (node.children) walk(node.children)
    }
  }
  lists.forEach(walk)
  return out
}

describe('legal documents', () => {
  for (const { id } of LEGAL_DOCS) {
    for (const lang of ['es', 'en']) {
      it(`${id} (${lang}) is bundled and starts with a title`, () => {
        const source = legalSource(id, lang)
        expect(source.length).toBeGreaterThan(200)
        const blocks = parseMarkdown(source)
        expect(blocks[0].type).toBe('h1')
        expect(blocks.some((b) => b.type === 'h2')).toBe(true)
      })

      it(`${id} (${lang}) has only safe links`, () => {
        const links = parseMarkdown(legalSource(id, lang))
          .flatMap(inlines)
          .filter((node) => node.type === 'link')
        for (const link of links) expect(link.href).toMatch(/^(https?:|mailto:)/)
      })
    }
  }

  it('the Spanish and English privacy policies have the same sections', () => {
    const headings = (lang) =>
      parseMarkdown(legalSource('privacy', lang))
        .filter((b) => b.type === 'h2')
        .map((b) => b.children[0].text.match(/^\d+/)?.[0])
    expect(headings('en')).toEqual(headings('es'))
  })

  it('gives an empty text for an unknown document or language', () => {
    expect(legalSource('nope', 'es')).toBe('')
    expect(legalSource('privacy', 'fr')).toBe('')
  })
})
