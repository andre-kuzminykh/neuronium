import { useState, useRef, useEffect } from 'react'
import { useStore } from '../../store/useStore'
import type { FileNode } from '../../types'

interface Props {
  onSelect: (path: string, name: string) => void
}

function flattenFiles(nodes: FileNode[]): { path: string; name: string }[] {
  const result: { path: string; name: string }[] = []
  for (const node of nodes) {
    if (node.is_dir) {
      if (node.children) result.push(...flattenFiles(node.children))
    } else {
      result.push({ path: node.path, name: node.name })
    }
  }
  return result
}

export function FilePickerDropdown({ onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const { fileTree } = useStore()

  const allFiles = flattenFiles(fileTree)
  const filtered = filter
    ? allFiles.filter(f => f.path.toLowerCase().includes(filter.toLowerCase()))
    : allFiles

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="px-1.5 py-1.5 text-sm text-ide-text-dim hover:text-ide-accent hover:bg-ide-hover rounded transition-colors"
        title="Прикрепить файл"
        type="button"
      >
        📎
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-64 max-h-52 bg-ide-sidebar border border-ide-border rounded shadow-lg z-50 flex flex-col">
          <input
            autoFocus
            type="text"
            placeholder="Поиск файла..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="px-2 py-1.5 text-xs bg-ide-bg border-b border-ide-border outline-none shrink-0"
          />
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 && (
              <div className="px-2 py-2 text-xs text-ide-text-dim">Файлы не найдены</div>
            )}
            {filtered.slice(0, 50).map(f => (
              <button
                key={f.path}
                onClick={() => {
                  onSelect(f.path, f.name)
                  setOpen(false)
                  setFilter('')
                }}
                className="w-full text-left px-2 py-1 text-xs hover:bg-ide-hover truncate"
                title={f.path}
              >
                📄 <span className="text-ide-text">{f.name}</span>
                <span className="text-ide-text-dim ml-1">{f.path}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
