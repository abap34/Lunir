import { useCallback, useEffect, useRef, useState } from 'react'
import type { Message } from '../services/api'

interface WebSocketMessage {
  type: string
  payload: any
  timestamp: string
  message_id?: string
}

interface UseWebSocketOptions {
  roomId?: number
  onMessage?: (message: Message) => void
  onUserJoined?: (user: any) => void
  onUserLeft?: (user: any) => void
  onError?: (error: string) => void
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef(0)
  const isConnectingRef = useRef(false) // 接続試行中フラグを追加
  const optionsRef = useRef(options)

  // optionsを最新に保つ
  optionsRef.current = options

  const connect = useCallback((roomId: number) => {
    // 既に接続中または接続済みの場合は処理をスキップ
    if (isConnectingRef.current || wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    // 接続中であることをマーク
    isConnectingRef.current = true

    const token = localStorage.getItem('token')

    if (!token) {
      optionsRef.current.onError?.('No authentication token available')
      isConnectingRef.current = false
      return
    }

    setConnectionStatus('connecting')

    const wsUrl = `ws://localhost:8000/ws/chat?token=${encodeURIComponent(token)}&room_id=${roomId}`
    console.log('🔌 Connecting to WebSocket:', wsUrl)
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      console.log('✅ WebSocket connected successfully')
      setIsConnected(true)
      setConnectionStatus('connected')
      reconnectAttempts.current = 0
      isConnectingRef.current = false
    }

    ws.onmessage = (event) => {
      try {
        const data: WebSocketMessage = JSON.parse(event.data)

        switch (data.type) {
          case 'message_received':
            optionsRef.current.onMessage?.(data.payload)
            break
          case 'user_joined':
            optionsRef.current.onUserJoined?.(data.payload.user)
            break
          case 'user_left':
            optionsRef.current.onUserLeft?.(data.payload.user)
            break
          case 'error':
            optionsRef.current.onError?.(data.payload.message)
            break
          case 'connected':
            console.log('WebSocket authenticated successfully')
            break
          default:
            console.log('Unknown message type:', data.type)
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error)
      }
    }

    ws.onclose = (event) => {
      console.log('❌ WebSocket disconnected:', event.code, event.reason)
      console.log('WebSocket close event details:', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
        type: event.type
      })
      setIsConnected(false)
      setConnectionStatus('disconnected')
      isConnectingRef.current = false

      // エラー詳細をユーザーに通知
      if (event.code === 4001) {
        optionsRef.current.onError?.('認証に失敗しました')
      } else if (event.code === 4003) {
        optionsRef.current.onError?.('このルームのメンバーではありません')
      } else if (event.code === 1006) {
        optionsRef.current.onError?.('WebSocket接続が異常終了しました。サーバーとの接続を確認してください。')
      } else if (event.code !== 1000) {
        optionsRef.current.onError?.(`WebSocket接続が切断されました (コード: ${event.code})`)
      }      // 自動再接続 (正常終了以外で、認証エラーでない場合のみ)
      if (event.code !== 1000 && event.code !== 4001 && event.code !== 4003 && reconnectAttempts.current < 3) {
        const delay = Math.min(2000 * Math.pow(2, reconnectAttempts.current), 8000)
        reconnectAttempts.current++

        console.log(`Attempting to reconnect in ${delay}ms (${reconnectAttempts.current}/3)...`)

        reconnectTimeoutRef.current = setTimeout(() => {
          if (!isConnectingRef.current) {
            connect(roomId)
          }
        }, delay)
      } else if (reconnectAttempts.current >= 3) {
        optionsRef.current.onError?.('接続に失敗しました。ページを再読み込みしてください。')
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      optionsRef.current.onError?.('WebSocket connection error')
      isConnectingRef.current = false
    }

    wsRef.current = ws
  }, [])

  const disconnect = useCallback(() => {
    // 再接続タイマーをクリア
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    // 接続中フラグをリセット
    isConnectingRef.current = false

    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected')
      wsRef.current = null
    }

    setIsConnected(false)
    setConnectionStatus('disconnected')
    reconnectAttempts.current = 0
  }, [])

  const sendMessage = useCallback((content: string, messageType: string = 'text', parentId?: number) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      optionsRef.current.onError?.('WebSocket is not connected')
      return false
    }

    const message = {
      type: 'send_message',
      payload: {
        content,
        message_type: messageType,
        parent_id: parentId
      },
      timestamp: new Date().toISOString()
    }

    try {
      wsRef.current.send(JSON.stringify(message))
      return true
    } catch (error) {
      console.error('Error sending message:', error)
      optionsRef.current.onError?.('Failed to send message')
      return false
    }
  }, [])

  const joinRoom = useCallback((roomId: number) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      optionsRef.current.onError?.('WebSocket is not connected')
      return false
    }

    const message = {
      type: 'join_room',
      payload: { room_id: roomId },
      timestamp: new Date().toISOString()
    }

    try {
      wsRef.current.send(JSON.stringify(message))
      return true
    } catch (error) {
      console.error('Error joining room:', error)
      optionsRef.current.onError?.('Failed to join room')
      return false
    }
  }, [])

  const leaveRoom = useCallback((roomId: number) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return false
    }

    const message = {
      type: 'leave_room',
      payload: { room_id: roomId },
      timestamp: new Date().toISOString()
    }

    try {
      wsRef.current.send(JSON.stringify(message))
      return true
    } catch (error) {
      console.error('Error leaving room:', error)
      return false
    }
  }, [])

  // 自動接続
  useEffect(() => {
    if (options.roomId) {
      // クリーンアップしてから接続
      disconnect()
      const timer = setTimeout(() => {
        connect(options.roomId!)
      }, 100)

      return () => {
        clearTimeout(timer)
        disconnect()
      }
    }

    return () => {
      disconnect()
    }
  }, [options.roomId, connect, disconnect])

  return {
    isConnected,
    connectionStatus,
    connect,
    disconnect,
    sendMessage,
    joinRoom,
    leaveRoom
  }
}