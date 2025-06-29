import { useAuth } from '../contexts/AuthContext'
import { devAuth } from '../utils/devAuth'

export default function LoginPage() {
  const { login, isLoading, setUser, setToken } = useAuth()

  const handleGitHubLogin = async () => {
    await login()
  }

  const handleDevLogin = async () => {
    const result = await devAuth.quickLogin()
    if (result) {
      setToken(result.access_token)
      setUser(result.user)
    }
  }

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono flex items-center justify-center p-4">
      <div className="max-w-lg w-full p-6 border border-green-500">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2 text-green-300">Lunir</h1>
          <p className="text-green-500">Software Engineer Chat Terminal</p>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="text-xl mb-4 text-green-300">$ auth login</h2>
            <p className="mb-4 text-green-500">Authenticate with GitHub</p>

            <button
              className="w-full p-3 border border-green-500 text-green-400 hover:bg-green-500 hover:text-black transition-colors font-mono"
              onClick={handleGitHubLogin}
              disabled={isLoading}
            >
              {isLoading ? '> Authenticating...' : '> GitHub OAuth'}
            </button>
          </div>

          {import.meta.env.DEV && (
            <div>
              <div className="border-t border-green-600 my-4 pt-4">
                <span className="text-green-600 text-sm">// Development Mode</span>
              </div>
              <button
                className="w-full p-3 border border-yellow-500 text-yellow-400 hover:bg-yellow-500 hover:text-black transition-colors font-mono"
                onClick={handleDevLogin}
                disabled={isLoading}
              >
                🚀 Dev Login (No Auth)
              </button>
              <p className="text-yellow-600 text-sm mt-2">
                // Bypass GitHub OAuth for testing
              </p>
            </div>
          )}

          <div>
            <h3 className="text-lg mb-3 text-green-300">$ cat features.txt</h3>
            <div className="p-4 text-sm border border-green-500">
              <div className="space-y-1 text-green-500">
                <div>📝 Real-time messaging</div>
                <div>📞 Voice call support</div>
                <div>📊 Timeline views</div>
                <div>📐 LaTeX rendering</div>
                <div>💻 Code highlighting</div>
                <div>🔧 Dev-focused tools</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}