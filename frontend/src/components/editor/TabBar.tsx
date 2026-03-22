import { useStore } from '../../store/useStore'

export function TabBar() {
  const { openTabs, activeTabPath, setActiveTab, closeTab, toggleFileMode, toggleChatPanel, chatPanelOpen } = useStore()

  return (
    <div className="flex items-center bg-ide-tab border-b border-ide-border overflow-hidden">
      {/* Tabs (scrollable) */}
      <div className="flex items-center overflow-x-auto flex-1 min-w-0">
        {openTabs.map(tab => (
          <div
            key={tab.path}
            className={`flex items-center gap-1 px-3 py-1.5 text-sm cursor-pointer border-r border-ide-border select-none shrink-0 ${
              tab.path === activeTabPath
                ? 'bg-ide-tab-active text-ide-text'
                : 'text-ide-text-dim hover:text-ide-text'
            }`}
            onClick={() => setActiveTab(tab.path)}
          >
            <span className="truncate max-w-[120px]">{tab.name}</span>
            {tab.dirty && <span className="text-ide-warning" title="Unsaved changes">●</span>}
            {tab.externallyChanged && <span className="text-ide-error" title="Changed externally">⚠</span>}
            <button
              className="ml-1 text-ide-text-dim hover:text-ide-text text-xs"
              onClick={e => { e.stopPropagation(); closeTab(tab.path) }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Right controls: View/Edit toggle + Chat toggle */}
      <div className="flex items-center gap-1 px-2 shrink-0 border-l border-ide-border">
        {openTabs.find(t => t.path === activeTabPath) && (
          <button
            className={`px-2 py-0.5 text-xs rounded border ${
              openTabs.find(t => t.path === activeTabPath)?.mode === 'edit'
                ? 'bg-ide-accent text-white border-ide-accent'
                : 'bg-ide-tab text-ide-text-dim border-ide-border hover:border-ide-accent'
            }`}
            onClick={() => activeTabPath && toggleFileMode(activeTabPath)}
            title="Toggle View / Edit mode"
          >
            {openTabs.find(t => t.path === activeTabPath)?.mode === 'edit' ? 'Edit' : 'View'}
          </button>
        )}
        <button
          onClick={toggleChatPanel}
          className={`px-2 py-0.5 text-xs rounded border ${
            chatPanelOpen
              ? 'bg-ide-accent/20 text-ide-accent border-ide-accent'
              : 'text-ide-text-dim border-ide-border hover:border-ide-accent'
          }`}
          title="Toggle Chat panel"
        >
          Chat
        </button>
      </div>
    </div>
  )
}
