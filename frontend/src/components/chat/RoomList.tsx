import { useEffect, useState } from 'react'
import type { Room } from '../../services/api'
import { api } from '../../services/api'
import CreateRoomModal from './CreateRoomModal'

interface RoomListProps {
  selectedRoom?: Room
  onRoomSelect: (room: Room) => void
}

export default function RoomList({ selectedRoom, onRoomSelect }: RoomListProps) {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const loadRooms = async () => {
    try {
      setLoading(true)
      const userRooms = await api.getRooms()

      // デフォルトルームが存在しない場合は作成
      const allRooms = [...userRooms]
      const generalExists = userRooms.some(room => room.name === 'general')
      const randomExists = userRooms.some(room => room.name === 'random')

      if (!generalExists) {
        try {
          const generalRoom = await api.createRoom('general', 'General discussion channel', false)
          allRooms.unshift(generalRoom)
        } catch (err) {
          console.log('General room already exists or creation failed:', err)
        }
      }

      if (!randomExists) {
        try {
          const randomRoom = await api.createRoom('random', 'Random chat and off-topic discussions', false)
          if (!generalExists) {
            allRooms.splice(1, 0, randomRoom) // general の後に挿入
          } else {
            allRooms.unshift(randomRoom)
          }
        } catch (err) {
          console.log('Random room already exists or creation failed:', err)
        }
      }

      setRooms(allRooms)
      setError(null)
    } catch (err) {
      console.error('Failed to load rooms:', err)
      setError('Failed to load rooms')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRooms()
  }, [])

  const handleCreateRoom = async (name: string, description: string, isPrivate: boolean) => {
    try {
      const newRoom = await api.createRoom(name, description, isPrivate)
      setRooms(prev => [newRoom, ...prev])
      setShowCreateModal(false)
      onRoomSelect(newRoom)
    } catch (err) {
      console.error('Failed to create room:', err)
      throw new Error('Failed to create room')
    }
  }

  if (loading) {
    return (
      <div is-="column" align-="center center" style={{ padding: '2rem' }}>
        <span style={{ color: 'var(--foreground2)' }}>Loading...</span>
      </div>
    )
  }

  return (
    <div is-="column" style={{ height: '100%', overflow: 'hidden' }}>
      {error && (
        <div style={{ padding: '1rem', backgroundColor: 'var(--red, #ef4444)', color: 'var(--background0)' }}>
          <span style={{ fontSize: '0.8rem' }}>Error: {error}</span>
          <button
            onClick={loadRooms}
            style={{ marginLeft: '0.5rem', fontSize: '0.8rem', textDecoration: 'underline' }}
          >
            retry
          </button>
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>
        {rooms.length === 0 ? (
          <div is-="column" align-="center center" gap-="1">
            <span style={{ color: 'var(--foreground2)', fontSize: '0.9rem' }}>No rooms found</span>
            <button
              size-="small"
              variant-="background2"
              onClick={() => setShowCreateModal(true)}
            >
              Create Room
            </button>
          </div>
        ) : (
          <div is-="column" gap-="0.5">
            {rooms.map(room => (
              <button
                key={room.id}
                onClick={() => onRoomSelect(room)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.75rem',
                  backgroundColor: selectedRoom?.id === room.id ? 'var(--background2)' : 'transparent',
                  border: '1px solid',
                  borderColor: selectedRoom?.id === room.id ? 'var(--background3)' : 'transparent',
                  borderRadius: '4px',
                  color: selectedRoom?.id === room.id ? '#000000' : '#000000',
                  fontFamily: 'var(--font-family)',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (selectedRoom?.id !== room.id) {
                    e.currentTarget.style.backgroundColor = 'var(--background1)'
                    e.currentTarget.style.borderColor = 'var(--background2)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedRoom?.id !== room.id) {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.borderColor = 'transparent'
                  }
                }}
              >
                {room.is_private && '🔒 '}
                {room.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateRoomModal
          onCreateRoom={handleCreateRoom}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  )
}