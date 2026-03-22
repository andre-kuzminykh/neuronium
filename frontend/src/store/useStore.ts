import { create } from 'zustand'
import type { FileNode, RepoInfo, Tab, AiSuggestion, ModelInfo, AttachedFile, FileMode } from '../types'
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

  // AI Panel (bottom drawer)
  aiPanelOpen: boolean
  toggleAiPanel: () => void
  selectedModel: string | null
  setSelectedModel: (model: string) => void
  availableModels: ModelInfo[]
  loadModels: () => Promise<void>

  // AI Context
  attachedFiles: AttachedFile[]
  addAttachedFile: (file: AttachedFile) => void
  removeAttachedFile: (path: string) => void
  clearAttachedFiles: () => void

  // AI Tool (search)
  activeTool: 'none' | 'search'
  setActiveTool: (tool: 'none' | 'search') => void
  searchScope: SearchScope
  setSearchScope: (scope: SearchScope) => void

  // AI Execution — per-file history
  aiLoading: boolean
  currentSuggestion: AiSuggestion | null
  aiHistoryByFile: Record<string, AiSuggestion[]>  // keyed by file path
  executeAi: (instruction: string) => Promise<void>
  acceptSuggestion: () => Promise<void>
  rejectSuggestion: () => void
  createFileFromSuggestion: (newPath: string) => Promise<void>

  // Session
  restoreSession: () => Promise<void>
  persistSession: () => Promise<void>
}

export const useStore = create<AppState>((set, get) => ({
  // --- Repo ---
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
      console.error('Failed to load tree:', e)
    }
  },

  // --- Tabs ---
  openTabs: [],
  activeTabPath: null,
  openFile: async (path, name) => {
    const repo = get().activeRepo
    if (!repo) return
    const existing = get().openTabs.find(t => t.path === path)
    if (existing) {
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
      console.error('Failed to open file:', e)
    }
  },
  closeTab: (path) => set(s => {
    const tabs = s.openTabs.filter(t => t.path !== path)
    const activeTabPath = s.activeTabPath === path
      ? (tabs.length > 0 ? tabs[tabs.length - 1].path : null)
      : s.activeTabPath
    return { openTabs: tabs, activeTabPath }
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
    if (!tab || !tab.dirty) return
    try {
      await api.saveFile(activeRepo.id, tab.path, tab.content)
      set(s => ({
        openTabs: s.openTabs.map(t =>
          t.path === activeTabPath ? { ...t, dirty: false, savedContent: t.content } : t
        ),
      }))
    } catch (e) {
      console.error('Failed to save:', e)
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

  // --- AI Panel ---
  aiPanelOpen: false,
  toggleAiPanel: () => set(s => ({ aiPanelOpen: !s.aiPanelOpen })),
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
      console.error('Failed to load models:', e)
    }
  },

  // --- AI Context ---
  attachedFiles: [],
  addAttachedFile: (file) => set(s => {
    if (s.attachedFiles.some(f => f.path === file.path)) return s
    return { attachedFiles: [...s.attachedFiles, file] }
  }),
  removeAttachedFile: (path) => set(s => ({
    attachedFiles: s.attachedFiles.filter(f => f.path !== path),
  })),
  clearAttachedFiles: () => set({ attachedFiles: [] }),

  // --- AI Tool ---
  activeTool: 'none',
  setActiveTool: (tool) => set({ activeTool: tool }),
  searchScope: 'files',
  setSearchScope: (scope) => set({ searchScope: scope }),

  // --- AI Execution ---
  aiLoading: false,
  currentSuggestion: null,
  aiHistoryByFile: {},
  executeAi: async (instruction) => {
    const { activeTabPath, openTabs, activeRepo, selectedModel, attachedFiles, activeTool, searchScope } = get()
    if (!activeRepo) return
    const tab = openTabs.find(t => t.path === activeTabPath)
    const fileKey = activeTabPath || '__global__'

    set({ aiLoading: true, currentSuggestion: null })
    try {
      // If search tool: gather context first
      let extraContext: AttachedFile[] = [...attachedFiles]
      if (activeTool === 'search' && searchScope === 'files') {
        try {
          const results = await api.searchFiles(activeRepo.id, instruction) as any[]
          for (const r of results.slice(0, 5)) {
            try {
              const f = await api.getFile(activeRepo.id, r.path) as any
              if (!f.is_binary && !extraContext.some(x => x.path === r.path)) {
                extraContext.push({ path: r.path, content: f.content })
              }
            } catch { /* skip */ }
          }
        } catch { /* skip */ }
      }

      const body: any = {
        instruction,
        model: selectedModel,
        scope: tab ? 'full_file' : 'attached_files',
        attached_files: extraContext,
      }
      if (tab) {
        body.file_path = tab.path
        body.file_type = tab.name.split('.').pop() || 'txt'
        body.full_file_content = tab.content
      }

      const suggestion = await api.executeAi(body) as AiSuggestion
      set(s => ({
        currentSuggestion: suggestion,
        aiLoading: false,
        aiHistoryByFile: {
          ...s.aiHistoryByFile,
          [fileKey]: [suggestion, ...(s.aiHistoryByFile[fileKey] || [])],
        },
      }))
    } catch (e) {
      console.error('AI execution failed:', e)
      set({ aiLoading: false })
    }
  },
  acceptSuggestion: async () => {
    const { currentSuggestion, activeRepo } = get()
    if (!currentSuggestion || !activeRepo) return
    try {
      await api.applyAi(currentSuggestion.id, activeRepo.id)
      if (currentSuggestion.file_path) {
        const file = await api.getFile(activeRepo.id, currentSuggestion.file_path) as any
        set(s => ({
          currentSuggestion: { ...currentSuggestion, status: 'accepted' },
          openTabs: s.openTabs.map(t =>
            t.path === currentSuggestion.file_path
              ? { ...t, content: file.content, savedContent: file.content, dirty: false }
              : t
          ),
        }))
      }
    } catch (e) {
      console.error('Accept failed:', e)
    }
  },
  rejectSuggestion: () => {
    const { currentSuggestion } = get()
    if (!currentSuggestion) return
    api.rejectAi(currentSuggestion.id).catch(console.error)
    set(s => ({
      currentSuggestion: { ...currentSuggestion, status: 'rejected' },
    }))
  },
  createFileFromSuggestion: async (newPath) => {
    const { currentSuggestion, activeRepo } = get()
    if (!currentSuggestion || !activeRepo) return
    try {
      await api.createFileFromResult(currentSuggestion.id, newPath, activeRepo.id)
      set({ currentSuggestion: { ...currentSuggestion, status: 'created_file' } })
      get().loadTree()
    } catch (e) {
      console.error('Create file failed:', e)
    }
  },

  // --- Session ---
  restoreSession: async () => {
    try {
      const session = await api.getSession() as any
      if (session.selected_model) set({ selectedModel: session.selected_model })
      if (typeof session.ai_panel_open === 'boolean') set({ aiPanelOpen: session.ai_panel_open })
    } catch (e) {
      console.error('Session restore failed:', e)
    }
  },
  persistSession: async () => {
    const { activeRepo, openTabs, activeTabPath, selectedModel, aiPanelOpen } = get()
    try {
      await api.saveSession({
        active_repo_id: activeRepo?.id ?? null,
        open_tabs: openTabs.map(t => t.path),
        active_tab: activeTabPath,
        selected_model: selectedModel,
        ai_panel_open: aiPanelOpen,
        file_modes: Object.fromEntries(openTabs.map(t => [t.path, t.mode])),
      })
    } catch (e) {
      console.error('Session persist failed:', e)
    }
  },
}))
