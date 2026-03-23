const BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.text()
    let detail = body
    try {
      const parsed = JSON.parse(body)
      if (parsed.detail) detail = parsed.detail
    } catch { /* use raw body */ }
    throw new Error(detail || `API error ${res.status}`)
  }
  return res.json()
}

export const api = {
  // Repo
  connectLocal: (path: string) =>
    request('/repo/connect-local', { method: 'POST', body: JSON.stringify({ path }) }),
  connectRemote: (url: string, name?: string) =>
    request('/repo/connect-remote', { method: 'POST', body: JSON.stringify({ url, name }) }),
  getRepo: (repoId: number) =>
    request(`/repo/info?repo_id=${repoId}`),
  getTree: (repoId: number, path = '') =>
    request(`/repo/tree?repo_id=${repoId}&path=${encodeURIComponent(path)}`),
  getFile: (repoId: number, path: string) =>
    request(`/repo/file?repo_id=${repoId}&path=${encodeURIComponent(path)}`),
  saveFile: (repoId: number, path: string, content: string) =>
    request(`/repo/file?repo_id=${repoId}`, { method: 'PUT', body: JSON.stringify({ path, content }) }),
  createFile: (repoId: number, path: string, content = '') =>
    request(`/repo/file/create?repo_id=${repoId}`, { method: 'POST', body: JSON.stringify({ path, content }) }),

  // File links (drag to editor → markdown link)
  createFileLink: (body: {
    repo_id: number; source_file: string; target_file: string;
    position_start?: number; link_text: string;
  }) => request('/repo/file-links', { method: 'POST', body: JSON.stringify(body) }),
  getFileLinks: (repoId: number, sourceFile?: string, targetFile?: string) => {
    const params = new URLSearchParams({ repo_id: String(repoId) })
    if (sourceFile) params.set('source_file', sourceFile)
    if (targetFile) params.set('target_file', targetFile)
    return request(`/repo/file-links?${params}`)
  },

  // Search
  searchFiles: (repoId: number, query: string) =>
    request(`/repo/search?repo_id=${repoId}&query=${encodeURIComponent(query)}`),

  // Git
  gitStatus: (repoId: number) =>
    request(`/repo/git/status?repo_id=${repoId}`),
  gitCommit: (repoId: number, message: string, files?: string[]) =>
    request('/repo/git/commit', { method: 'POST', body: JSON.stringify({ repo_id: repoId, message, files }) }),
  gitPush: (repoId: number) =>
    request('/repo/git/push', { method: 'POST', body: JSON.stringify({ repo_id: repoId }) }),

  // Session
  getSession: () => request('/session/state'),
  saveSession: (state: unknown) =>
    request('/session/state', { method: 'POST', body: JSON.stringify(state) }),

  // AI
  getModels: () => request('/ai/models'),
  executeAi: (body: unknown) =>
    request('/ai/execute', { method: 'POST', body: JSON.stringify(body) }),
  applyAi: (suggestionId: string, repoId: number) =>
    request(`/ai/apply?repo_id=${repoId}`, { method: 'POST', body: JSON.stringify({ suggestion_id: suggestionId }) }),
  rejectAi: (suggestionId: string) =>
    request('/ai/reject', { method: 'POST', body: JSON.stringify({ suggestion_id: suggestionId }) }),
  createFileFromResult: (suggestionId: string, newFilePath: string, repoId: number) =>
    request(`/ai/create-file-from-result?repo_id=${repoId}`, {
      method: 'POST',
      body: JSON.stringify({ suggestion_id: suggestionId, new_file_path: newFilePath }),
    }),
  getAiHistory: (repoId?: number) =>
    request(`/ai/history${repoId ? `?repo_id=${repoId}` : ''}`),

  // Health
  health: () => request('/health'),
}
