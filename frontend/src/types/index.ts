export interface FileNode {
  name: string
  path: string
  is_dir: boolean
  children?: FileNode[]
}

export interface FileContent {
  path: string
  content: string
  encoding: string
  size: number
  is_binary: boolean
}

export interface RepoInfo {
  id: number
  path: string
  name: string
  is_remote: boolean
}

export interface SessionState {
  active_repo_id: number | null
  open_tabs: string[]
  active_tab: string | null
  selected_model: string | null
  ai_panel_open: boolean
  chat_panel_open: boolean
  file_modes: Record<string, string>
}

export interface AiSuggestion {
  id: string
  file_path: string | null
  scope: string
  selection_start: number | null
  selection_end: number | null
  original_text: string | null
  result_text: string
  diff: string | null
  status: 'pending' | 'accepted' | 'rejected' | 'created_file'
  created_at: string
  model_name: string
  command_text: string
  latency_ms: number | null
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  suggestion?: AiSuggestion
  created_at: string
}

export interface ModelInfo {
  id: string
  name: string
  provider: string
}

export interface AttachedFile {
  path: string
  content: string
}

export type FileMode = 'view' | 'edit'

export interface Tab {
  path: string
  name: string
  dirty: boolean
  mode: FileMode
  content: string
  savedContent: string
  externallyChanged: boolean
}
