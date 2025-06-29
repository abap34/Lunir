import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { InlineMath, BlockMath } from 'react-katex'
import type { Message } from '../../services/api'

interface MessageItemProps {
  message: Message
  isGrouped?: boolean
  onReply?: (message: Message) => void
}

export default function MessageItem({ message, isGrouped = false, onReply }: MessageItemProps) {
  const [showActions, setShowActions] = useState(false)

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const renderContent = () => {
    const hasLatex = message.content.includes('$')
    
    if (hasLatex) {
      // LaTeX処理が必要な場合
      const parts: JSX.Element[] = []
      let remaining = message.content
      let key = 0
      
      // ブロック数式 $$...$$
      const blockLatexRegex = /\$\$([\s\S]*?)\$\$/g
      let match
      let lastIndex = 0
      
      while ((match = blockLatexRegex.exec(remaining)) !== null) {
        // マッチ前のテキスト
        if (match.index > lastIndex) {
          const beforeText = remaining.substring(lastIndex, match.index)
          if (beforeText.trim()) {
            parts.push(
              <ReactMarkdown key={`text-${key++}`} components={getMarkdownComponents()}>
                {beforeText}
              </ReactMarkdown>
            )
          }
        }
        
        // ブロック数式
        try {
          parts.push(<BlockMath key={`block-${key++}`} math={match[1].trim()} />)
        } catch {
          parts.push(<span key={`error-${key++}`}>$$${match[1]}$$</span>)
        }
        
        lastIndex = match.index + match[0].length
      }
      
      // 残りのテキスト（インライン数式処理）
      if (lastIndex < remaining.length) {
        const finalText = remaining.substring(lastIndex)
        
        // インライン数式 $...$
        const inlineLatexRegex = /\$([^$\n]+?)\$/g
        const inlineParts: JSX.Element[] = []
        let inlineLastIndex = 0
        let inlineKey = 0
        
        while ((match = inlineLatexRegex.exec(finalText)) !== null) {
          // マッチ前のテキスト
          if (match.index > inlineLastIndex) {
            const beforeText = finalText.substring(inlineLastIndex, match.index)
            if (beforeText.trim()) {
              inlineParts.push(<span key={`inline-text-${inlineKey++}`}>{beforeText}</span>)
            }
          }
          
          // インライン数式
          try {
            inlineParts.push(<InlineMath key={`inline-${inlineKey++}`} math={match[1].trim()} />)
          } catch {
            inlineParts.push(<span key={`inline-error-${inlineKey++}`}>${match[1]}$</span>)
          }
          
          inlineLastIndex = match.index + match[0].length
        }
        
        // 残りのテキスト
        if (inlineLastIndex < finalText.length) {
          const restText = finalText.substring(inlineLastIndex)
          if (restText.trim()) {
            inlineParts.push(<span key={`rest-${inlineKey++}`}>{restText}</span>)
          }
        }
        
        if (inlineParts.length > 0) {
          parts.push(<div key={`inline-wrapper-${key++}`}>{inlineParts}</div>)
        }
      }
      
      return (
        <div style={{
          color: 'var(--foreground0)',
          lineHeight: '1.5',
          fontSize: '0.9rem'
        }}>
          {parts}
        </div>
      )
    }
    
    // 通常のMarkdownレンダリング
    return (
      <div style={{
        color: 'var(--foreground0)',
        lineHeight: '1.5',
        fontSize: '0.9rem'
      }}>
        <ReactMarkdown components={getMarkdownComponents()}>
          {message.content}
        </ReactMarkdown>
      </div>
    )
  }

  const getMarkdownComponents = () => ({
    code(props: any) {
      const { children, className } = props
      const match = /language-(\w+)/.exec(className || '')
      const language = match ? match[1] : 'text'
      const isInline = !className

      return !isInline ? (
        <SyntaxHighlighter
          style={oneDark}
          language={language}
          PreTag="div"
          customStyle={{
            fontSize: '0.85rem',
            borderRadius: '6px',
            margin: '0.5rem 0'
          }}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      ) : (
        <code style={{
          backgroundColor: 'var(--background2)',
          color: 'var(--foreground0)',
          padding: '0.125rem 0.25rem',
          borderRadius: '3px',
          fontSize: '0.85rem',
          fontFamily: 'var(--font-mono)'
        }}>
          {children}
        </code>
      )
    },
    h1: ({ children }: any) => (
      <h1 style={{ 
        fontSize: '1.5rem', 
        fontWeight: 'bold', 
        marginBottom: '0.5rem',
        color: 'var(--foreground0)'
      }}>
        {children}
      </h1>
    ),
    h2: ({ children }: any) => (
      <h2 style={{ 
        fontSize: '1.25rem', 
        fontWeight: 'bold', 
        marginBottom: '0.25rem',
        color: 'var(--foreground0)'
      }}>
        {children}
      </h2>
    ),
    h3: ({ children }: any) => (
      <h3 style={{ 
        fontSize: '1.1rem', 
        fontWeight: 'bold', 
        marginBottom: '0.25rem',
        color: 'var(--foreground0)'
      }}>
        {children}
      </h3>
    ),
    strong: ({ children }: any) => (
      <strong style={{ color: 'var(--foreground0)', fontWeight: '600' }}>
        {children}
      </strong>
    ),
    em: ({ children }: any) => (
      <em style={{ color: 'var(--foreground1)', fontStyle: 'italic' }}>
        {children}
      </em>
    ),
    blockquote: ({ children }: any) => (
      <blockquote style={{
        borderLeft: '3px solid var(--background3)',
        paddingLeft: '0.75rem',
        margin: '0.5rem 0',
        color: 'var(--foreground2)',
        fontStyle: 'italic'
      }}>
        {children}
      </blockquote>
    ),
    a: ({ children, href }: any) => (
      <a 
        href={href} 
        target="_blank" 
        rel="noopener noreferrer"
        style={{ 
          color: 'var(--blue)',
          textDecoration: 'underline'
        }}
      >
        {children}
      </a>
    ),
    ul: ({ children }: any) => (
      <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
        {children}
      </ul>
    ),
    ol: ({ children }: any) => (
      <ol style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
        {children}
      </ol>
    ),
    li: ({ children }: any) => (
      <li style={{ marginBottom: '0.25rem', color: 'var(--foreground0)' }}>
        {children}
      </li>
    )
  })

  return (
    <div
      is-="column"
      gap-="0.25"
      style={{
        padding: isGrouped ? '0.25rem 0' : '0.75rem 0',
        marginLeft: isGrouped ? '2rem' : '0',
        position: 'relative'
      }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {!isGrouped && (
        <div is-="row" align-="start" gap-="0.5">
          <img
            src={message.user.avatar_url || '/default-avatar.png'}
            alt={message.user.username}
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              marginRight: '0.5rem'
            }}
          />
          <div is-="column" gap-="0.125" style={{ flex: 1 }}>
            <div is-="row" align-="center" gap-="0.5">
              <span style={{
                fontWeight: '600',
                color: 'var(--foreground0)',
                fontSize: '0.9rem'
              }}>
                {message.user.display_name || message.user.username}
              </span>
              <span style={{
                fontSize: '0.75rem',
                color: 'var(--foreground2)'
              }}>
                {formatTime(message.created_at)}
              </span>
            </div>

            {showActions && (
              <div style={{
                position: 'absolute',
                top: '0.5rem',
                right: '0.5rem'
              }}>
                <button
                  onClick={() => onReply?.(message)}
                  size-="xsmall"
                  variant-="ghost"
                  title="Reply"
                >
                  ↩
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ marginLeft: isGrouped ? 0 : '2rem' }}>
        {message.parent_id && (
          <div style={{
            fontSize: '0.75rem',
            color: 'var(--blue)',
            marginBottom: '0.25rem'
          }}>
            Reply
          </div>
        )}

        {renderContent()}

        {isGrouped && (
          <span style={{
            fontSize: '0.7rem',
            color: 'var(--foreground2)',
            marginLeft: '0.5rem'
          }}>
            {formatTime(message.created_at)}
          </span>
        )}
      </div>

      {(message.has_latex || message.has_code) && (
        <div is-="row" gap-="0.25" style={{ marginLeft: isGrouped ? 0 : '2rem', marginTop: '0.25rem' }}>
          {message.has_latex && (
            <span is-="badge" size-="small" variant-="background2">
              LaTeX
            </span>
          )}
          {message.has_code && (
            <span is-="badge" size-="small" variant-="background2">
              Code
            </span>
          )}
        </div>
      )}
    </div>
  )
}