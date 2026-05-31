import { toBase64 } from './base64Utils'

export interface SyncFileParams {
  token: string
  owner: string
  repo: string
  filePath: string
  data: object
  message?: string
  defaultMessagePrefix: string
  getFileSha: () => Promise<string | null>
  apiHeaders: (token: string) => Record<string, string>
  onSuccess?: () => void
  onError?: (error: Error) => void
}

export interface RestoreFileParams {
  token: string
  owner: string
  repo: string
  filePath: string
  apiHeaders: (token: string) => Record<string, string>
}

export async function syncFileToGitHub(params: SyncFileParams): Promise<void> {
  const {
    token,
    owner,
    repo,
    filePath,
    data,
    message,
    defaultMessagePrefix,
    getFileSha,
    apiHeaders,
    onSuccess,
    onError,
  } = params

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const prettyJson = JSON.stringify(data, null, 2)
      const content = toBase64(prettyJson)
      const sha = await getFileSha()
      const commitMessage =
        message ||
        `${defaultMessagePrefix}: ${new Date().toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}`
      const body: Record<string, string> = { message: commitMessage, content }
      if (sha) body.sha = sha
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
        method: 'PUT',
        headers: apiHeaders(token),
        body: JSON.stringify(body),
      })
      if ((res.status === 409 || res.status === 422) && attempt < 2) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
        continue
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { message?: string }).message || `GitHub API error: ${res.status}`)
      }
      onSuccess?.()
      return
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e))
      if (attempt === 2) {
        onError?.(error)
        throw error
      }
    }
  }
}

export async function restoreFileFromGitHub(params: RestoreFileParams): Promise<{ ok: boolean; data?: unknown }> {
  const { token, owner, repo, filePath, apiHeaders } = params
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
      headers: apiHeaders(token),
    })
    if (res.status === 404) return { ok: false }
    if (!res.ok) return { ok: false }
    const json = await res.json()
    if (typeof json.content !== 'string') return { ok: false }
    const parsed = JSON.parse(atob(json.content.replace(/\n/g, '')))
    return { ok: true, data: parsed }
  } catch {
    return { ok: false }
  }
}
