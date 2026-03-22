import { useStore } from '../../store/useStore'
import { TabBar } from './TabBar'
import { MonacoEditor } from './MonacoEditor'

export function EditorArea() {
  const { openTabs, activeTabPath, openFile } = useStore()
  const activeTab = openTabs.find(t => t.path === activeTabPath)

  // Drag file onto editor area → open file (not markdown link — that's handled in Monaco directly)
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

  return (
    <div
      className="flex flex-col flex-1 min-h-0"
      onDrop={handleDrop}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
    >
      <TabBar />
      {activeTab ? (
        <div className="flex-1 relative min-h-0">
          <MonacoEditor tab={activeTab} />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-ide-text-dim">
          <div className="text-center">
            <p className="text-lg mb-2">Neuronium</p>
            <p className="text-sm">Откройте файл из дерева или перетащите его сюда</p>
            <p className="text-xs mt-2 opacity-60">Перетащи файл прямо в текст для создания markdown-ссылки</p>
          </div>
        </div>
      )}
    </div>
  )
}
