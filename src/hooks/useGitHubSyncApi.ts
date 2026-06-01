import { toBase64 } from './base64Utils'

export interface SyncFileParams {
  token: string
  owner: string
  repo: string
  filePath: string
  data: object
  message?: string
  messagePrefix: string
  getFileSha: () => Promise<string | null>
}

const apiHeaders = (token: string): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'Content-Type': 'application/json',
})

export async function syncFileToGitHub(params: SyncFileParams): Promise<{ ok: boolean; error?: string }> {
  const { token, owner, repo, filePath, data, message, messagePrefix, getFileSha } = params
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const prettyJson = JSON.stringify(data, null, 2)
      const content = toBase64(prettyJson)
      const sha = await getFileSha()
      const commitMessage =
        message ||
        `${messagePrefix}: ${new Date().toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}`
      const body: Record<string, string> = { message: commitMessage, content }
      if (sha) body.sha = sha
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
        { method: 'PUT', headers: apiHeaders(token), body: JSON.stringify(body) },
      )
      if ((res.status === 409 || res.status === 422) && attempt < 2) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
        continue
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return { ok: false, error: (err as { message?: string }).message || `GitHub API error: ${res.status}` }
      }
      return { ok: true }
    } catch (e) {
      if (attempt === 2) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) }
      }
    }
  }
  return { ok: false, error: 'Unexpected: exhausted retries' }
}
