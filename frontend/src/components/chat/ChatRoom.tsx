import { useState, useEffect, useRef } from 'react'
import { api } from '../../services/api'
import { useWebSocket } from '../../hooks/useWebSocket'
import type { Message, Room } from '../../services/api'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import './ChatRoom.css'

interface ChatRoomProps {
  room: Room
}

export default function ChatRoom({ room }: ChatRoomProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [onlineUsers, setOnlineUsers] = useState<any[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { isConnected, connectionStatus, sendMessage } = useWebSocket({
    roomId: room.id,
    onMessage: (message: Message) => {
      setMessages(prev => [...prev, message])
    },
    onUserJoined: (user: any) => {
      setOnlineUsers(prev => {
        const exists = prev.find(u => u.id === user.id)
        return exists ? prev : [...prev, user]
      })
    },
    onUserLeft: (user: any) => {
      setOnlineUsers(prev => prev.filter(u => u.id !== user.id))
    },
    onError: (errorMessage: string) => {
      console.error('WebSocket error:', errorMessage)
      setError(errorMessage)
    }
  })

  // メッセージ履歴を読み込み
  useEffect(() => {
    const loadMessages = async () => {
      try {
        setLoading(true)
        const roomMessages = await api.getRoomMessages(room.id)
        setMessages(roomMessages)
      } catch (err) {
        console.error('Failed to load messages:', err)
        setError('メッセージの読み込みに失敗しました')
      } finally {
        setLoading(false)
      }
    }

    loadMessages()
  }, [room.id])

  // 新しいメッセージが来たら自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendMessage = (content: string, messageType: string = 'text') => {
    if (!isConnected) {
      setError('接続が切断されています')
      return
    }

    const success = sendMessage(content, messageType)
    if (!success) {
      setError('メッセージの送信に失敗しました')
    }
  }

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connecting':
        return '接続中...'
      case 'connected':
        return '接続済み'
      case 'disconnected':
        return '切断済み'
      default:
        return '不明'
    }
  }

  const getConnectionStatusClass = () => {
    switch (connectionStatus) {
      case 'connecting':
        return 'connecting'
      case 'connected':
        return 'connected'
      case 'disconnected':
        return 'disconnected'
      default:
        return 'unknown'
    }
  }

  return (
    <div className="chat-room">
      <div className="chat-room-header">
        <div className="room-info">
          <h2>{room.name}</h2>
          {room.description && <p className="room-description">{room.description}</p>}
        </div>
        <div className="connection-status">
          <span className={`status-indicator ${getConnectionStatusClass()}`}>
            {getConnectionStatusText()}
          </span>
          <span className="member-count">
            {room.member_count} メンバー
          </span>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className="chat-room-content">
        <div className="messages-section">
          {loading ? (
            <div className="loading">
              <div className="spinner"></div>
              <span>メッセージを読み込み中...</span>
            </div>
          ) : (
            <>
              <MessageList messages={messages} />
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        <div className="input-section">
          <MessageInput 
            onSendMessage={handleSendMessage}
            disabled={!isConnected}
            placeholder={
              isConnected 
                ? "メッセージを入力..." 
                : "接続中..."
            }
          />
        </div>
      </div>

      {onlineUsers.length > 0 && (
        <div className="online-users">
          <h4>オンライン ({onlineUsers.length})</h4>
          <ul>
            {onlineUsers.map(user => (
              <li key={user.id} className="online-user">
                <img 
                  src={user.avatar_url || '/default-avatar.png'} 
                  alt={user.username}
                  className="user-avatar-small"
                />
                <span>{user.display_name || user.username}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}