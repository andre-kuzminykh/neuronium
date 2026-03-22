import { useState } from 'react'
import { useStore } from '../../store/useStore'

export function SuggestionOverlay() {
  const { currentSuggestion, acceptSuggestion, rejectSuggestion, createFileFromSuggestion } = useStore()
  const [newFilePath, setNewFilePath] = useState('')
  const [showCreateFile, setShowCreateFile] = useState(false)

  if (!currentSuggestion || currentSuggestion.status !== 'pending') return null

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-ide-sidebar border-t border-ide-border max-h-[50%] overflow-y-auto">
      <div className="flex items-center justify-between px-3 py-2 border-b border-ide-border">
        <div className="flex items-center gap-2">
          <span className="text-xs text-ide-text-dim">AI Suggestion</span>
          <span className="text-xs text-ide-accent">{currentSuggestion.model_name}</span>
          {currentSuggestion.latency_ms && (
            <span className="text-xs text-ide-text-dim">{currentSuggestion.latency_ms}ms</span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={acceptSuggestion}
            className="px-3 py-1 text-xs bg-green-700 text-white rounded hover:bg-green-600"
          >
            Accept
          </button>
          <button
            onClick={rejectSuggestion}
            className="px-3 py-1 text-xs bg-red-700 text-white rounded hover:bg-red-600"
          >
            Reject
          </button>
          <button
            onClick={() => setShowCreateFile(!showCreateFile)}
            className="px-3 py-1 text-xs bg-ide-tab text-ide-text border border-ide-border rounded hover:bg-ide-hover"
          >
            Create File
          </button>
        </div>
      </div>

      {showCreateFile && (
        <div className="flex gap-2 px-3 py-2 border-b border-ide-border">
          <input
            type="text"
            placeholder="path/to/new-file.md"
            value={newFilePath}
            onChange={e => setNewFilePath(e.target.value)}
            className="flex-1 bg-ide-bg border border-ide-border rounded px-2 py-1 text-xs outline-none"
          />
          <button
            onClick={() => { createFileFromSuggestion(newFilePath); setShowCreateFile(false) }}
            disabled={!newFilePath}
            className="px-3 py-1 text-xs bg-ide-accent text-white rounded disabled:opacity-50"
          >
            Create
          </button>
        </div>
      )}

      {currentSuggestion.diff ? (
        <pre className="px-3 py-2 text-xs font-mono whitespace-pre-wrap overflow-x-auto">
          {currentSuggestion.diff.split('\n').map((line, i) => (
            <div
              key={i}
              className={
                line.startsWith('+') ? 'text-green-400 bg-green-900/20' :
                line.startsWith('-') ? 'text-red-400 bg-red-900/20' :
                line.startsWith('@@') ? 'text-ide-accent' :
                'text-ide-text-dim'
              }
            >
              {line}
            </div>
          ))}
        </pre>
      ) : (
        <pre className="px-3 py-2 text-xs font-mono whitespace-pre-wrap">
          {currentSuggestion.result_text}
        </pre>
      )}
    </div>
  )
}
