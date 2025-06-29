import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../services/api'
import { useAuth } from '../contexts/AuthContext'

export default function CallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { checkAuth } = useAuth()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code')
      const state = searchParams.get('state')
      const error = searchParams.get('error')

      if (error) {
        setStatus('error')
        setErrorMessage('GitHub認証がキャンセルされました')
        return
      }

      if (!code) {
        setStatus('error')
        setErrorMessage('認証コードが取得できませんでした')
        return
      }

      try {
        const response = await api.exchangeGitHubCode(code, state || undefined)
        
        // トークンを保存
        localStorage.setItem('token', response.access_token)
        
        // 認証状態を更新
        await checkAuth()
        
        setStatus('success')
        
        // ダッシュボードにリダイレクト
        setTimeout(() => {
          navigate('/')
        }, 2000)
        
      } catch (error) {
        console.error('認証処理に失敗:', error)
        setStatus('error')
        setErrorMessage('認証処理に失敗しました')
      }
    }

    handleCallback()
  }, [searchParams, navigate, checkAuth])

  return (
    <div className="callback-page">
      <div className="callback-container">
        {status === 'loading' && (
          <div className="callback-loading">
            <div className="spinner"></div>
            <h2>認証処理中...</h2>
            <p>しばらくお待ちください</p>
          </div>
        )}

        {status === 'success' && (
          <div className="callback-success">
            <div className="success-icon">✅</div>
            <h2>ログイン成功！</h2>
            <p>ダッシュボードにリダイレクトしています...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="callback-error">
            <div className="error-icon">❌</div>
            <h2>認証エラー</h2>
            <p>{errorMessage}</p>
            <button onClick={() => navigate('/login')}>
              ログインページに戻る
            </button>
          </div>
        )}
      </div>

      <style>{`
        .callback-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
        }

        .callback-container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          padding: 3rem;
          text-align: center;
          max-width: 400px;
          width: 100%;
        }

        .callback-loading, .callback-success, .callback-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .success-icon, .error-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        .callback-container h2 {
          margin: 0;
          color: #333;
        }

        .callback-container p {
          margin: 0;
          color: #666;
        }

        .callback-error button {
          background: #667eea;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 0.75rem 1.5rem;
          cursor: pointer;
          font-size: 1rem;
          margin-top: 1rem;
        }

        .callback-error button:hover {
          background: #5a6fd8;
        }
      `}</style>
    </div>
  )
}