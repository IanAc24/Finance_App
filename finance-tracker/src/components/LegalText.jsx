import { Fragment, useMemo } from 'react'
import { useSettings } from '../context/useSettings'
import { legalSource } from '../lib/legalDocs'
import { parseMarkdown } from '../lib/markdownLite'

// Draws the inline parts of a block (text, bold, italic, code, links)
function Inline({ nodes }) {
  return nodes.map((node, index) => {
    if (node.type === 'strong') {
      return (
        <strong key={index}>
          <Inline nodes={node.children} />
        </strong>
      )
    }
    if (node.type === 'em') {
      return (
        <em key={index}>
          <Inline nodes={node.children} />
        </em>
      )
    }
    if (node.type === 'code') return <code key={index}>{node.text}</code>
    if (node.type === 'link') {
      const external = !node.href.toLowerCase().startsWith('mailto:')
      return (
        <a
          key={index}
          href={node.href}
          {...(external && { target: '_blank', rel: 'noopener noreferrer' })}
        >
          <Inline nodes={node.children} />
        </a>
      )
    }
    return <Fragment key={index}>{node.text}</Fragment>
  })
}

function Block({ block, tableLabel }) {
  switch (block.type) {
    case 'p':
      return (
        <p>
          <Inline nodes={block.children} />
        </p>
      )
    case 'quote':
      return (
        <blockquote>
          <Inline nodes={block.children} />
        </blockquote>
      )
    case 'hr':
      return <hr />
    case 'ul':
    case 'ol': {
      const List = block.type
      return (
        <List>
          {block.items.map((item, index) => (
            <li key={index}>
              <Inline nodes={item} />
            </li>
          ))}
        </List>
      )
    }
    case 'table':
      return (
        <div className="legal-table" tabIndex={0} role="region" aria-label={tableLabel}>
          <table>
            <thead>
              <tr>
                {block.header.map((cell, index) => (
                  <th key={index} scope="col">
                    <Inline nodes={cell} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, index) => (
                    <td key={index}>
                      <Inline nodes={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    default: {
      // h1 to h6
      const Heading = block.type
      return (
        <Heading>
          <Inline nodes={block.children} />
        </Heading>
      )
    }
  }
}

// One legal document ('privacy', 'terms', 'refunds' or 'cookies') in the
// current language, drawn from its Markdown without any raw HTML
export default function LegalText({ doc }) {
  const { lang, t } = useSettings()
  const blocks = useMemo(() => parseMarkdown(legalSource(doc, lang)), [doc, lang])

  return (
    <article className="legal-text card">
      {blocks.map((block, index) => (
        <Block key={index} block={block} tableLabel={t('legalTable')} />
      ))}
    </article>
  )
}
