import { useStore } from '../../store/useStore'

export function CommandBar() {
  const {
    toggleAiPanel, commandBarInput, setCommandBarInput,
    executeAi, aiLoading, selectedModel,
    attachedFiles, addAttachedFile, removeAttachedFile, activeRepo,
  } = useStore()

  const handleSubmit = () => {
    if (!commandBarInput.trim() || aiLoading) return
    executeAi(commandBarInput)
    setCommandBarInput('')
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
      className="flex items-center gap-2 px-3 py-1.5 bg-ide-sidebar border-b border-ide-border"
      onDrop={handleDrop}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
    >
      <button
        onClick={toggleAiPanel}
        className="text-ide-accent text-xs px-2 py-0.5 border border-ide-accent rounded hover:bg-ide-accent hover:text-white"
        title="Open AI panel"
      >
        AI
      </button>

      {attachedFiles.length > 0 && (
        <div className="flex gap-1">
          {attachedFiles.map(f => (
            <span key={f.path} className="flex items-center gap-0.5 px-1.5 py-0.5 bg-ide-tab rounded text-xs">
              {f.path.split('/').pop()}
              <button onClick={() => removeAttachedFile(f.path)} className="text-ide-text-dim hover:text-ide-error">✕</button>
            </span>
          ))}
        </div>
      )}

      <input
        type="text"
        placeholder={aiLoading ? 'Processing...' : `AI command (${selectedModel || 'no model'})...`}
        value={commandBarInput}
        onChange={e => setCommandBarInput(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        disabled={aiLoading}
        className="flex-1 bg-ide-bg border border-ide-border rounded px-2 py-1 text-xs outline-none focus:border-ide-accent disabled:opacity-50"
      />

      <button
        onClick={handleSubmit}
        disabled={aiLoading || !commandBarInput.trim()}
        className="px-2 py-1 bg-ide-accent text-white text-xs rounded disabled:opacity-50"
      >
        {aiLoading ? '...' : 'Run'}
      </button>
    </div>
  )
}
