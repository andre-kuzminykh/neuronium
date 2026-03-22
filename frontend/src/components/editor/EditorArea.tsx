import { useStore } from '../../store/useStore'
import { TabBar } from './TabBar'
import { MonacoEditor } from './MonacoEditor'
import { CanvasOverlay } from './CanvasOverlay'

export function EditorArea() {
  const { openTabs, activeTabPath, openFile } = useStore()
  const activeTab = openTabs.find(t => t.path === activeTabPath)

  // Drop on editor area (not inside monaco text) → open file
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const data = e.dataTransfer.getData('application/neuronium-file')
    if (data) {
      const file = JSON.parse(data)
      if (!file.is_dir) openFile(file.path, file.name)
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
          <CanvasOverlay />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-ide-text-dim">
          <div className="text-center space-y-1">
            <p className="text-base">Neuronium</p>
            <p className="text-sm">Откройте файл из дерева или перетащите его сюда</p>
            <p className="text-xs opacity-60">Перетащи файл прямо в текст → вставится markdown-ссылка</p>
            <p className="text-xs opacity-60">Перетащи файл в Task bar → вставится ссылка в задачу</p>
          </div>
        </div>
      )}
    </div>
  )
}
