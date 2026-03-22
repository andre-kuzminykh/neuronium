import { useState, useRef, useEffect } from 'react'
import { useStore } from '../../store/useStore'
import type { ChatMessage as ChatMessageType } from '../../types'

function parseSuggestion(text: string): { message: string; suggestion: string | null } {
  const startTag = '<<<SUGGESTION>>>'
  const endTag = '<<<END_SUGGESTION>>>'
  const startIdx = text.indexOf(startTag)
  const endIdx = text.indexOf(endTag)
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return { message: text, suggestion: null }
  }
  const before = text.slice(0, startIdx).trim()
  const suggestion = text.slice(startIdx + startTag.length, endIdx).trim()
  const after = text.slice(endIdx + endTag.length).trim()
  const message = [before, after].filter(Boolean).join('\n')
  return { message, suggestion }
}

export function ChatPanel() {
  const {
    chatPanelOpen, toggleChatPanel,
    chatMessages, chatLoading, sendChatMessage,
    activeTabPath, openTabs, selectedModel, availableModels, setSelectedModel,
    canvasSuggestion, acceptCanvasSuggestion, rejectCanvasSuggestion, createFileFromCanvas,
  } = useStore()

  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileKey = activeTabPath || '__global__'
  const messages = chatMessages[fileKey] || []
  const activeTab = openTabs.find(t => t.path === activeTabPath)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const handleSend = () => {
    if (!input.trim() || chatLoading) return
    sendChatMessage(input)
    setInput('')
  }

  if (!chatPanelOpen) {
    // Collapsed — just a thin vertical toggle button on right edge
    return (
      <div className="flex flex-col items-center justify-center w-8 bg-ide-sidebar border-l border-ide-border cursor-pointer hover:bg-ide-hover"
        onClick={toggleChatPanel}
        title="Открыть чат"
      >
        <span className="text-ide-text-dim text-xs" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
          Chat
        </span>
      </div>
    )
  }

  return (
    <div className="w-72 min-w-[260px] flex flex-col bg-ide-sidebar border-l border-ide-border h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-ide-border shrink-0">
        <span className="text-xs font-semibold text-ide-text-dim uppercase">Chat</span>
        {activeTab && (
          <span className="text-xs text-ide-accent truncate">
            {activeTab.name}
          </span>
        )}
        <button
          onClick={toggleChatPanel}
          className="ml-auto text-ide-text-dim hover:text-ide-text text-xs"
        >
          ✕
        </button>
      </div>

      {/* Model selector */}
      <div className="px-3 py-1.5 border-b border-ide-border shrink-0">
        <select
          value={selectedModel || ''}
          onChange={e => setSelectedModel(e.target.value)}
          className="w-full bg-ide-bg border border-ide-border rounded px-2 py-1 text-xs outline-none"
        >
          {availableModels.map(m => (
            <option key={m.id} value={m.id}>{m.name} ({m.provider})</option>
          ))}
          {availableModels.length === 0 && (
            <option value="">⚠ Нет моделей — добавь API-ключ в .env</option>
          )}
        </select>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3 min-h-0">
        {messages.length === 0 && (
          <p className="text-xs text-ide-text-dim">
            {activeTab
              ? `Задай вопрос о файле ${activeTab.name}`
              : 'Откройте файл чтобы начать беседу'}
          </p>
        )}
        {messages.map(msg => {
          if (msg.role === 'user') {
            return (
              <div key={msg.id} className="flex flex-col items-end">
                <div className="rounded px-2.5 py-1.5 text-xs max-w-[90%] whitespace-pre-wrap bg-ide-accent text-white">
                  {msg.text}
                </div>
              </div>
            )
          }
          if (msg.text.startsWith('❌')) {
            return (
              <div key={msg.id} className="flex flex-col items-start">
                <div className="rounded px-2.5 py-1.5 text-xs max-w-[90%] whitespace-pre-wrap bg-red-900/40 text-red-300 border border-red-700">
                  {msg.text}
                </div>
              </div>
            )
          }
          const { message, suggestion: suggestedContent } = parseSuggestion(msg.text)
          const hasSuggestion = suggestedContent !== null && msg.suggestion
          return (
            <div key={msg.id} className="flex flex-col items-start gap-1">
              {message && (
                <div className="rounded px-2.5 py-1.5 text-xs max-w-[90%] whitespace-pre-wrap bg-ide-tab text-ide-text border border-ide-border">
                  {message}
                </div>
              )}
              {hasSuggestion && (
                <div className="w-full rounded border border-ide-border bg-ide-bg p-2">
                  <div className="text-[10px] text-ide-text-dim mb-1 uppercase font-semibold">Предложение изменений</div>
                  <pre className="text-[11px] text-green-400 bg-ide-sidebar rounded p-2 overflow-x-auto max-h-40 mb-2 whitespace-pre-wrap">{suggestedContent}</pre>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        // Apply: set canvasSuggestion and accept
                        useStore.setState({ canvasSuggestion: { ...msg.suggestion!, result_text: suggestedContent! } })
                        acceptCanvasSuggestion()
                      }}
                      className="px-2 py-1 text-[11px] bg-green-700 hover:bg-green-600 text-white rounded"
                    >
                      ✓ Применить
                    </button>
                    <button
                      onClick={() => {
                        const newPath = prompt('Путь для нового файла:')
                        if (newPath) {
                          useStore.setState({ canvasSuggestion: { ...msg.suggestion!, result_text: suggestedContent! } })
                          createFileFromCanvas(newPath)
                        }
                      }}
                      className="px-2 py-1 text-[11px] bg-blue-700 hover:bg-blue-600 text-white rounded"
                    >
                      + Новый файл
                    </button>
                    <button
                      onClick={() => {
                        if (msg.suggestion) {
                          useStore.getState().rejectCanvasSuggestion()
                        }
                      }}
                      className="px-2 py-1 text-[11px] bg-ide-sidebar hover:bg-ide-hover text-ide-text-dim rounded border border-ide-border"
                    >
                      ✕ Отмена
                    </button>
                  </div>
                </div>
              )}
              {!hasSuggestion && suggestedContent && (
                <div className="rounded px-2.5 py-1.5 text-xs max-w-[90%] whitespace-pre-wrap bg-ide-tab text-ide-text border border-ide-border">
                  {suggestedContent}
                </div>
              )}
            </div>
          )
        })}
        {chatLoading && (
          <div className="flex items-start">
            <div className="bg-ide-tab border border-ide-border rounded px-2.5 py-1.5 text-xs text-ide-text-dim animate-pulse">
              ...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-2 border-t border-ide-border shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Спроси о документе..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            disabled={chatLoading}
            className="flex-1 bg-ide-bg border border-ide-border rounded px-2 py-1.5 text-xs outline-none focus:border-ide-accent disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={chatLoading || !input.trim()}
            className="px-3 py-1.5 bg-ide-accent text-white text-xs rounded disabled:opacity-50"
          >
            ▶
          </button>
        </div>
      </div>
    </div>
  )
}
