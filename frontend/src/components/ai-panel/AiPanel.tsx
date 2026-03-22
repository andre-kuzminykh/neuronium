import { useState } from 'react'
import { useStore } from '../../store/useStore'

const QUICK_ACTIONS = [
  'Rewrite',
  'Summarize',
  'Expand',
  'Structure',
  'Convert to bullets',
  'Clean up wording',
  'Continue writing',
  'Convert to PRD style',
]

export function AiPanel() {
  const {
    toggleAiPanel, selectedModel, setSelectedModel, availableModels,
    executeAi, aiLoading, aiHistory,
    attachedFiles, removeAttachedFile, addAttachedFile, activeRepo,
  } = useStore()
  const [input, setInput] = useState('')

  const handleSubmit = (instruction: string) => {
    if (!instruction.trim() || aiLoading) return
    executeAi(instruction)
    setInput('')
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    const data = e.dataTransfer.getData('application/neuronium-file')
    if (data && activeRepo) {
      const file = JSON.parse(data)
      if (!file.is_dir) {
        try {
          const resp = await fetch(`/api/repo/file?repo_id=${activeRepo.id}&path=${encodeURIComponent(file.path)}`)
          const fileData = await resp.json()
          if (!fileData.is_binary) {
            addAttachedFile({ path: file.path, content: fileData.content })
          }
        } catch (e) {
          console.error('Failed to attach file:', e)
        }
      }
    }
  }

  return (
    <div
      className="w-80 min-w-[280px] bg-ide-sidebar border-l border-ide-border flex flex-col h-full"
      onDrop={handleDrop}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-ide-border">
        <span className="text-xs font-semibold uppercase text-ide-text-dim">AI Assistant</span>
        <button
          onClick={toggleAiPanel}
          className="text-ide-text-dim hover:text-ide-text text-xs"
          title="Collapse to command bar"
        >
          ✕
        </button>
      </div>

      {/* Model selector */}
      <div className="px-3 py-2 border-b border-ide-border">
        <select
          value={selectedModel || ''}
          onChange={e => setSelectedModel(e.target.value)}
          className="w-full bg-ide-bg border border-ide-border rounded px-2 py-1 text-xs outline-none"
        >
          {availableModels.map(m => (
            <option key={m.id} value={m.id}>{m.name} ({m.provider})</option>
          ))}
          {availableModels.length === 0 && <option value="">No models available</option>}
        </select>
      </div>

      {/* Attached files */}
      {attachedFiles.length > 0 && (
        <div className="px-3 py-2 border-b border-ide-border">
          <div className="text-xs text-ide-text-dim mb-1">Context files:</div>
          {attachedFiles.map(f => (
            <div key={f.path} className="flex items-center justify-between text-xs py-0.5">
              <span className="truncate">{f.path}</span>
              <button
                onClick={() => removeAttachedFile(f.path)}
                className="text-ide-text-dim hover:text-ide-error ml-1"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Quick actions */}
      <div className="px-3 py-2 border-b border-ide-border">
        <div className="flex flex-wrap gap-1">
          {QUICK_ACTIONS.map(action => (
            <button
              key={action}
              onClick={() => handleSubmit(action)}
              disabled={aiLoading}
              className="px-2 py-0.5 text-xs bg-ide-tab border border-ide-border rounded hover:bg-ide-hover disabled:opacity-50"
            >
              {action}
            </button>
          ))}
        </div>
      </div>

      {/* History */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {aiHistory.map(item => (
          <div key={item.id} className="mb-3 border-b border-ide-border pb-2">
            <div className="text-xs text-ide-accent mb-1">{item.command_text}</div>
            <pre className="text-xs text-ide-text-dim whitespace-pre-wrap line-clamp-4">
              {item.result_text.slice(0, 200)}
              {item.result_text.length > 200 && '...'}
            </pre>
            <div className="flex gap-2 mt-1 text-xs text-ide-text-dim">
              <span>{item.model_name}</span>
              <span>{item.status}</span>
              {item.latency_ms && <span>{item.latency_ms}ms</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="px-3 py-2 border-t border-ide-border">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={aiLoading ? 'Processing...' : 'Enter AI instruction...'}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit(input)}
            disabled={aiLoading}
            className="flex-1 bg-ide-bg border border-ide-border rounded px-2 py-1.5 text-sm outline-none focus:border-ide-accent disabled:opacity-50"
          />
          <button
            onClick={() => handleSubmit(input)}
            disabled={aiLoading || !input.trim()}
            className="px-3 py-1.5 bg-ide-accent text-white text-sm rounded disabled:opacity-50"
          >
            {aiLoading ? '...' : '▶'}
          </button>
        </div>
      </div>
    </div>
  )
}
