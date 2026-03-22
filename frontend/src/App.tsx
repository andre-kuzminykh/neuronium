import { useEffect } from 'react'
import { useStore } from './store/useStore'
import { Sidebar } from './components/layout/Sidebar'
import { EditorArea } from './components/editor/EditorArea'
import { ChatPanel } from './components/ai-panel/ChatPanel'
import { TaskBar } from './components/task-bar/TaskBar'
import { ConnectRepoDialog } from './components/common/ConnectRepoDialog'

export default function App() {
  const { activeRepo, restoreSession, loadModels, persistSession } = useStore()

  useEffect(() => {
    restoreSession()
    loadModels()
  }, [])

  // Persist session debounced
  useEffect(() => {
    const t = setTimeout(() => persistSession(), 2000)
    return () => clearTimeout(t)
  })

  // Ctrl+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        useStore.getState().saveActiveFile()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  if (!activeRepo) return <ConnectRepoDialog />

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-ide-bg text-ide-text">
      {/* Left: file tree */}
      <Sidebar />

      {/* Center + bottom: editor area + task bar */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <EditorArea />
        <TaskBar />
      </div>

      {/* Right: chat panel (toggleable) */}
      <ChatPanel />
    </div>
  )
}
