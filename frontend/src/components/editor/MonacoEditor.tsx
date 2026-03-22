import Editor from '@monaco-editor/react'
import { useStore } from '../../store/useStore'
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
  const { updateTabContent } = useStore()
  const language = getLanguage(tab.name)
  const readOnly = tab.mode === 'view'

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
      }}
    />
  )
}
