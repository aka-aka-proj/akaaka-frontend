import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import type { ReactNode } from 'react'

interface MarkdownRendererProps {
  content: string | null
  fallback?: ReactNode
  allowLinks?: boolean
}

const components: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
}

const announcementAllowedElements = [
  'p', 'br', 'strong', 'em', 'del', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote', 'code', 'pre',
]

export function MarkdownRenderer({ content, fallback, allowLinks = true }: MarkdownRendererProps) {
  if (!content) {
    return <div className="markdown-body">{fallback}</div>
  }

  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={allowLinks ? components : undefined}
        allowedElements={allowLinks ? undefined : announcementAllowedElements}
        unwrapDisallowed={!allowLinks}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
