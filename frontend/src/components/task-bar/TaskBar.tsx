import { useRef } from 'react'
import { useStore } from '../../store/useStore'

const TASK_BAR_HEIGHT = 180

/**
 * Bottom task bar — canvas mode.
 * User writes a task, AI generates result shown as overlay in editor.
 * Drag files here to add them as [markdown links] in the instruction.
 */
export function TaskBar() {
  const {
    taskBarOpen, toggleTaskBar,
    taskInstruction, setTaskInstruction,
    taskAttachedFiles, addTaskFile, removeTaskFile,
    activeTool, setActiveTool, searchScope, setSearchScope,
    runTask, taskLoading,
    canvasSuggestion, selectedModel, activeRepo,
    aiError, clearAiError,
  } = useStore()

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Insert text at cursor in textarea
  const insertAtCursor = (text: string) => {
    const ta = textareaRef.current
    if (!ta) {
      setTaskInstruction(taskInstruction + text)
      return
    }
    const start = ta.selectionStart ?? taskInstruction.length
    const end = ta.selectionEnd ?? taskInstruction.length
    const newVal = taskInstruction.slice(0, start) + text + taskInstruction.slice(end)
    setTaskInstruction(newVal)
    // Restore cursor after inserted text
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = start + text.length
      ta.focus()
    })
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    const data = e.dataTransfer.getData('application/neuronium-file')
    if (!data || !activeRepo) return
    const file = JSON.parse(data)
    if (file.is_dir) return

    const link = `[${file.name}](${file.path})`
    insertAtCursor(link)

    // Also cache file content for context
    try {
      const resp = await fetch(`/api/repo/file?repo_id=${activeRepo.id}&path=${encodeURIComponent(file.path)}`)
      const fd = await resp.json()
      if (!fd.is_binary) addTaskFile({ path: file.path, content: fd.content })
    } catch { /* skip */ }
  }

  const handleSubmit = () => {
    if (!taskInstruction.trim() || taskLoading) return
    runTask()
  }

  // ── Collapsed bar ──────────────────────────────────────────────────────────
  if (!taskBarOpen) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-1 bg-ide-sidebar border-t border-ide-border cursor-pointer select-none"
        onClick={toggleTaskBar}
        title="Открыть панель задач"
      >
        <span className="text-xs text-ide-accent font-semibold">⚡ Task</span>
        {canvasSuggestion?.status === 'pending' && (
          <span className="text-xs text-ide-warning">● Есть suggestion</span>
        )}
        {selectedModel && (
          <span className="text-xs text-ide-text-dim ml-auto">{selectedModel}</span>
        )}
        <span className="text-ide-text-dim text-xs">▲</span>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col border-t border-ide-border bg-ide-sidebar shrink-0"
      style={{ height: TASK_BAR_HEIGHT }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1 border-b border-ide-border shrink-0">
        <span className="text-xs font-semibold text-ide-text-dim uppercase">⚡ Task</span>
        <span className="text-xs text-ide-text-dim">→ Canvas</span>
        {aiError && (
          <span className="text-xs text-ide-error ml-2 truncate max-w-xs" title={aiError}>
            ❌ {aiError.slice(0, 80)}
            <button onClick={clearAiError} className="ml-1 underline">✕</button>
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-ide-text-dim">{selectedModel || 'no model'}</span>
          <button
            onClick={toggleTaskBar}
            className="text-ide-text-dim hover:text-ide-text text-xs"
          >
            ▼
          </button>
        </div>
      </div>

      <div className="flex flex-1 gap-2 px-3 py-2 min-h-0">
        {/* Task textarea — drag files here to insert [link] */}
        <div className="flex flex-col flex-1 min-w-0">
          <textarea
            ref={textareaRef}
            placeholder="Напиши задачу... (перетащи файлы для вставки ссылок)"
            value={taskInstruction}
            onChange={e => setTaskInstruction(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                handleSubmit()
              }
            }}
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'link' }}
            disabled={taskLoading}
            className="flex-1 bg-ide-bg border border-ide-border rounded px-2 py-1.5 text-sm outline-none focus:border-ide-accent resize-none disabled:opacity-50 font-mono"
          />

          {/* Attached files tags */}
          {taskAttachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {taskAttachedFiles.map(f => (
                <span key={f.path} className="flex items-center gap-0.5 px-1.5 py-0.5 bg-ide-tab rounded text-xs">
                  {f.path.split('/').pop()}
                  <button
                    onClick={() => removeTaskFile(f.path)}
                    className="text-ide-text-dim hover:text-ide-error ml-0.5"
                  >✕</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right controls */}
        <div className="flex flex-col gap-1.5 min-w-[110px]">
          {/* Tool selector */}
          <div className="text-xs text-ide-text-dim mb-0.5">Инструмент</div>
          <div className="flex flex-col gap-1 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio" name="tool" value="none"
                checked={activeTool === 'none'}
                onChange={() => setActiveTool('none')}
                className="accent-ide-accent"
              />
              <span className={activeTool === 'none' ? 'text-ide-text' : 'text-ide-text-dim'}>Без инструмента</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio" name="tool" value="search"
                checked={activeTool === 'search'}
                onChange={() => setActiveTool('search')}
                className="accent-ide-accent"
              />
              <span className={activeTool === 'search' ? 'text-ide-text' : 'text-ide-text-dim'}>Поиск</span>
            </label>
          </div>

          {activeTool === 'search' && (
            <div className="flex flex-col gap-1 pl-3 text-xs border-l border-ide-border">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio" name="scope" value="files"
                  checked={searchScope === 'files'}
                  onChange={() => setSearchScope('files')}
                  className="accent-ide-accent"
                />
                <span className={searchScope === 'files' ? 'text-ide-text' : 'text-ide-text-dim'}>Файлы</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio" name="scope" value="internet"
                  checked={searchScope === 'internet'}
                  onChange={() => setSearchScope('internet')}
                  className="accent-ide-accent"
                />
                <span className={searchScope === 'internet' ? 'text-ide-text' : 'text-ide-text-dim'}>Интернет</span>
              </label>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={taskLoading || !taskInstruction.trim()}
            className="mt-auto px-3 py-1.5 bg-ide-accent text-white text-xs rounded hover:opacity-90 disabled:opacity-50 font-semibold"
          >
            {taskLoading ? '⏳ ...' : '▶ Run'}
          </button>
          <p className="text-xs text-ide-text-dim">Ctrl+Enter</p>
        </div>
      </div>
    </div>
  )
}
