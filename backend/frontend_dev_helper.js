/**
 * フロントエンド開発用のヘルパーユーティリティ
 * 開発環境でのクイック認証やテスト用ユーザー管理
 */

class LunirDevAuth {
    constructor(baseUrl = 'http://localhost:8000') {
        this.baseUrl = baseUrl;
        this.token = localStorage.getItem('lunir_dev_token');
    }

    /**
     * 開発用クイックログイン
     * @param {number} userId - ユーザーID（省略時はデフォルトユーザー）
     */
    async quickLogin(userId = null) {
        try {
            const response = await fetch(`${this.baseUrl}/auth/dev/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userId ? { user_id: userId } : {})
            });

            if (!response.ok) {
                throw new Error(`Login failed: ${response.status}`);
            }

            const data = await response.json();
            this.token = data.access_token;
            localStorage.setItem('lunir_dev_token', this.token);
            localStorage.setItem('lunir_user', JSON.stringify(data.user));
            
            console.log('🚀 Quick login successful:', data.user);
            return data;
        } catch (error) {
            console.error('❌ Quick login failed:', error);
            throw error;
        }
    }

    /**
     * 利用可能なテストユーザー一覧を取得
     */
    async getTestUsers() {
        try {
            const response = await fetch(`${this.baseUrl}/auth/dev/users`);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch users: ${response.status}`);
            }

            const users = await response.json();
            console.log('👥 Available test users:', users);
            return users;
        } catch (error) {
            console.error('❌ Failed to get test users:', error);
            throw error;
        }
    }

    /**
     * 新しいテストユーザーを作成
     * @param {string} username - ユーザー名
     * @param {string} displayName - 表示名
     * @param {string} email - メールアドレス
     */
    async createTestUser(username, displayName = null, email = null) {
        try {
            const response = await fetch(`${this.baseUrl}/auth/dev/create-test-user`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username,
                    display_name: displayName,
                    email
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to create user: ${response.status}`);
            }

            const user = await response.json();
            console.log('✅ Test user created:', user);
            return user;
        } catch (error) {
            console.error('❌ Failed to create test user:', error);
            throw error;
        }
    }

    /**
     * WebSocket接続用のトークンを取得
     * 開発モードでは "dev" を返す
     */
    getWebSocketToken() {
        // 開発モードではスペシャルトークン "dev" を使用
        return "dev";
    }

    /**
     * API リクエスト用の認証ヘッダーを取得
     */
    getAuthHeaders() {
        if (!this.token) {
            throw new Error('No authentication token. Please login first.');
        }

        return {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
        };
    }

    /**
     * 認証状態をチェック
     */
    async checkAuth() {
        if (!this.token) {
            console.log('❌ Not authenticated');
            return false;
        }

        try {
            const response = await fetch(`${this.baseUrl}/auth/me`, {
                headers: this.getAuthHeaders()
            });

            if (response.ok) {
                const user = await response.json();
                console.log('✅ Authenticated as:', user);
                return user;
            } else {
                console.log('❌ Authentication invalid');
                this.logout();
                return false;
            }
        } catch (error) {
            console.error('❌ Auth check failed:', error);
            return false;
        }
    }

    /**
     * ログアウト
     */
    logout() {
        this.token = null;
        localStorage.removeItem('lunir_dev_token');
        localStorage.removeItem('lunir_user');
        console.log('👋 Logged out');
    }

    /**
     * チャットルーム一覧を取得
     */
    async getRooms() {
        try {
            const response = await fetch(`${this.baseUrl}/api/v1/rooms`, {
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch rooms: ${response.status}`);
            }

            const rooms = await response.json();
            console.log('🏠 User rooms:', rooms);
            return rooms;
        } catch (error) {
            console.error('❌ Failed to get rooms:', error);
            throw error;
        }
    }

    /**
     * WebSocket チャット接続を開始
     * @param {number} roomId - ルームID
     * @param {function} onMessage - メッセージ受信時のコールバック
     */
    async connectToChat(roomId, onMessage) {
        const token = this.getWebSocketToken();
        const wsUrl = `ws://localhost:8000/ws/chat?token=${token}&room_id=${roomId}`;
        
        const ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
            console.log(`🔌 Connected to chat room ${roomId}`);
        };
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log('💬 Message received:', data);
            if (onMessage) onMessage(data);
        };
        
        ws.onclose = (event) => {
            console.log(`🔌 Disconnected from chat room ${roomId}`, event);
        };
        
        ws.onerror = (error) => {
            console.error('❌ WebSocket error:', error);
        };
        
        return ws;
    }
}

// グローバルに利用可能にする
if (typeof window !== 'undefined') {
    window.LunirDevAuth = LunirDevAuth;
    window.lunirDev = new LunirDevAuth();
    
    // 開発用のコンソールヘルパー
    console.log(`
🚀 Lunir Development Helper Loaded!

Quick start commands:
  lunirDev.quickLogin()           - ログイン（デフォルトユーザー）
  lunirDev.getTestUsers()         - テストユーザー一覧
  lunirDev.createTestUser('name') - テストユーザー作成
  lunirDev.checkAuth()            - 認証状態確認
  lunirDev.getRooms()             - ルーム一覧取得
  lunirDev.connectToChat(1, fn)   - WebSocket接続

Example usage:
  await lunirDev.quickLogin();
  const rooms = await lunirDev.getRooms();
  const ws = await lunirDev.connectToChat(1, console.log);
`);
}

// Node.js環境対応
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LunirDevAuth;
}