import { useEffect, useState } from 'react'
import MessageInput from '../components/chat/MessageInput'
import MessageList from '../components/chat/MessageList'
import RoomList from '../components/chat/RoomList'
import { useAuth } from '../contexts/AuthContext'
import { useWebSocket } from '../hooks/useWebSocket'
import type { Message, Room } from '../services/api'
import './ChatPage.css'

export default function ChatPage() {
  const { user } = useAuth()
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false)

  // WebSocketでルーム作成通知を受信した時のコールバック
  const handleRoomCreatedFromWebSocket = (newRoom: Room) => {
    // RoomListコンポーネントで自動更新されるので、ここでは何もしない
    console.log('New room created by another user:', newRoom)
  }

  const {
    connectionStatus,
    sendMessage,
    joinRoom,
    leaveRoom
  } = useWebSocket({
    roomId: selectedRoom?.id,
    onMessage: (message) => {
      console.log('New message received:', message)
      setMessages(prev => [...prev, message])
    },
    onRoomCreated: handleRoomCreatedFromWebSocket,
    onError: (error) => {
      console.error('WebSocket error:', error)
    }
  })

  // 初期ロード
  useEffect(() => {
    // RoomListが内部でルーム一覧を管理するため、ここでは何もしない
  }, [user])

  // ルーム選択時の処理
  const handleRoomSelect = async (room: Room) => {
    if (selectedRoom) {
      await leaveRoom(selectedRoom.id)
    }
    setSelectedRoom(room)
    await joinRoom(room.id)
  }

  // メッセージ送信の処理
  const handleSendMessage = (content: string) => {
    if (selectedRoom) {
      sendMessage(content)
    }
  }

  // ルーム作成成功時のコールバック
  const handleRoomCreated = (newRoom: Room) => {
    // 新しく作成されたルームを選択
    setSelectedRoom(newRoom)
  }

  if (!user) {
    return (
      <div is-="column" align-="center center" style={{ height: '100vh' }}>
        <span is-="badge" variant-="red">認証が必要です</span>
      </div>
    )
  }

  return (
    <div className="chat-layout">
      {/* サイドバー */}
      <div className="sidebar" box-="square" shear-="top">
        <div is-="row" align-="between center" pad-="1 1.5" style={{ borderBottom: '1px solid var(--background2)', backgroundColor: 'var(--background0)' }}>
          <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--foreground0)', fontFamily: 'var(--font-mono)' }}>
            CHANNELS
          </span>
          <button
            onClick={() => setShowCreateRoomModal(true)}
            size-="small"
            variant-="ghost"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '1.8rem',
              height: '1.8rem',
              fontSize: '1rem'
            }}
            title="Create new channel"
          >
            +
          </button>
        </div>

        <RoomList
          selectedRoom={selectedRoom || undefined}
          onRoomSelect={handleRoomSelect}
          onRoomCreated={handleRoomCreated}
          showCreateModal={showCreateRoomModal}
          onCreateModalClose={() => setShowCreateRoomModal(false)}
        />
      </div>

      {/* メインコンテンツ */}
      <div className="main-content">
        {selectedRoom ? (
          <div box-="square" shear-="top" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div is-="column" gap-="0.5" pad-="1" style={{ borderBottom: '1px solid var(--background2)', backgroundColor: 'var(--background0)' }}>
              <div is-="row" align-="between center">
                <div is-="row" align-="center" gap-="0.5">
                  <span style={{ color: 'var(--foreground2)', fontSize: '0.9rem' }}>#</span>
                  <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--foreground0)' }}>
                    {selectedRoom.name}
                  </span>
                  {selectedRoom.is_private && (
                    <span is-="badge" variant-="yellow" size-="small">PRIVATE</span>
                  )}
                </div>
                <div is-="row" align-="center" gap-="1">
                  <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: connectionStatus === 'connected' ? 'var(--green, #22c55e)' :
                      connectionStatus === 'connecting' ? 'var(--yellow, #eab308)' :
                        'var(--red, #ef4444)',
                    display: 'inline-block'
                  }}></span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--foreground2)', fontFamily: 'var(--font-mono)' }}>
                    {connectionStatus === 'connected' ? 'ONLINE' :
                      connectionStatus === 'connecting' ? 'CONNECTING...' : 'OFFLINE'}
                  </span>
                </div>
              </div>

              {(selectedRoom.description || selectedRoom.created_at) && (
                <div is-="column" gap-="0.25">
                  {selectedRoom.description && (
                    <p style={{
                      fontSize: '0.85rem',
                      color: 'var(--foreground1)',
                      margin: 0,
                      fontStyle: 'italic'
                    }}>
                      {selectedRoom.description}
                    </p>
                  )}
                  {selectedRoom.created_at && (
                    <p style={{
                      fontSize: '0.75rem',
                      color: 'var(--foreground2)',
                      margin: 0,
                      fontFamily: 'var(--font-mono)'
                    }}>
                      Created: {new Date(selectedRoom.created_at).toLocaleDateString('ja-JP')}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="chat-area">
              <MessageList messages={messages} />
            </div>

            <div style={{ borderTop: '1px solid var(--background2)', padding: '1rem 1.5rem' }}>
              <MessageInput
                onSendMessage={handleSendMessage}
                disabled={connectionStatus !== 'connected'}
              />
            </div>
          </div>
        ) : (
          <div is-="column" align-="center center" gap-="1" style={{ height: '100%' }}>
            <span is-="badge" variant-="background0">LUNIR CHAT</span>
          </div>
        )}
      </div>
    </div>
  )
}
