import { useState } from 'react'
import './CreateRoomModal.css'

interface CreateRoomModalProps {
  onCreateRoom: (name: string, description: string, isPrivate: boolean) => Promise<void>
  onClose: () => void
}

export default function CreateRoomModal({ onCreateRoom, onClose }: CreateRoomModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      setError('ルーム名を入力してください')
      return
    }

    if (name.length > 100) {
      setError('ルーム名は100文字以内で入力してください')
      return
    }

    try {
      setLoading(true)
      setError(null)
      await onCreateRoom(name.trim(), description.trim(), isPrivate)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ルームの作成に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content">
        <div className="modal-header">
          <h2>新しいルームを作成</h2>
          <button 
            className="close-button"
            onClick={onClose}
            disabled={loading}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="create-room-form">
          <div className="form-group">
            <label htmlFor="room-name">ルーム名 *</label>
            <input
              id="room-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 一般"
              maxLength={100}
              disabled={loading}
              autoFocus
            />
            <div className="char-count">
              {name.length}/100
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="room-description">説明（任意）</label>
            <textarea
              id="room-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="このルームの目的や使用方法を説明してください"
              rows={3}
              maxLength={500}
              disabled={loading}
            />
            <div className="char-count">
              {description.length}/500
            </div>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                disabled={loading}
              />
              <span className="checkmark"></span>
              プライベートルーム
            </label>
            <p className="helper-text">
              プライベートルームは招待されたメンバーのみ参加できます
            </p>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="form-actions">
            <button
              type="button"
              className="cancel-button"
              onClick={onClose}
              disabled={loading}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="create-button"
              disabled={loading || !name.trim()}
            >
              {loading ? '作成中...' : 'ルームを作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}