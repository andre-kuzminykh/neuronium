import Editor, { OnMount } from '@monaco-editor/react'
import { useStore } from '../../store/useStore'
import { api } from '../../api/client'
import type { Tab } from '../../types'

const LANGUAGE_MAP: Record<string, string> = {
  md: 'markdown', txt: 'plaintext', json: 'json',
  yaml: 'yaml', yml: 'yaml',
  ts: 'typescript', tsx: 'typescriptreact',
  js: 'javascript', jsx: 'javascriptreact',
  py: 'python', html: 'html', css: 'css',
  sql: 'sql', sh: 'shell',
}

function getLanguage(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  return LANGUAGE_MAP[ext] || 'plaintext'
}

interface Props {
  tab: Tab
}

export function MonacoEditor({ tab }: Props) {
  const { updateTabContent, activeRepo } = useStore()
  const language = getLanguage(tab.name)
  const readOnly = tab.mode === 'view'

  const handleMount: OnMount = (editor) => {
    const domNode = editor.getDomNode()
    if (!domNode) return

    domNode.addEventListener('dragover', (e) => {
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    })

    domNode.addEventListener('drop', async (e) => {
      e.preventDefault()
      const data = e.dataTransfer?.getData('application/neuronium-file')
      if (!data) return

      const file = JSON.parse(data)
      if (file.is_dir) return

      // Get editor position at drop point
      const target = editor.getTargetAtClientPoint(e.clientX, e.clientY)
      if (!target?.position) return

      const { lineNumber, column } = target.position
      const markdownLink = `[${file.name}](${file.path})`

      // Insert the markdown link
      editor.executeEdits('neuronium-drag-link', [{
        range: {
          startLineNumber: lineNumber,
          startColumn: column,
          endLineNumber: lineNumber,
          endColumn: column,
        },
        text: markdownLink,
        forceMoveMarkers: true,
      }])

      // Focus editor after insert
      editor.focus()

      // Save link relationship to DB
      if (activeRepo && tab.path) {
        const model = editor.getModel()
        const posOffset = model?.getOffsetAt({ lineNumber, column }) ?? undefined
        try {
          await api.createFileLink({
            repo_id: activeRepo.id,
            source_file: tab.path,
            target_file: file.path,
            position_start: posOffset,
            link_text: markdownLink,
          })
        } catch (e) {
          console.error('Failed to save file link:', e)
        }
      }
    })
  }

  return (
    <Editor
      height="100%"
      language={language}
      value={tab.content}
      theme="vs-dark"
      onChange={(value) => {
        if (value !== undefined && !readOnly) {
          updateTabContent(tab.path, value)
        }
      }}
      onMount={handleMount}
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 13,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        automaticLayout: true,
        renderWhitespace: 'selection',
        tabSize: 2,
        // Allow drops into the editor
        dragAndDrop: false,  // disable Monaco's built-in drag so ours works
      }}
    />
  )
}
