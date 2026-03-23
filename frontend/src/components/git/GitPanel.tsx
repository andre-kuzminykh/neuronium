import { useState, useEffect } from 'react'
import { useStore } from '../../store/useStore'
import { api } from '../../api/client'

interface GitFile {
  path: string
  status: string
}

interface GitStatus {
  branch: string
  changed_files: GitFile[]
  has_remote: boolean
}

export function GitPanel() {
  const { activeRepo } = useStore()
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadStatus = async () => {
    if (!activeRepo) return
    try {
      const s = await api.gitStatus(activeRepo.id) as GitStatus
      setStatus(s)
      setError('')
    } catch (e: any) {
      setError(e.message || 'Failed to get git status')
    }
  }

  useEffect(() => {
    if (open) loadStatus()
  }, [open, activeRepo])

  const handleCommit = async () => {
    if (!activeRepo || !message.trim()) return
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const result = await api.gitCommit(activeRepo.id, message) as any
      setSuccess(`Committed: ${result.commit_sha}`)
      setMessage('')
      await loadStatus()
    } catch (e: any) {
      setError(e.message || 'Commit failed')
    } finally {
      setLoading(false)
    }
  }

  const handlePush = async () => {
    if (!activeRepo) return
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      await api.gitPush(activeRepo.id)
      setSuccess('Pushed successfully')
    } catch (e: any) {
      setError(e.message || 'Push failed')
    } finally {
      setLoading(false)
    }
  }

  const statusColor: Record<string, string> = {
    modified: 'text-yellow-400',
    staged: 'text-green-400',
    untracked: 'text-blue-400',
    deleted: 'text-red-400',
  }

  const statusLabel: Record<string, string> = {
    modified: 'M',
    staged: 'S',
    untracked: 'U',
    deleted: 'D',
  }

  return (
    <div className="border-t border-ide-border">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2 text-xs font-semibold uppercase text-ide-text-dim flex items-center justify-between hover:bg-ide-tab"
      >
        <span>Git</span>
        <span className="text-[10px]">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="px-3 pb-3">
          {status && (
            <div className="text-xs text-ide-text-dim mb-2">
              Branch: <span className="text-ide-text">{status.branch}</span>
            </div>
          )}

          {error && (
            <div className="text-xs text-ide-error mb-2 break-words">{error}</div>
          )}
          {success && (
            <div className="text-xs text-green-400 mb-2">{success}</div>
          )}

          {status && status.changed_files.length > 0 && (
            <div className="mb-2 max-h-32 overflow-y-auto">
              {status.changed_files.map(f => (
                <div key={f.path} className="flex items-center gap-1 text-xs py-0.5">
                  <span className={`font-mono ${statusColor[f.status] || 'text-ide-text-dim'}`}>
                    {statusLabel[f.status] || '?'}
                  </span>
                  <span className="text-ide-text truncate" title={f.path}>
                    {f.path}
                  </span>
                </div>
              ))}
            </div>
          )}

          {status && status.changed_files.length === 0 && (
            <div className="text-xs text-ide-text-dim mb-2">No changes</div>
          )}

          <textarea
            placeholder="Commit message..."
            value={message}
            onChange={e => setMessage(e.target.value)}
            className="w-full bg-ide-bg border border-ide-border rounded px-2 py-1 text-xs outline-none focus:border-ide-accent resize-none mb-2"
            rows={2}
          />

          <div className="flex gap-1">
            <button
              onClick={handleCommit}
              disabled={loading || !message.trim()}
              className="flex-1 bg-ide-accent text-white py-1 rounded text-xs hover:opacity-90 disabled:opacity-50"
            >
              {loading ? '...' : 'Commit'}
            </button>
            {status?.has_remote && (
              <button
                onClick={handlePush}
                disabled={loading}
                className="px-3 bg-ide-tab text-ide-text py-1 rounded text-xs hover:opacity-90 disabled:opacity-50 border border-ide-border"
              >
                Push
              </button>
            )}
            <button
              onClick={loadStatus}
              disabled={loading}
              className="px-2 bg-ide-tab text-ide-text-dim py-1 rounded text-xs hover:opacity-90 disabled:opacity-50 border border-ide-border"
              title="Refresh"
            >
              ↻
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
