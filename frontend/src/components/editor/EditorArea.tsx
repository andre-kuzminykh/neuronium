import { useStore } from '../../store/useStore'
import { TabBar } from './TabBar'
import { MonacoEditor } from './MonacoEditor'
import { SuggestionOverlay } from './SuggestionOverlay'

export function EditorArea() {
  const { openTabs, activeTabPath, openFile } = useStore()
  const activeTab = openTabs.find(t => t.path === activeTabPath)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const data = e.dataTransfer.getData('application/neuronium-file')
    if (data) {
      const file = JSON.parse(data)
      if (!file.is_dir) {
        openFile(file.path, file.name)
      }
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  return (
    <div
      className="flex flex-col flex-1 min-h-0"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <TabBar />
      {activeTab ? (
        <div className="flex-1 relative min-h-0">
          <MonacoEditor tab={activeTab} />
          <SuggestionOverlay />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-ide-text-dim">
          <div className="text-center">
            <p className="text-lg mb-2">Neuronium</p>
            <p className="text-sm">Open a file from the sidebar or drag it here</p>
          </div>
        </div>
      )}
    </div>
  )
}
