import { toBase64, fromBase64 } from './base64Utils'

export interface SyncFileParams {
  token: string
  owner: string
  repo: string
  filePath: string
  data: object
  message?: string
  defaultMessagePrefix?: string
  apiHeaders: (token: string) => Record<string, string>
  getFileSha: (path: string) => Promise<string | null>
  lastSyncedJsonRef?: React.MutableRefObject<string | null>
  onSuccess?: () => void
}

export interface RestoreFileParams {
  token: string
  owner: string
  repo: string
  filePath: string
  apiHeaders: (token: string) => Record<string, string>
  ref?: string
}

export interface RestoreFileResult {
  ok: boolean
  data?: unknown
  reason?: 'not-found' | 'api-error' | 'bad-format' | 'exception'
}

export async function syncFileToGitHub(params: SyncFileParams): Promise<void> {
  const {
    token,
    owner,
    repo,
    filePath,
    data,
    message,
    defaultMessagePrefix = 'Auto-save',
    apiHeaders,
    getFileSha,
    lastSyncedJsonRef,
    onSuccess,
  } = params

  let lastErr: Error | null = null // eslint-disable-line no-useless-assignment
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const prettyJson = JSON.stringify(data, null, 2)
      const content = toBase64(prettyJson)
      const sha = await getFileSha(filePath)
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
      if (lastSyncedJsonRef) {
        lastSyncedJsonRef.current = (() => {
          const { exportedAt: _, ...rest } = data as Record<string, unknown>
          return JSON.stringify(rest)
        })()
      }
      onSuccess?.()
      return
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e))
      if (attempt === 2) throw lastErr
    }
  }
}

export async function restoreFileFromGitHub(params: RestoreFileParams): Promise<RestoreFileResult> {
  const { token, owner, repo, filePath, apiHeaders, ref } = params
  const url = ref
    ? `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${ref}`
    : `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`
  try {
    const res = await fetch(url, { headers: apiHeaders(token) })
    if (res.status === 404) return { ok: false, reason: 'not-found' }
    if (!res.ok) return { ok: false, reason: 'api-error' }
    const json = await res.json()
    if (typeof json.content !== 'string' || (json.encoding && json.encoding !== 'base64'))
      return { ok: false, reason: 'bad-format' }
    const decoded = fromBase64(json.content.replace(/\n/g, ''))
    const parsed = JSON.parse(decoded)
    return { ok: true, data: parsed }
  } catch {
    return { ok: false, reason: 'exception' }
  }
}
