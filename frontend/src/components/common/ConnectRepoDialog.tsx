import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { api } from '../../api/client'
import type { RepoInfo } from '../../types'

export function ConnectRepoDialog() {
  const { setActiveRepo } = useStore()
  const [mode, setMode] = useState<'local' | 'remote'>('local')
  const [path, setPath] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleConnect = async () => {
    setError('')
    setLoading(true)
    try {
      let repo: RepoInfo
      if (mode === 'local') {
        repo = await api.connectLocal(path) as RepoInfo
      } else {
        repo = await api.connectRemote(url) as RepoInfo
      }
      setActiveRepo(repo)
    } catch (e: any) {
      setError(e.message || 'Connection failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center h-screen bg-ide-bg">
      <div className="w-[480px] bg-ide-sidebar border border-ide-border rounded-lg p-6">
        <h1 className="text-xl font-semibold mb-1">Neuronium</h1>
        <p className="text-ide-text-dim text-sm mb-6">Connect a repository to get started</p>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode('local')}
            className={`px-4 py-1.5 rounded text-sm ${mode === 'local' ? 'bg-ide-accent text-white' : 'bg-ide-tab text-ide-text-dim'}`}
          >
            Local
          </button>
          <button
            onClick={() => setMode('remote')}
            className={`px-4 py-1.5 rounded text-sm ${mode === 'remote' ? 'bg-ide-accent text-white' : 'bg-ide-tab text-ide-text-dim'}`}
          >
            Remote
          </button>
        </div>

        {mode === 'local' ? (
          <input
            type="text"
            placeholder="/path/to/repository"
            value={path}
            onChange={e => setPath(e.target.value)}
            className="w-full bg-ide-bg border border-ide-border rounded px-3 py-2 text-sm mb-4 outline-none focus:border-ide-accent"
          />
        ) : (
          <input
            type="text"
            placeholder="https://github.com/user/repo.git"
            value={url}
            onChange={e => setUrl(e.target.value)}
            className="w-full bg-ide-bg border border-ide-border rounded px-3 py-2 text-sm mb-4 outline-none focus:border-ide-accent"
          />
        )}

        {error && <p className="text-ide-error text-sm mb-3">{error}</p>}

        <button
          onClick={handleConnect}
          disabled={loading || (mode === 'local' ? !path : !url)}
          className="w-full bg-ide-accent text-white py-2 rounded text-sm hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Connecting...' : 'Connect'}
        </button>
      </div>
    </div>
  )
}
