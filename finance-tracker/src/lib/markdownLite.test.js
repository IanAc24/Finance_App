import { describe, expect, it } from 'vitest'
import { isSafeHref, parseInline, parseMarkdown } from './markdownLite'

const text = (value) => ({ type: 'text', text: value })

describe('parseInline', () => {
  it('keeps plain text as it is', () => {
    expect(parseInline('hola mundo')).toEqual([text('hola mundo')])
    expect(parseInline('')).toEqual([])
  })

  it('reads bold, italic and code', () => {
    expect(parseInline('a **fuerte** b')).toEqual([
      text('a '),
      { type: 'strong', children: [text('fuerte')] },
      text(' b'),
    ])
    expect(parseInline('a *suave* b')).toEqual([
      text('a '),
      { type: 'em', children: [text('suave')] },
      text(' b'),
    ])
    expect(parseInline('usa `npm test` hoy')).toEqual([
      text('usa '),
      { type: 'code', text: 'npm test' },
      text(' hoy'),
    ])
  })

  it('nests italic inside bold and keeps symbols inside code literal', () => {
    expect(parseInline('**a *b* c**')).toEqual([
      {
        type: 'strong',
        children: [text('a '), { type: 'em', children: [text('b')] }, text(' c')],
      },
    ])
    expect(parseInline('`**no**`')).toEqual([{ type: 'code', text: '**no**' }])
  })

  it('leaves unmatched markers as text', () => {
    expect(parseInline('2 * 3 = 6')).toEqual([text('2 * 3 = 6')])
    expect(parseInline('**sin cierre')).toEqual([text('**sin cierre')])
    expect(parseInline('un `tilde')).toEqual([text('un `tilde')])
  })

  it('leaves placeholders in square brackets as text', () => {
    expect(parseInline('Correo: [CORREO DE CONTACTO].')).toEqual([
      text('Correo: [CORREO DE CONTACTO].'),
    ])
    expect(parseInline('[PENDIENTE: algo] (aparte)')).toEqual([
      text('[PENDIENTE: algo] (aparte)'),
    ])
  })

  it('honors backslash escapes', () => {
    expect(parseInline('\\*no cursiva\\*')).toEqual([text('*no cursiva*')])
    expect(parseInline('a \\ b')).toEqual([text('a \\ b')])
  })

  it('reads links with http, https and mailto', () => {
    expect(parseInline('ver [sitio](https://example.com/a?b=1) ya')).toEqual([
      text('ver '),
      { type: 'link', href: 'https://example.com/a?b=1', children: [text('sitio')] },
      text(' ya'),
    ])
    expect(parseInline('[a](http://x.cr)')[0].href).toBe('http://x.cr')
    expect(parseInline('[correo](mailto:hola@example.com)')[0]).toEqual({
      type: 'link',
      href: 'mailto:hola@example.com',
      children: [text('correo')],
    })
  })

  it('turns links with any other address into plain text', () => {
    for (const href of [
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      ' javascript:alert(1)',
      'data:text/html,<b>x</b>',
      'vbscript:x',
      'file:///etc/passwd',
      '//evil.example',
      '/relativa',
      '#ancla',
      '',
    ]) {
      const result = parseInline(`[clic](${href})`)
      expect(result, href).toEqual([text('clic')])
    }
  })

  it('does not produce a link for a safe address hidden by spaces', () => {
    expect(isSafeHref('https://a.cr')).toBe(true)
    expect(isSafeHref('HTTPS://a.cr')).toBe(true)
    expect(isSafeHref('ftp://a.cr')).toBe(false)
    expect(isSafeHref('xhttps://a.cr')).toBe(false)
  })

  it('keeps HTML as literal text', () => {
    expect(parseInline('<script>alert(1)</script>')).toEqual([
      text('<script>alert(1)</script>'),
    ])
    expect(parseInline('<img src=x onerror=alert(1)>')).toEqual([
      text('<img src=x onerror=alert(1)>'),
    ])
    expect(parseInline('**<b>x</b>**')).toEqual([
      { type: 'strong', children: [text('<b>x</b>')] },
    ])
  })
})

