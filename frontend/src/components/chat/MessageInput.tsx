import type { KeyboardEvent } from 'react'
import { useRef, useState } from 'react'

interface MessageInputProps {
  onSendMessage: (content: string) => void
  disabled?: boolean
  placeholder?: string
}

export default function MessageInput({ onSendMessage, disabled = false, placeholder = "Markdownでメッセージを入力..." }: MessageInputProps) {
  const [message, setMessage] = useState('')
  const [isShiftPressed, setIsShiftPressed] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = () => {
    const trimmedMessage = message.trim()
    if (!trimmedMessage || disabled) return

    onSendMessage(trimmedMessage)
    setMessage('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Shift') {
      setIsShiftPressed(true)
      return
    }

    if (e.key === 'Enter' && isShiftPressed) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleKeyUp = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Shift') {
      setIsShiftPressed(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)
  }

  return (
    <div is-="column" gap-="0.5" style={{ width: '100%' }}>
      <div is-="row" align-="end" gap-="0.5" style={{ width: '100%' }}>
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          placeholder={placeholder}
          disabled={disabled}
          style={{
            flex: 1,
            width: '100%',
            minWidth: '400px',
            minHeight: '3rem',
            maxHeight: '200px',
            padding: '1rem',
            border: '1px solid var(--background3)',
            borderRadius: '8px',
            backgroundColor: 'var(--background1)',
            color: 'var(--foreground0)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.9rem',
            resize: 'none',
            outline: 'none',
            lineHeight: '1.4'
          }}
          rows={1}
        />
        
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || !message.trim()}
          size-="small"
          variant-="primary"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '3.5rem',
            height: '3rem',
            borderRadius: '8px'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22,2 15,22 11,13 2,9"></polygon>
          </svg>
        </button>
      </div>

      <div is-="row" align-="center between" style={{ fontSize: '0.75rem', color: 'var(--foreground2)' }}>
        <span>Shift + Enter to send, Enter for new line • Markdown & LaTeX supported</span>
      </div>
    </div>
  )
}