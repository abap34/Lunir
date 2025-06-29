/**
 * 開発者向け認証ヘルパー
 * 開発環境でのテストを簡単にするためのユーティリティ
 */


interface DevLoginResponse {
  access_token: string
  token_type: string
  user: {
    id: number
    github_id: number
    username: string
    display_name: string
    email: string
    avatar_url: string
    bio: string
    is_active: boolean
  }
}

interface DevUser {
  id: number
  github_id: number
  username: string
  display_name: string
  email: string
  avatar_url: string
  bio: string
  is_active: boolean
}

class DevAuthHelper {
  private readonly isDev = import.meta.env.DEV
  
  /**
   * 開発用クイックログイン
   */
  async quickLogin(userId?: number): Promise<DevLoginResponse | null> {
    if (!this.isDev) {
      console.warn('Dev auth is only available in development mode')
      return null
    }

    try {
      const response = await fetch('http://localhost:8000/auth/dev/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userId ? { user_id: userId } : {})
      })

      if (!response.ok) {
        throw new Error(`Failed to login: ${response.statusText}`)
      }

      const data: DevLoginResponse = await response.json()
      
      // localStorage にトークンを保存
      localStorage.setItem('token', data.access_token)
      localStorage.setItem('user', JSON.stringify(data.user))
      
      console.log('🚀 Dev login successful:', data.user.username)
      
      return data
    } catch (error) {
      console.error('Dev login failed:', error)
      return null
    }
  }

  /**
   * 開発用ユーザー一覧取得
   */
  async getDevUsers(): Promise<DevUser[]> {
    if (!this.isDev) {
      console.warn('Dev auth is only available in development mode')
      return []
    }

    try {
      const response = await fetch('http://localhost:8000/auth/dev/users')
      
      if (!response.ok) {
        throw new Error(`Failed to get users: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Failed to get dev users:', error)
      return []
    }
  }

  /**
   * テストユーザー作成
   */
  async createTestUser(
    username: string,
    displayName?: string,
    email?: string
  ): Promise<DevUser | null> {
    if (!this.isDev) {
      console.warn('Dev auth is only available in development mode')
      return null
    }

    try {
      const response = await fetch('http://localhost:8000/auth/dev/create-test-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          display_name: displayName,
          email
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to create user: ${response.statusText}`)
      }

      const user: DevUser = await response.json()
      console.log('✅ Test user created:', user.username)
      
      return user
    } catch (error) {
      console.error('Failed to create test user:', error)
      return null
    }
  }

  /**
   * 現在のトークンが有効かチェック
   */
  async validateToken(): Promise<boolean> {
    const token = localStorage.getItem('token')
    if (!token) return false

    try {
      const response = await fetch('http://localhost:8000/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      return response.ok
    } catch {
      return false
    }
  }

  /**
   * ログアウト（トークンを削除）
   */
  logout(): void {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    console.log('🚪 Logged out')
  }

  /**
   * コンソールヘルパーを window に追加
   */
  installConsoleHelper(): void {
    if (!this.isDev) return

    // @ts-ignore
    window.lunirDev = {
      login: this.quickLogin.bind(this),
      loginAs: (userId: number) => this.quickLogin(userId),
      users: this.getDevUsers.bind(this),
      createUser: this.createTestUser.bind(this),
      validate: this.validateToken.bind(this),
      logout: this.logout.bind(this),
      help: () => {
        console.log(`
🚀 Lunir Dev Helper Commands:

Authentication:
  lunirDev.login()                    - Quick login as default user
  lunirDev.loginAs(userId)           - Login as specific user
  lunirDev.logout()                  - Logout (clear tokens)
  lunirDev.validate()                - Check if current token is valid

User Management:
  lunirDev.users()                   - List available dev users
  lunirDev.createUser(username, displayName?, email?) - Create test user

Example:
  await lunirDev.login()
  await lunirDev.loginAs(2)
  await lunirDev.createUser('testuser2', 'Test User 2', 'test2@example.com')
  await lunirDev.users()
        `)
      }
    }

    console.log('🛠 Lunir Dev Helper installed! Type lunirDev.help() for commands.')
  }
}

export const devAuth = new DevAuthHelper()

// 開発環境でコンソールヘルパーを自動インストール
if (import.meta.env.DEV) {
  devAuth.installConsoleHelper()
}