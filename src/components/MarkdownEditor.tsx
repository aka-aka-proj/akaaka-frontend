import { useState, useRef, type TextareaHTMLAttributes } from 'react'
import { MarkdownRenderer } from './MarkdownRenderer'

interface MarkdownEditorProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  value: string
  onChange: (value: string) => void
}

type Snippet = {
  prefix: string
  suffix: string
  placeholder: string
}

type Tool = {
  label: string
  title: string
  snippet: Snippet
}

const TOOLS: Tool[] = [
  {
    label: 'B',
    title: '粗體',
    snippet: { prefix: '**', suffix: '**', placeholder: '粗體文字' },
  },
  {
    label: 'I',
    title: '斜體',
    snippet: { prefix: '*', suffix: '*', placeholder: '斜體文字' },
  },
  {
    label: 'H',
    title: 'Heading',
    snippet: { prefix: '## ', suffix: '', placeholder: '標題' },
  },
  {
    label: '•',
    title: '無序列表',
    snippet: { prefix: '- ', suffix: '', placeholder: '列表項目' },
  },
  {
    label: '1.',
    title: '有序列表',
    snippet: { prefix: '1. ', suffix: '', placeholder: '列表項目' },
  },
  {
    label: '🔗',
    title: '連結',
    snippet: { prefix: '[', suffix: '](url)', placeholder: '連結文字' },
  },
]

export function MarkdownEditor({
  value,
  onChange,
  className,
  ...textareaProps
}: MarkdownEditorProps) {
  const [editing, setEditing] = useState(!value.trim())
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const applyTool = (tool: Tool) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = value.slice(start, end)
    const before = value.slice(0, start)
    const after = value.slice(end)

    const { prefix, suffix, placeholder } = tool.snippet

    let newValue: string
    let cursorPos: number

    if (selectedText) {
      newValue = `${before}${prefix}${selectedText}${suffix}${after}`
      cursorPos = start + prefix.length + selectedText.length + suffix.length
    } else {
      if (tool.snippet.suffix) {
        newValue = `${before}${prefix}${placeholder}${suffix}${after}`
        cursorPos = start + prefix.length
      } else {
        newValue = `${before}${prefix}${placeholder}\n${after}`
        cursorPos = start + prefix.length + placeholder.length + 1
      }
    }

    onChange(newValue)

    requestAnimationFrame(() => {
      textarea.focus()
      if (tool.snippet.suffix && !selectedText) {
        const prefixLen = prefix.length
        textarea.setSelectionRange(start + prefixLen, start + prefixLen + placeholder.length)
      } else if (selectedText) {
        textarea.setSelectionRange(cursorPos, cursorPos)
      } else {
        textarea.setSelectionRange(cursorPos, cursorPos)
      }
    })
  }

  const startEditing = () => {
    setEditing(true)
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
    })
  }

  const doneEditing = () => {
    setEditing(false)
  }

  return (
    <div className={`markdown-editor ${className ?? ''}`}>
      {editing ? (
        <>
          <div className="markdown-editor-toolbar" role="toolbar" aria-label="Markdown 編輯工具">
            {TOOLS.map((tool) => (
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
            <span className="markdown-editor-hint">Markdown</span>
          </div>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="markdown-editor-textarea"
            {...textareaProps}
          />
          <div className="markdown-editor-actions">
            <button type="button" className="text-button" onClick={doneEditing}>
              完成
            </button>
          </div>
        </>
      ) : (
        <div className="markdown-editor-preview" onClick={startEditing} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEditing() } }}>
          <MarkdownRenderer content={value} fallback="" />
          <div className="markdown-editor-edit-overlay">
            <button type="button" className="ghost-button" onClick={(e) => { e.stopPropagation(); startEditing() }}>
              編輯
            </button>
          </div>
        </div>
      )}
    </div>
  )
}