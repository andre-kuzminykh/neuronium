import { create } from 'zustand'
import type {
  FileNode, RepoInfo, Tab, AiSuggestion, ModelInfo,
  AttachedFile, FileMode, ChatMessage,
} from '../types'
import { api } from '../api/client'

export type SearchScope = 'files' | 'internet'

interface AppState {
  // Repo
  activeRepo: RepoInfo | null
  fileTree: FileNode[]
  setActiveRepo: (repo: RepoInfo) => void
  loadTree: () => Promise<void>

  // Tabs
  openTabs: Tab[]
  activeTabPath: string | null
  openFile: (path: string, name: string) => Promise<void>
  closeTab: (path: string) => void
  setActiveTab: (path: string) => void
  updateTabContent: (path: string, content: string) => void
  saveActiveFile: () => Promise<void>
  toggleFileMode: (path: string) => void
  getActiveTab: () => Tab | undefined

  // Chat panel (right) - conversational
  chatPanelOpen: boolean
  toggleChatPanel: () => void
  chatMessages: Record<string, ChatMessage[]>   // keyed by file path
  chatLoading: boolean
  sendChatMessage: (text: string) => Promise<void>

  // Task bar (bottom) - canvas mode
  taskBarOpen: boolean
  toggleTaskBar: () => void
  taskInstruction: string
  setTaskInstruction: (v: string) => void
  taskAttachedFiles: AttachedFile[]
  addTaskFile: (file: AttachedFile) => void
  removeTaskFile: (path: string) => void
  activeTool: 'none' | 'search'
  setActiveTool: (t: 'none' | 'search') => void
  searchScope: SearchScope
  setSearchScope: (s: SearchScope) => void
  runTask: () => Promise<void>
  taskLoading: boolean

  // Canvas suggestion (shown overlaid on editor)
  canvasSuggestion: AiSuggestion | null
  acceptCanvasSuggestion: () => Promise<void>
  rejectCanvasSuggestion: () => void
  createFileFromCanvas: (newPath: string) => Promise<void>

  // AI error
  aiError: string | null
  clearAiError: () => void

  // Model
  selectedModel: string | null
  setSelectedModel: (model: string) => void
  availableModels: ModelInfo[]
  loadModels: () => Promise<void>

  // Session
  restoreSession: () => Promise<void>
  persistSession: () => Promise<void>
}

function makeId() {
  return Math.random().toString(36).slice(2)
}

