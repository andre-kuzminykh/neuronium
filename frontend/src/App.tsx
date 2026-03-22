import { useEffect } from 'react'
import { useStore } from './store/useStore'
import { Sidebar } from './components/layout/Sidebar'
import { EditorArea } from './components/editor/EditorArea'
import { AiPanel } from './components/ai-panel/AiPanel'
import { CommandBar } from './components/command-bar/CommandBar'
import { ConnectRepoDialog } from './components/common/ConnectRepoDialog'

export default function App() {
  const { activeRepo, aiPanelOpen, restoreSession, loadModels, persistSession } = useStore()

  useEffect(() => {
    restoreSession()
    loadModels()
  }, [])

  // Persist session on changes
  useEffect(() => {
    const timer = setTimeout(() => persistSession(), 2000)
    return () => clearTimeout(timer)
  })

  // Keyboard shortcut: Ctrl+S to save
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

  if (!activeRepo) {
    return <ConnectRepoDialog />
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-ide-bg text-ide-text">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        {!aiPanelOpen && <CommandBar />}
        <EditorArea />
      </div>
      {aiPanelOpen && <AiPanel />}
    </div>
  )
}
