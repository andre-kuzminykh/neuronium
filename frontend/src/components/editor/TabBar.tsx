import { useStore } from '../../store/useStore'

export function TabBar() {
  const { openTabs, activeTabPath, setActiveTab, closeTab, toggleFileMode } = useStore()

  if (openTabs.length === 0) return null

  return (
    <div className="flex items-center bg-ide-tab border-b border-ide-border overflow-x-auto">
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
          {tab.dirty && <span className="text-ide-warning ml-0.5">●</span>}
          {tab.externallyChanged && <span className="text-ide-error ml-0.5" title="Changed externally">⚠</span>}
          <button
            className="ml-1 text-ide-text-dim hover:text-ide-text text-xs"
            onClick={(e) => { e.stopPropagation(); closeTab(tab.path) }}
          >
            ✕
          </button>
        </div>
      ))}

      {/* View/Edit toggle for active tab */}
      {openTabs.find(t => t.path === activeTabPath) && (
        <div className="ml-auto px-2 flex items-center shrink-0">
          <button
            className={`px-2 py-0.5 text-xs rounded border ${
              openTabs.find(t => t.path === activeTabPath)?.mode === 'edit'
                ? 'bg-ide-accent text-white border-ide-accent'
                : 'bg-ide-tab text-ide-text-dim border-ide-border'
            }`}
            onClick={() => activeTabPath && toggleFileMode(activeTabPath)}
          >
            {openTabs.find(t => t.path === activeTabPath)?.mode === 'edit' ? 'Edit' : 'View'}
          </button>
        </div>
      )}
    </div>
  )
}
