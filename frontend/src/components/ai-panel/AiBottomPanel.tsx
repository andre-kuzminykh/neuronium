import { useState, useRef } from 'react'
import { useStore } from '../../store/useStore'
import { SuggestionOverlay } from '../editor/SuggestionOverlay'
import type { AttachedFile } from '../../types'

const PANEL_HEIGHT = 320

export function AiBottomPanel() {
  const {
    aiPanelOpen, toggleAiPanel,
    selectedModel, availableModels, setSelectedModel,
    executeAi, aiLoading,
    attachedFiles, addAttachedFile, removeAttachedFile,
    activeTool, setActiveTool, searchScope, setSearchScope,
    aiHistoryByFile, activeTabPath, activeRepo,
    currentSuggestion,
  } = useStore()

  const [instruction, setInstruction] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const fileHistory = aiHistoryByFile[activeTabPath || '__global__'] || []
  const activeTab = useStore.getState().openTabs.find(t => t.path === activeTabPath)

  const handleSubmit = () => {
    if (!instruction.trim() || aiLoading) return
    executeAi(instruction)
    setInstruction('')
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    const data = e.dataTransfer.getData('application/neuronium-file')
    if (!data || !activeRepo) return
    const file = JSON.parse(data)
    if (file.is_dir) return
    try {
      const resp = await fetch(`/api/repo/file?repo_id=${activeRepo.id}&path=${encodeURIComponent(file.path)}`)
      const fileData = await resp.json()
      if (!fileData.is_binary) {
        addAttachedFile({ path: file.path, content: fileData.content } as AttachedFile)
      }
    } catch { /* skip */ }
  }

  // Collapsed bar
  if (!aiPanelOpen) {
    return (
      <div
        className="flex items-center gap-3 px-3 py-1.5 bg-ide-sidebar border-t border-ide-border cursor-pointer select-none"
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
      >
        <button
          onClick={toggleAiPanel}
          className="text-ide-accent text-xs font-semibold px-2 py-0.5 border border-ide-accent rounded hover:bg-ide-accent hover:text-white"
        >
          AI ▲
        </button>
        {activeTab && (
          <span className="text-ide-text-dim text-xs truncate">
            {activeTab.name}
          </span>
        )}
        {selectedModel && (
          <span className="text-xs text-ide-text-dim ml-auto">{selectedModel}</span>
        )}
        {attachedFiles.length > 0 && (
          <span className="text-xs text-ide-accent">{attachedFiles.length} file(s) attached</span>
        )}
      </div>
    )
  }

  return (
    <div
      className="flex flex-col border-t border-ide-border bg-ide-sidebar"
      style={{ height: PANEL_HEIGHT }}
      onDrop={handleDrop}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-ide-border shrink-0">
        <span className="text-xs font-semibold text-ide-text-dim uppercase">AI</span>
        {activeTab && (
          <span className="text-xs text-ide-text truncate">
            📄 {activeTab.name}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {/* Model selector */}
          <select
            value={selectedModel || ''}
            onChange={e => setSelectedModel(e.target.value)}
            className="bg-ide-bg border border-ide-border rounded px-2 py-0.5 text-xs outline-none"
          >
            {availableModels.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
            {availableModels.length === 0 && <option value="">No models</option>}
          </select>
          <button
            onClick={toggleAiPanel}
            className="text-ide-text-dim hover:text-ide-text text-xs px-1"
            title="Collapse"
          >
            ▼
          </button>
        </div>
      </div>

      {/* Chat history for current file */}
      <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
        {currentSuggestion && currentSuggestion.status === 'pending' && (
          <SuggestionOverlay inline />
        )}
        {fileHistory.filter(h => h.status !== 'pending').map(item => (
          <div key={item.id} className="mb-2 border-b border-ide-border pb-2">
            <div className="text-xs text-ide-accent mb-0.5 font-medium">▶ {item.command_text}</div>
            <pre className="text-xs text-ide-text-dim whitespace-pre-wrap">
              {item.result_text.slice(0, 300)}{item.result_text.length > 300 ? '…' : ''}
            </pre>
            <div className="text-xs text-ide-text-dim mt-0.5 flex gap-2">
              <span className={item.status === 'accepted' ? 'text-green-400' : item.status === 'rejected' ? 'text-red-400' : ''}>{item.status}</span>
              {item.latency_ms && <span>{item.latency_ms}ms</span>}
            </div>
          </div>
        ))}
        {fileHistory.length === 0 && !currentSuggestion && (
          <p className="text-xs text-ide-text-dim">
            {activeTab ? `Чат по файлу: ${activeTab.name}` : 'Откройте файл для работы с AI'}
          </p>
        )}
      </div>

      {/* Attached files */}
      {attachedFiles.length > 0 && (
        <div className="flex flex-wrap gap-1 px-3 py-1 border-t border-ide-border shrink-0">
          {attachedFiles.map(f => (
            <span key={f.path} className="flex items-center gap-0.5 px-1.5 py-0.5 bg-ide-tab rounded text-xs">
              {f.path.split('/').pop()}
              <button onClick={() => removeAttachedFile(f.path)} className="text-ide-text-dim hover:text-ide-error ml-0.5">✕</button>
            </span>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="shrink-0 border-t border-ide-border px-3 py-2">
        <div className="flex gap-2">
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            rows={2}
            placeholder={aiLoading ? 'Обрабатывается...' : 'Напишите задачу для AI...'}
            value={instruction}
            onChange={e => setInstruction(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                handleSubmit()
              }
            }}
            disabled={aiLoading}
            className="flex-1 bg-ide-bg border border-ide-border rounded px-2 py-1.5 text-sm outline-none focus:border-ide-accent resize-none disabled:opacity-50"
          />

          {/* Tool + Submit */}
          <div className="flex flex-col gap-1 min-w-[120px]">
            {/* Tool selector */}
            <div className="flex rounded overflow-hidden border border-ide-border text-xs">
              <button
                onClick={() => setActiveTool('none')}
                className={`flex-1 px-2 py-1 ${activeTool === 'none' ? 'bg-ide-accent text-white' : 'bg-ide-tab text-ide-text-dim'}`}
              >
                Задача
              </button>
              <button
                onClick={() => setActiveTool('search')}
                className={`flex-1 px-2 py-1 ${activeTool === 'search' ? 'bg-ide-accent text-white' : 'bg-ide-tab text-ide-text-dim'}`}
              >
                Поиск
              </button>
            </div>

            {/* Search scope */}
            {activeTool === 'search' && (
              <div className="flex rounded overflow-hidden border border-ide-border text-xs">
                <button
                  onClick={() => setSearchScope('files')}
                  className={`flex-1 px-2 py-1 ${searchScope === 'files' ? 'bg-ide-accent text-white' : 'bg-ide-tab text-ide-text-dim'}`}
                >
                  Файлы
                </button>
                <button
                  onClick={() => setSearchScope('internet')}
                  className={`flex-1 px-2 py-1 ${searchScope === 'internet' ? 'bg-ide-accent text-white' : 'bg-ide-tab text-ide-text-dim'}`}
                >
                  Инет
                </button>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={aiLoading || !instruction.trim()}
              className="px-3 py-1.5 bg-ide-accent text-white text-xs rounded disabled:opacity-50 mt-auto"
            >
              {aiLoading ? '...' : '▶ Run'}
            </button>
          </div>
        </div>
        <p className="text-xs text-ide-text-dim mt-1">Ctrl+Enter для отправки · Перетащи файлы сюда для контекста</p>
      </div>
    </div>
  )
}
