import { useState } from 'react'
import type { Message } from '../../services/api'
import MessageItem from './MessageItem'
import './MessageList.css'

interface MessageListProps {
  messages: Message[]
}

export default function MessageList({ messages }: MessageListProps) {
  const [replyTo, setReplyTo] = useState<Message | null>(null)

  const handleReply = (message: Message) => {
    setReplyTo(message)
  }

  const handleCancelReply = () => {
    setReplyTo(null)
  }

  if (messages.length === 0) {
    return (
      <div className="message-list-empty">
        <div className="empty-state">
          <h3>会話を始めましょう！</h3>
          <p>このルームで最初のメッセージを送信してください。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="message-list">
      {replyTo && (
        <div className="reply-preview">
          <div className="reply-info">
            <span>返信先: {replyTo.user.display_name || replyTo.user.username}</span>
            <button onClick={handleCancelReply}>×</button>
          </div>
          <div className="reply-content">
            {replyTo.content.length > 100 
              ? `${replyTo.content.substring(0, 100)}...`
              : replyTo.content
            }
          </div>
        </div>
      )}
      
      {messages.map((message, index) => {
        const prevMessage = index > 0 ? messages[index - 1] : null
        const isGrouped = prevMessage?.user.id === message.user.id &&
          new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime() < 60000 // 1分以内

        return (
          <MessageItem
            key={message.id}
            message={message}
            isGrouped={isGrouped}
            onReply={handleReply}
          />
        )
      })}
    </div>
  )
}