const BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`API error ${res.status}: ${body}`)
  }
  return res.json()
}

export const api = {
  // Repo
  connectLocal: (path: string) =>
    request('/repo/connect-local', { method: 'POST', body: JSON.stringify({ path }) }),
  connectRemote: (url: string, name?: string) =>
    request('/repo/connect-remote', { method: 'POST', body: JSON.stringify({ url, name }) }),
  getTree: (repoId: number, path = '') =>
    request(`/repo/tree?repo_id=${repoId}&path=${encodeURIComponent(path)}`),
  getFile: (repoId: number, path: string) =>
    request(`/repo/file?repo_id=${repoId}&path=${encodeURIComponent(path)}`),
  saveFile: (repoId: number, path: string, content: string) =>
    request(`/repo/file?repo_id=${repoId}`, { method: 'PUT', body: JSON.stringify({ path, content }) }),
  createFile: (repoId: number, path: string, content = '') =>
    request(`/repo/file/create?repo_id=${repoId}`, { method: 'POST', body: JSON.stringify({ path, content }) }),

  // Session
  getSession: () => request('/session/state'),
  saveSession: (state: any) =>
    request('/session/state', { method: 'POST', body: JSON.stringify(state) }),

  // AI
  getModels: () => request('/ai/models'),
  executeAi: (body: any) =>
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
