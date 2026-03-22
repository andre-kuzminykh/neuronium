import { useState } from 'react'
import { useStore } from '../../store/useStore'
import type { FileNode } from '../../types'

interface Props {
  node: FileNode
  depth: number
}

export function FileTreeNode({ node, depth }: Props) {
  const [expanded, setExpanded] = useState(false)
  const { openFile } = useStore()

  const handleClick = () => {
    if (node.is_dir) {
      setExpanded(!expanded)
    } else {
      openFile(node.path, node.name)
    }
  }

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/neuronium-file', JSON.stringify({
      path: node.path,
      name: node.name,
      is_dir: node.is_dir,
    }))
    e.dataTransfer.effectAllowed = 'copyMove'
  }

  return (
    <div>
      <div
        className="flex items-center px-2 py-0.5 cursor-pointer hover:bg-ide-hover select-none"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        draggable={!node.is_dir}
        onDragStart={handleDragStart}
      >
        <span className="mr-1.5 text-xs w-4 text-center">
          {node.is_dir ? (expanded ? '▾' : '▸') : ''}
        </span>
        <span className="mr-1.5 text-sm">
          {node.is_dir ? '📁' : '📄'}
        </span>
        <span className="text-sm truncate">{node.name}</span>
      </div>
      {node.is_dir && expanded && node.children?.map(child => (
        <FileTreeNode key={child.path} node={child} depth={depth + 1} />
      ))}
    </div>
  )
}
