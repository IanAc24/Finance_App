// A tiny, safe Markdown reader for the legal texts. It turns the subset the
// documents use into plain data; nothing here produces HTML, so text such as
// <script> stays literal text when React renders it.
//
// Blocks:  { type: 'h1'..'h6' | 'p' | 'quote', children: Inline[] }
//          { type: 'ul' | 'ol', items: Inline[][] }
//          { type: 'table', header: Inline[][], rows: Inline[][][] }
//          { type: 'hr' }
// Inline:  { type: 'text' | 'code', text }
//          { type: 'strong' | 'em', children: Inline[] }
//          { type: 'link', href, children: Inline[] }
// Links are kept only for http, https and mailto; any other address (such as
// javascript:) leaves just the link text.

const SAFE_LINK = /^(https?:\/\/|mailto:)/i
const ESCAPABLE = /[\\`*_{}[\]()#+\-.!|>~<]/

export function isSafeHref(href) {
  return SAFE_LINK.test(href)
}

// The ')' that closes a link address starting at `from`; parentheses inside
// the address must be balanced. -1 when it never closes.
function closingParen(text, from) {
  let depth = 1
  for (let i = from; i < text.length; i++) {
    if (text[i] === '(') depth++
    else if (text[i] === ')' && --depth === 0) return i
  }
  return -1
}

export function parseInline(text) {
  const out = []
  let buffer = ''
  const flush = () => {
    if (buffer) out.push({ type: 'text', text: buffer })
    buffer = ''
  }
  let i = 0
  while (i < text.length) {
    const ch = text[i]

    // a backslash makes the next symbol literal
    if (ch === '\\' && i + 1 < text.length && ESCAPABLE.test(text[i + 1])) {
      buffer += text[i + 1]
      i += 2
      continue
    }

    if (ch === '`') {
      const end = text.indexOf('`', i + 1)
      if (end > i + 1) {
        flush()
        out.push({ type: 'code', text: text.slice(i + 1, end) })
        i = end + 1
        continue
      }
    }

    if (ch === '*' && text[i + 1] === '*') {
      const end = text.indexOf('**', i + 2)
      if (end > i + 2) {
        flush()
        out.push({ type: 'strong', children: parseInline(text.slice(i + 2, end)) })
        i = end + 2
        continue
      }
    }

    if (ch === '*' && text[i + 1] !== '*' && text[i + 1] !== ' ') {
      const end = text.indexOf('*', i + 1)
      if (end > i + 1 && text[end - 1] !== ' ' && text[end + 1] !== '*') {
        flush()
        out.push({ type: 'em', children: parseInline(text.slice(i + 1, end)) })
        i = end + 1
        continue
      }
    }

    if (ch === '[') {
      const close = text.indexOf(']', i + 1)
      if (close > i && text[close + 1] === '(') {
        const paren = closingParen(text, close + 2)
        if (paren > close) {
          const children = parseInline(text.slice(i + 1, close))
          const href = text.slice(close + 2, paren).trim()
          flush()
          if (isSafeHref(href)) out.push({ type: 'link', href, children })
          else out.push(...children)
          i = paren + 1
          continue
        }
      }
    }

    buffer += ch
    i++
  }
  flush()
  return out
}

const HEADING = /^(#{1,6})\s+(.+?)\s*$/
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/
const BULLET = /^\s*[-*+]\s+(.*)$/
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/
const QUOTE = /^\s*>\s?(.*)$/
const TABLE_SEPARATOR = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/

function isTableStart(lines, i) {
  return (
    lines[i].includes('|') &&
    i + 1 < lines.length &&
    lines[i + 1].includes('|') &&
    TABLE_SEPARATOR.test(lines[i + 1])
  )
}

function splitRow(line) {
  let row = line.trim()
  if (row.startsWith('|')) row = row.slice(1)
  if (row.endsWith('|') && !row.endsWith('\\|')) row = row.slice(0, -1)
  return row.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'))
}

function startsBlock(lines, i) {
  const line = lines[i]
  return (
    HEADING.test(line) ||
    RULE.test(line) ||
    BULLET.test(line) ||
    NUMBERED.test(line) ||
    QUOTE.test(line) ||
    isTableStart(lines, i)
  )
}

export function parseMarkdown(source) {
  const lines = String(source ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
  const blocks = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }

    const heading = HEADING.exec(line)
    if (heading) {
      blocks.push({
        type: `h${heading[1].length}`,
        children: parseInline(heading[2]),
      })
      i++
      continue
    }

    if (RULE.test(line)) {
      blocks.push({ type: 'hr' })
      i++
      continue
    }

    if (isTableStart(lines, i)) {
      const header = splitRow(line)
      const width = header.length
      const rows = []
      i += 2
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
        const cells = splitRow(lines[i])
        // every row has as many cells as the header
        while (cells.length < width) cells.push('')
        rows.push(cells.slice(0, width).map(parseInline))
        i++
      }
      blocks.push({ type: 'table', header: header.map(parseInline), rows })
      continue
    }

    if (QUOTE.test(line)) {
      const parts = []
      while (i < lines.length && QUOTE.test(lines[i])) {
        parts.push(QUOTE.exec(lines[i])[1].trim())
        i++
      }
      blocks.push({ type: 'quote', children: parseInline(parts.join(' ').trim()) })
      continue
    }

    const kind = BULLET.test(line) ? 'ul' : NUMBERED.test(line) ? 'ol' : null
    if (kind) {
      const marker = kind === 'ul' ? BULLET : NUMBERED
      const items = []
      while (i < lines.length && lines[i].trim()) {
        const item = marker.exec(lines[i])
        if (item) {
          items.push(item[1].trim())
          i++
        } else if (/^\s+\S/.test(lines[i]) && !startsBlock(lines, i)) {
          // an indented line continues the previous item
          items[items.length - 1] += ` ${lines[i].trim()}`
          i++
        } else {
          break
        }
      }
      blocks.push({ type: kind, items: items.map(parseInline) })
      continue
    }

    const parts = [line.trim()]
    i++
    while (i < lines.length && lines[i].trim() && !startsBlock(lines, i)) {
      parts.push(lines[i].trim())
      i++
    }
    blocks.push({ type: 'p', children: parseInline(parts.join(' ')) })
  }

  return blocks
}