export const useStore = create<AppState>((set, get) => ({
  // ── Repo ──────────────────────────────────────────────────────────────────
  activeRepo: null,
  fileTree: [],
  setActiveRepo: (repo) => {
    set({ activeRepo: repo })
    setTimeout(() => get().loadTree(), 0)
  },
  loadTree: async () => {
    const repo = get().activeRepo
    if (!repo) return
    try {
      const tree = await api.getTree(repo.id) as FileNode[]
      set({ fileTree: tree })
    } catch (e) {
      console.error('load tree:', e)
    }
  },

  // ── Tabs ──────────────────────────────────────────────────────────────────
  openTabs: [],
  activeTabPath: null,
  openFile: async (path, name) => {
    const repo = get().activeRepo
    if (!repo) return
    if (get().openTabs.find(t => t.path === path)) {
      set({ activeTabPath: path })
      return
    }
    try {
      const file = await api.getFile(repo.id, path) as any
      if (file.is_binary) {
        alert('Формат не поддерживается в MVP')
        return
      }
      const tab: Tab = {
        path, name, dirty: false, mode: 'view',
        content: file.content, savedContent: file.content,
        externallyChanged: false,
      }
      set(s => ({ openTabs: [...s.openTabs, tab], activeTabPath: path }))
    } catch (e) {
      console.error('open file:', e)
    }
  },
  closeTab: (path) => set(s => {
    const tabs = s.openTabs.filter(t => t.path !== path)
    return {
      openTabs: tabs,
      activeTabPath: s.activeTabPath === path
        ? (tabs.length > 0 ? tabs[tabs.length - 1].path : null)
        : s.activeTabPath,
    }
  }),
  setActiveTab: (path) => set({ activeTabPath: path }),
  updateTabContent: (path, content) => set(s => ({
    openTabs: s.openTabs.map(t =>
      t.path === path ? { ...t, content, dirty: content !== t.savedContent } : t
    ),
  })),
  saveActiveFile: async () => {
    const { activeTabPath, openTabs, activeRepo } = get()
    if (!activeTabPath || !activeRepo) return
    const tab = openTabs.find(t => t.path === activeTabPath)
    if (!tab?.dirty) return
    try {
      await api.saveFile(activeRepo.id, tab.path, tab.content)
      set(s => ({
        openTabs: s.openTabs.map(t =>
          t.path === activeTabPath ? { ...t, dirty: false, savedContent: t.content } : t
        ),
      }))
    } catch (e) {
      console.error('save:', e)
    }
  },
  toggleFileMode: (path) => set(s => ({
    openTabs: s.openTabs.map(t =>
      t.path === path ? { ...t, mode: t.mode === 'view' ? 'edit' : 'view' } : t
    ),
  })),
  getActiveTab: () => {
    const { activeTabPath, openTabs } = get()
    return openTabs.find(t => t.path === activeTabPath)
  },

  // ── Chat Panel (right, conversational) ────────────────────────────────────
  chatPanelOpen: false,
  toggleChatPanel: () => set(s => ({ chatPanelOpen: !s.chatPanelOpen })),
  chatMessages: {},
  chatLoading: false,
  sendChatMessage: async (text) => {
    const { activeTabPath, openTabs, activeRepo, selectedModel } = get()
    const tab = openTabs.find(t => t.path === activeTabPath)
    const fileKey = activeTabPath || '__global__'

    const userMsg: ChatMessage = {
      id: makeId(), role: 'user', text,
      created_at: new Date().toISOString(),
    }
    set(s => ({
      chatMessages: {
        ...s.chatMessages,
        [fileKey]: [...(s.chatMessages[fileKey] || []), userMsg],
      },
      chatLoading: true,
      aiError: null,
    }))

    try {
      const body: any = {
        instruction: text,
        model: selectedModel,
        scope: tab ? 'full_file' : 'attached_files',
        attached_files: [],
      }
      if (tab) {
        body.file_path = tab.path
        body.file_type = tab.name.split('.').pop() || 'txt'
        body.full_file_content = tab.content
      }

      const suggestion = await api.executeAi(body) as AiSuggestion
      const assistantMsg: ChatMessage = {
        id: makeId(), role: 'assistant',
        text: suggestion.result_text,
        suggestion,
        created_at: new Date().toISOString(),
      }
      set(s => ({
        chatMessages: {
          ...s.chatMessages,
          [fileKey]: [...(s.chatMessages[fileKey] || []), assistantMsg],
        },
        chatLoading: false,
      }))
    } catch (e: any) {
      const errMsg = e?.message || 'AI error'
      set(s => ({
        chatMessages: {
          ...s.chatMessages,
          [fileKey]: [...(s.chatMessages[fileKey] || []), {
            id: makeId(), role: 'assistant',
            text: `❌ ${errMsg}`,
            created_at: new Date().toISOString(),
          }],
        },
        chatLoading: false,
        aiError: errMsg,
      }))
    }
  },

  // ── Task Bar (bottom, canvas mode) ────────────────────────────────────────
  taskBarOpen: true,
  toggleTaskBar: () => set(s => ({ taskBarOpen: !s.taskBarOpen })),
  taskInstruction: '',
  setTaskInstruction: (v) => set({ taskInstruction: v }),
  taskAttachedFiles: [],
  addTaskFile: (file) => set(s => {
    if (s.taskAttachedFiles.some(f => f.path === file.path)) return s
    return { taskAttachedFiles: [...s.taskAttachedFiles, file] }
  }),
  removeTaskFile: (path) => set(s => ({
    taskAttachedFiles: s.taskAttachedFiles.filter(f => f.path !== path),
  })),
  activeTool: 'none',
  setActiveTool: (t) => set({ activeTool: t }),
  searchScope: 'files',
  setSearchScope: (s) => set({ searchScope: s }),
  taskLoading: false,
  runTask: async () => {
    const {
      taskInstruction, openTabs, activeTabPath, activeRepo,
      selectedModel, taskAttachedFiles, activeTool, searchScope,
    } = get()
    if (!taskInstruction.trim() || !activeRepo) return
    const tab = openTabs.find(t => t.path === activeTabPath)

    set({ taskLoading: true, canvasSuggestion: null, aiError: null })
    try {
      let contextFiles = [...taskAttachedFiles]

      // Search tool: auto-gather file context
      if (activeTool === 'search' && searchScope === 'files') {
        const results = await api.searchFiles(activeRepo.id, taskInstruction) as any[]
        for (const r of results.slice(0, 5)) {
          if (contextFiles.some(f => f.path === r.path)) continue
          try {
            const f = await api.getFile(activeRepo.id, r.path) as any
            if (!f.is_binary) contextFiles.push({ path: r.path, content: f.content })
          } catch { /* skip */ }
        }
      }

      const body: any = {
        instruction: taskInstruction,
        model: selectedModel,
        scope: tab ? 'full_file' : 'attached_files',
        attached_files: contextFiles,
      }
      if (tab) {
        body.file_path = tab.path
        body.file_type = tab.name.split('.').pop() || 'txt'
        body.full_file_content = tab.content
      }

      const suggestion = await api.executeAi(body) as AiSuggestion
      set({ canvasSuggestion: suggestion, taskLoading: false })
    } catch (e: any) {
      const errMsg = e?.message || 'AI error'
      set({ taskLoading: false, aiError: errMsg })
    }
  },

  // ── Canvas Suggestion ──────────────────────────────────────────────────────
  canvasSuggestion: null,
  acceptCanvasSuggestion: async () => {
    const { canvasSuggestion, activeRepo } = get()
    if (!canvasSuggestion || !activeRepo) return
    try {
      await api.applyAi(canvasSuggestion.id, activeRepo.id)
      if (canvasSuggestion.file_path) {
        const file = await api.getFile(activeRepo.id, canvasSuggestion.file_path) as any
        set(s => ({
          canvasSuggestion: { ...canvasSuggestion, status: 'accepted' },
          openTabs: s.openTabs.map(t =>
            t.path === canvasSuggestion.file_path
              ? { ...t, content: file.content, savedContent: file.content, dirty: false }
              : t
          ),
        }))
      }
    } catch (e: any) {
      set({ aiError: e?.message || 'Apply failed' })
    }
  },
  rejectCanvasSuggestion: () => {
    const { canvasSuggestion } = get()
    if (!canvasSuggestion) return
    api.rejectAi(canvasSuggestion.id).catch(console.error)
    set({ canvasSuggestion: null })
  },
  createFileFromCanvas: async (newPath) => {
    const { canvasSuggestion, activeRepo } = get()
    if (!canvasSuggestion || !activeRepo) return
    try {
      await api.createFileFromResult(canvasSuggestion.id, newPath, activeRepo.id)
      set({ canvasSuggestion: { ...canvasSuggestion, status: 'created_file' } })
      get().loadTree()
    } catch (e: any) {
      set({ aiError: e?.message || 'Create file failed' })
    }
  },

  // ── AI Error ──────────────────────────────────────────────────────────────
  aiError: null,
  clearAiError: () => set({ aiError: null }),

  // ── Model ──────────────────────────────────────────────────────────────────
  selectedModel: null,
  setSelectedModel: (model) => set({ selectedModel: model }),
  availableModels: [],
  loadModels: async () => {
    try {
      const models = await api.getModels() as ModelInfo[]
      set({ availableModels: models })
      if (models.length > 0 && !get().selectedModel) {
        set({ selectedModel: models[0].id })
      }
    } catch (e) {
      console.error('load models:', e)
    }
  },

  // ── Session ────────────────────────────────────────────────────────────────
  restoreSession: async () => {
    try {
      const s = await api.getSession() as any
      if (s.selected_model) set({ selectedModel: s.selected_model })
      if (typeof s.chat_panel_open === 'boolean') set({ chatPanelOpen: s.chat_panel_open })
    } catch { /* fresh start */ }
  },
  persistSession: async () => {
    const { activeRepo, openTabs, activeTabPath, selectedModel, chatPanelOpen } = get()
    try {
      await api.saveSession({
        active_repo_id: activeRepo?.id ?? null,
        open_tabs: openTabs.map(t => t.path),
        active_tab: activeTabPath,
        selected_model: selectedModel,
        ai_panel_open: false,
        chat_panel_open: chatPanelOpen,
        file_modes: Object.fromEntries(openTabs.map(t => [t.path, t.mode])),
      })
    } catch { /* best effort */ }
  },
}))