describe('parseMarkdown', () => {
  it('returns nothing for empty or missing input', () => {
    expect(parseMarkdown('')).toEqual([])
    expect(parseMarkdown('\n\n  \n')).toEqual([])
    expect(parseMarkdown(undefined)).toEqual([])
    expect(parseMarkdown(null)).toEqual([])
  })

  it('reads headings by level', () => {
    expect(parseMarkdown('# Uno\n\n## Dos\n\n### Tres')).toEqual([
      { type: 'h1', children: [text('Uno')] },
      { type: 'h2', children: [text('Dos')] },
      { type: 'h3', children: [text('Tres')] },
    ])
  })

  it('does not take a # without a space as a heading', () => {
    expect(parseMarkdown('#etiqueta')).toEqual([{ type: 'p', children: [text('#etiqueta')] }])
  })

  it('joins the lines of a paragraph and splits on blank lines', () => {
    expect(parseMarkdown('uno\ndos\n\ntres')).toEqual([
      { type: 'p', children: [text('uno dos')] },
      { type: 'p', children: [text('tres')] },
    ])
  })

  it('reads CRLF line endings', () => {
    expect(parseMarkdown('# A\r\n\r\ntexto\r\n- x\r\n- y')).toEqual([
      { type: 'h1', children: [text('A')] },
      { type: 'p', children: [text('texto')] },
      { type: 'ul', items: [[text('x')], [text('y')]] },
    ])
  })

  it('reads bullet lists with - and *', () => {
    expect(parseMarkdown('- uno\n- **dos**\n- tres')).toEqual([
      {
        type: 'ul',
        items: [
          [text('uno')],
          [{ type: 'strong', children: [text('dos')] }],
          [text('tres')],
        ],
      },
    ])
    expect(parseMarkdown('* a\n* b')).toEqual([
      { type: 'ul', items: [[text('a')], [text('b')]] },
    ])
  })

  it('reads numbered lists', () => {
    expect(parseMarkdown('1. primero\n2. segundo\n10) tercero')).toEqual([
      {
        type: 'ol',
        items: [[text('primero')], [text('segundo')], [text('tercero')]],
      },
    ])
  })

  it('continues a list item on an indented line', () => {
    expect(parseMarkdown('- uno\n  sigue\n- dos')).toEqual([
      { type: 'ul', items: [[text('uno sigue')], [text('dos')]] },
    ])
  })

  it('ends a list at a blank line and starts another block', () => {
    expect(parseMarkdown('- a\n\ntexto\n\n1. x')).toEqual([
      { type: 'ul', items: [[text('a')]] },
      { type: 'p', children: [text('texto')] },
      { type: 'ol', items: [[text('x')]] },
    ])
  })

  it('stops a paragraph at a list or a heading', () => {
    expect(parseMarkdown('texto\n- a\n## T')).toEqual([
      { type: 'p', children: [text('texto')] },
      { type: 'ul', items: [[text('a')]] },
      { type: 'h2', children: [text('T')] },
    ])
  })

  it('reads horizontal rules', () => {
    expect(parseMarkdown('a\n\n---\n\nb')).toEqual([
      { type: 'p', children: [text('a')] },
      { type: 'hr' },
      { type: 'p', children: [text('b')] },
    ])
    expect(parseMarkdown('***')).toEqual([{ type: 'hr' }])
    expect(parseMarkdown('- - -')).toEqual([{ type: 'hr' }])
  })

  it('reads block quotes', () => {
    expect(parseMarkdown('> BORRADOR: revisar\n> con calma')).toEqual([
      { type: 'quote', children: [text('BORRADOR: revisar con calma')] },
    ])
  })

  it('reads simple pipe tables', () => {
    const table = [
      '| Dato | Para qué | ¿Obligatorio? |',
      '|---|---|---|',
      '| Nombre | Saludarte | Opcional |',
      '| **Monto** | `CRC` | Sí |',
    ].join('\n')
    expect(parseMarkdown(table)).toEqual([
      {
        type: 'table',
        header: [[text('Dato')], [text('Para qué')], [text('¿Obligatorio?')]],
        rows: [
          [[text('Nombre')], [text('Saludarte')], [text('Opcional')]],
          [
            [{ type: 'strong', children: [text('Monto')] }],
            [{ type: 'code', text: 'CRC' }],
            [text('Sí')],
          ],
        ],
      },
    ])
  })

  it('pads short table rows, trims long ones and reads escaped pipes', () => {
    const table = '| A | B |\n|:--|--:|\n| uno |\n| x \\| y | 2 | 3 |'
    const [block] = parseMarkdown(table)
    expect(block.rows[0]).toEqual([[text('uno')], []])
    expect(block.rows[1]).toEqual([[text('x | y')], [text('2')]])
  })

  it('ends a table at a blank line', () => {
    const blocks = parseMarkdown('| A |\n|---|\n| 1 |\n\ntexto')
    expect(blocks.map((b) => b.type)).toEqual(['table', 'p'])
  })

  it('does not take a line with a pipe for a table without a separator', () => {
    expect(parseMarkdown('a | b\nc | d')).toEqual([
      { type: 'p', children: [text('a | b c | d')] },
    ])
  })

  it('keeps HTML in blocks as literal text', () => {
    const blocks = parseMarkdown(
      '# <script>alert(1)</script>\n\n<script>alert(2)</script>\n\n- <img src=x onerror=alert(3)>\n\n| <b>h</b> |\n|---|\n| <i>c</i> |\n\n> <iframe src=x>',
    )
    expect(blocks).toEqual([
      { type: 'h1', children: [text('<script>alert(1)</script>')] },
      { type: 'p', children: [text('<script>alert(2)</script>')] },
      { type: 'ul', items: [[text('<img src=x onerror=alert(3)>')]] },
      { type: 'table', header: [[text('<b>h</b>')]], rows: [[[text('<i>c</i>')]]] },
      { type: 'quote', children: [text('<iframe src=x>')] },
    ])
  })

  it('never returns a block that is not in the documented set', () => {
    const allowed = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'quote', 'ul', 'ol', 'table', 'hr'])
    const source = '# a\n\n## b\n\ntexto **x** [l](javascript:x)\n\n- i\n\n1. n\n\n---\n\n> q\n\n| a |\n|---|\n| b |'
    for (const block of parseMarkdown(source)) expect(allowed.has(block.type)).toBe(true)
  })
})
