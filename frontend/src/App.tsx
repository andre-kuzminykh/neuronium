import { useEffect } from 'react'
import { useStore } from './store/useStore'
import { Sidebar } from './components/layout/Sidebar'
import { EditorArea } from './components/editor/EditorArea'
import { AiBottomPanel } from './components/ai-panel/AiBottomPanel'
import { ConnectRepoDialog } from './components/common/ConnectRepoDialog'

export default function App() {
  const { activeRepo, restoreSession, loadModels, persistSession } = useStore()

  useEffect(() => {
    restoreSession()
    loadModels()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => persistSession(), 2000)
    return () => clearTimeout(timer)
  })

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
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <EditorArea />
        <AiBottomPanel />
      </div>
    </div>
  )
}
