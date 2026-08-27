import { useState, useRef, useEffect, useCallback } from 'react'
import { marked } from 'marked'
import TurndownService from 'turndown'
import { MarkdownRenderer } from './MarkdownRenderer'

const turndownService = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  strongDelimiter: '**',
})

function mdToHtml(md: string): string {
  return marked.parse(md) as string
}

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  className?: string
  'aria-label'?: string
  allowLinks?: boolean
  placeholder?: string
}

type Tool = {
  id: string
  title: string
  command: string
  value?: string
  icon: React.ReactNode
}

const svgIconProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

const BoldIcon = () => (
  <svg {...svgIconProps}><path d="M14 12a4 4 0 0 0 0-8H6v8" /><path d="M15 20a4 4 0 0 0 0-8H6v8Z" /></svg>
)
const ItalicIcon = () => (
  <svg {...svgIconProps}><line x1="19" x2="5" y1="4" y2="4" /><line x1="9" x2="15" y1="20" y2="20" /><line x1="14" x2="6" y1="4" y2="20" /></svg>
)
const HeadingIcon = () => (
  <svg {...svgIconProps}><path d="M6 12h12" /><path d="M6 20V4" /><path d="M18 20V4" /></svg>
)
const ListIcon = () => (
  <svg {...svgIconProps}><line x1="8" x2="21" y1="6" y2="6" /><line x1="8" x2="21" y1="12" y2="12" /><line x1="8" x2="21" y1="18" y2="18" /><line x1="3" x2="3.01" y1="6" y2="6" /><line x1="3" x2="3.01" y1="12" y2="12" /><line x1="3" x2="3.01" y1="18" y2="18" /></svg>
)
const ListOrderedIcon = () => (
  <svg {...svgIconProps}><line x1="10" x2="21" y1="6" y2="6" /><line x1="10" x2="21" y1="12" y2="12" /><line x1="10" x2="21" y1="18" y2="18" /><path d="M4 6h1v4" /><path d="M4 10h2" /><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" /></svg>
)
const LinkIcon = () => (
  <svg {...svgIconProps}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
)

const TOOLS: Tool[] = [
  { id: 'bold', title: '粗體', command: 'bold', icon: <BoldIcon /> },
  { id: 'italic', title: '斜體', command: 'italic', icon: <ItalicIcon /> },
  { id: 'heading', title: '標題', command: 'formatBlock', value: 'h3', icon: <HeadingIcon /> },
  { id: 'list', title: '無序列表', command: 'insertUnorderedList', icon: <ListIcon /> },
  { id: 'list-ordered', title: '有序列表', command: 'insertOrderedList', icon: <ListOrderedIcon /> },
  { id: 'link', title: '連結', command: 'createLink', icon: <LinkIcon /> },
]

function execFormat(command: string, value?: string) {
  if (command === 'createLink') {
    const url = window.prompt('輸入連結網址：')
    if (url) document.execCommand(command, false, url)
  } else {
    document.execCommand(command, false, value)
  }
}

export function MarkdownEditor({
  value,
  onChange,
  className,
  allowLinks = true,
  'aria-label': ariaLabel,
  placeholder,
}: MarkdownEditorProps) {
  const [editing, setEditing] = useState(!value.trim())
  const editorRef = useRef<HTMLDivElement>(null)
  const ignoreNextSync = useRef(false)

  useEffect(() => {
    if (!editing || !editorRef.current) return
    if (ignoreNextSync.current) {
      ignoreNextSync.current = false
      return
    }
    const html = value ? mdToHtml(value) : ''
    if (editorRef.current.innerHTML !== html) {
      editorRef.current.innerHTML = html
    }
  }, [value, editing])

  const handleInput = useCallback(() => {
    if (!editorRef.current) return
    const html = editorRef.current.innerHTML
    const markdown = turndownService.turndown(html === '<br>' ? '' : html)
    if (markdown !== value) {
      ignoreNextSync.current = true
      onChange(markdown)
    }
  }, [value, onChange])

  const applyTool = (tool: Tool) => {
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    execFormat(tool.command, tool.value)
    editor.dispatchEvent(new Event('input', { bubbles: true }))
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
  }

  const startEditing = () => {
    setEditing(true)
    requestAnimationFrame(() => {
      if (editorRef.current && value) {
        editorRef.current.innerHTML = mdToHtml(value)
      }
    })
  }

  if (!editing) {
    return (
      <div className={`markdown-editor ${className ?? ''}`}>
        <div
          className="markdown-editor-preview"
          onClick={startEditing}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              startEditing()
            }
          }}
        >
          <MarkdownRenderer content={value} fallback="" allowLinks={allowLinks} />
          <div className="markdown-editor-edit-overlay">
            <button type="button" className="ghost-button" onClick={(e) => { e.stopPropagation(); startEditing() }}>
              編輯
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`markdown-editor ${className ?? ''}`}>
      <div className="markdown-editor-toolbar" role="toolbar" aria-label="格式工具">
        {TOOLS.filter((tool) => allowLinks || tool.command !== 'createLink').map((tool) => (
          <button
            key={tool.id}
            type="button"
            className="markdown-editor-btn"
            title={tool.title}
            onClick={() => applyTool(tool)}
            aria-label={tool.title}
          >
            {tool.icon}
          </button>
        ))}
        <button
          type="button"
          className="markdown-editor-btn markdown-editor-done"
          onClick={() => setEditing(false)}
          aria-label="完成編輯"
        >
          完成
        </button>
      </div>
      <div
        ref={editorRef}
        className="markdown-editor-wysiwyg"
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onPaste={handlePaste}
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel || '編輯器'}
        data-placeholder={placeholder ?? '輸入活動描述…'}
      />
    </div>
  )
}
