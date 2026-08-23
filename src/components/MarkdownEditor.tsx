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
}

type Tool = {
  label: string
  title: string
  command: string
  value?: string
}

const TOOLS: Tool[] = [
  { label: 'B', title: '粗體', command: 'bold' },
  { label: 'I', title: '斜體', command: 'italic' },
  { label: 'H', title: '標題', command: 'formatBlock', value: 'h3' },
  { label: '•', title: '無序列表', command: 'insertUnorderedList' },
  { label: '1.', title: '有序列表', command: 'insertOrderedList' },
  { label: '🔗', title: '連結', command: 'createLink' },
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
            key={tool.label}
            type="button"
            className="markdown-editor-btn"
            title={tool.title}
            onClick={() => applyTool(tool)}
            aria-label={tool.title}
          >
            {tool.label}
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
        aria-label="活動描述編輯器"
        data-placeholder="輸入活動描述…"
      />
    </div>
  )
}
