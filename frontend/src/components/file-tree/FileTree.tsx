import { useStore } from '../../store/useStore'
import { FileTreeNode } from './FileTreeNode'

export function FileTree() {
  const { fileTree } = useStore()

  if (fileTree.length === 0) {
    return <div className="px-3 py-2 text-ide-text-dim text-xs">No files</div>
  }

  return (
    <div className="py-1">
      {fileTree.map(node => (
        <FileTreeNode key={node.path} node={node} depth={0} />
      ))}
    </div>
  )
}
