import { useStore } from '../../store/useStore'
import { FileTree } from '../file-tree/FileTree'
import { GitPanel } from '../git/GitPanel'

export function Sidebar() {
  const { activeRepo } = useStore()

  return (
    <div className="w-64 min-w-[200px] bg-ide-sidebar border-r border-ide-border flex flex-col h-full">
      <div className="px-3 py-2 text-xs font-semibold uppercase text-ide-text-dim border-b border-ide-border">
        {activeRepo?.name || 'Explorer'}
      </div>
      <div className="flex-1 overflow-y-auto">
        <FileTree />
      </div>
      <GitPanel />
    </div>
  )
}
