import { useState } from 'react'
import { useStore } from '../../store/useStore'

/**
 * Canvas overlay — appears on top of editor when a task suggestion is pending.
 * Shows diff + Accept / Create New File / Cancel actions.
 */
export function CanvasOverlay() {
  const {
    canvasSuggestion,
    acceptCanvasSuggestion,
    rejectCanvasSuggestion,
    createFileFromCanvas,
  } = useStore()

  const [showCreateFile, setShowCreateFile] = useState(false)
  const [newFilePath, setNewFilePath] = useState('')

  if (!canvasSuggestion || canvasSuggestion.status !== 'pending') return null

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-ide-bg/95 backdrop-blur-sm">
      {/* Action bar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-ide-sidebar border-b border-ide-border shrink-0">
        <span className="text-xs font-semibold text-ide-text-dim uppercase">AI Suggestion</span>
        <span className="text-xs text-ide-accent">{canvasSuggestion.model_name}</span>
        {canvasSuggestion.latency_ms && (
          <span className="text-xs text-ide-text-dim">{canvasSuggestion.latency_ms}ms</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={acceptCanvasSuggestion}
            className="px-4 py-1.5 text-sm bg-green-700 text-white rounded hover:bg-green-600 font-semibold"
          >
            ✓ Принять
          </button>
          <button
            onClick={() => setShowCreateFile(!showCreateFile)}
            className="px-4 py-1.5 text-sm bg-ide-tab text-ide-text border border-ide-border rounded hover:bg-ide-hover"
          >
            + Новый файл
          </button>
          <button
            onClick={rejectCanvasSuggestion}
            className="px-4 py-1.5 text-sm bg-red-900/60 text-red-300 border border-red-700 rounded hover:bg-red-900"
          >
            ✕ Отменить
          </button>
        </div>
      </div>

      {/* Create file input */}
      {showCreateFile && (
        <div className="flex gap-2 px-4 py-2 bg-ide-sidebar border-b border-ide-border shrink-0">
          <input
            autoFocus
            type="text"
            placeholder="path/to/new-file.md"
            value={newFilePath}
            onChange={e => setNewFilePath(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && newFilePath) {
                createFileFromCanvas(newFilePath)
                setShowCreateFile(false)
              }
              if (e.key === 'Escape') setShowCreateFile(false)
            }}
            className="flex-1 bg-ide-bg border border-ide-border rounded px-3 py-1.5 text-sm outline-none focus:border-ide-accent"
          />
          <button
            onClick={() => { createFileFromCanvas(newFilePath); setShowCreateFile(false) }}
            disabled={!newFilePath}
            className="px-4 py-1.5 bg-ide-accent text-white text-sm rounded disabled:opacity-50"
          >
            Создать
          </button>
        </div>
      )}

      {/* Task description */}
      <div className="px-4 py-1.5 bg-ide-sidebar/60 border-b border-ide-border shrink-0">
        <span className="text-xs text-ide-text-dim">Задача: </span>
        <span className="text-xs text-ide-text">{canvasSuggestion.command_text}</span>
      </div>

      {/* Diff / result */}
      <div className="flex-1 overflow-auto p-4">
        {canvasSuggestion.diff ? (
          <pre className="text-xs font-mono whitespace-pre-wrap">
            {canvasSuggestion.diff.split('\n').map((line, i) => (
              <div
                key={i}
                className={
                  line.startsWith('+') && !line.startsWith('+++')
                    ? 'text-green-400 bg-green-900/20'
                    : line.startsWith('-') && !line.startsWith('---')
                    ? 'text-red-400 bg-red-900/20'
                    : line.startsWith('@@')
                    ? 'text-ide-accent bg-ide-accent/10'
                    : line.startsWith('+++') || line.startsWith('---')
                    ? 'text-ide-text-dim'
                    : 'text-ide-text'
                }
              >
                {line}
              </div>
            ))}
          </pre>
        ) : (
          <pre className="text-sm font-mono whitespace-pre-wrap text-ide-text">
            {canvasSuggestion.result_text}
          </pre>
        )}
      </div>
    </div>
  )
}
