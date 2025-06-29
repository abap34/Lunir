/**
 * Lunir API Client
 * バックエンドAPIとの通信を管理
 */
import axios from 'axios'

const API_BASE_URL = 'http://localhost:8000'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// レスポンスインターセプター
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

// APIレスポンス型定義
export interface ApiStatus {
  api_version: string
  status: string
  features: {
    chat: boolean
    voice_call: boolean
    timeline: boolean
    latex_support: boolean
    code_highlight: boolean
    github_auth: boolean
  }
}

export interface HealthResponse {
  status: string
  message: string
}

// 認証関連の型定義
export interface User {
  id: number
  github_id: number
  username: string
  display_name?: string
  email?: string
  avatar_url?: string
  bio?: string
  is_active: boolean
}

export interface AuthURLResponse {
  auth_url: string
  state: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  user: User
}

// チャット関連の型定義
export interface Room {
  id: number
  name: string
  description?: string
  is_private: boolean
  created_at: string
  member_count: number
}

export interface Message {
  id: number
  content: string
  message_type: string
  user: {
    id: number
    username: string
    display_name?: string
    avatar_url?: string
  }
  room_id: number
  parent_id?: number
  has_latex: boolean
  has_code: boolean
  created_at: string
}

export interface ChatStats {
  active_connections: number
  active_rooms: number
  user_id: number
}

// トークンを使用したAPI呼び出し用のヘルパー
const getAuthHeaders = () => {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// API関数
export const api = {
  // ヘルスチェック
  getHealth: async (): Promise<HealthResponse> => {
    const response = await apiClient.get<HealthResponse>('/health')
    return response.data
  },

  // API状態取得
  getStatus: async (): Promise<ApiStatus> => {
    const response = await apiClient.get<ApiStatus>('/api/v1/status')
    return response.data
  },

  // 認証関連
  getGitHubAuthUrl: async (): Promise<AuthURLResponse> => {
    const response = await apiClient.get<AuthURLResponse>('/auth/github/login')
    return response.data
  },

  exchangeGitHubCode: async (code: string, state?: string): Promise<TokenResponse> => {
    const params = new URLSearchParams({ code })
    if (state) params.append('state', state)
    
    const response = await apiClient.get<TokenResponse>(`/auth/github/callback?${params}`)
    return response.data
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await apiClient.get<User>('/auth/me', {
      headers: getAuthHeaders()
    })
    return response.data
  },

  logout: async (): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>('/auth/logout', {}, {
      headers: getAuthHeaders()
    })
    return response.data
  },

  // チャット関連
  getRooms: async (): Promise<Room[]> => {
    const response = await apiClient.get<Room[]>('/api/v1/rooms', {
      headers: getAuthHeaders()
    })
    return response.data
  },

  createRoom: async (name: string, description?: string, isPrivate: boolean = false): Promise<Room> => {
    const response = await apiClient.post<Room>('/api/v1/rooms', {
      name,
      description,
      is_private: isPrivate
    }, {
      headers: getAuthHeaders()
    })
    return response.data
  },

  joinRoom: async (roomId: number): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>(`/api/v1/rooms/${roomId}/join`, {}, {
      headers: getAuthHeaders()
    })
    return response.data
  },

  leaveRoom: async (roomId: number): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>(`/api/v1/rooms/${roomId}/leave`, {}, {
      headers: getAuthHeaders()
    })
    return response.data
  },

  getRoomMessages: async (roomId: number, limit: number = 50, beforeId?: number): Promise<Message[]> => {
    const params = new URLSearchParams({ limit: limit.toString() })
    if (beforeId) params.append('before_id', beforeId.toString())
    
    const response = await apiClient.get<Message[]>(`/api/v1/rooms/${roomId}/messages?${params}`, {
      headers: getAuthHeaders()
    })
    return response.data
  },

  getChatStats: async (): Promise<ChatStats> => {
    const response = await apiClient.get<ChatStats>('/api/v1/stats', {
      headers: getAuthHeaders()
    })
    return response.data
  }
}