import { fromBase64, toBase64 } from './base64Utils'
import type { CommitEntry, ConnectionTestResult } from './githubSyncTypes'

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

export interface RestoreFileParams {
  token: string
  owner: string
  repo: string
  filePath: string
  ref?: string
  checkEncoding?: boolean
}

export interface RestoreFileResult {
  ok: boolean
  status?: number
  data?: unknown
}

export async function restoreFileFromGitHub(params: RestoreFileParams): Promise<RestoreFileResult> {
  const { token, owner, repo, filePath, ref, checkEncoding } = params
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}${ref ? `?ref=${ref}` : ''}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (!res.ok) return { ok: false, status: res.status }
  const json = await res.json()
  const file = json as { content?: string; encoding?: string }
  if (checkEncoding && (!file.content || file.encoding !== 'base64')) return { ok: false }
  if (!checkEncoding && typeof file.content !== 'string') return { ok: false }
  const decoded = fromBase64(file.content!.replace(/\n/g, ''))
  const parsed = JSON.parse(decoded)
  return { ok: true, data: parsed }
}

export async function getFileShaForPathApi(
  token: string,
  owner: string,
  repo: string,
  path: string,
): Promise<string | null> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    cache: 'no-store',
  })
  if (res.status === 404) return null
  if (res.status === 401) throw new Error('Invalid token — check the token is correct and not expired.')
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`)
  const data = await res.json()
  return data.sha as string
}

export async function testConnectionApi(token: string, owner: string, repo: string): Promise<ConnectionTestResult> {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: apiHeaders(token),
    })
    if (res.status === 404)
      return {
        ok: false,
        message:
          'Repository not found — if it\'s private, ensure the token has access to private repositories (classic token needs "repo" scope; fine-grained token needs "Contents: Read & Write").',
        warnings: [],
      }
    if (res.status === 401)
      return { ok: false, message: 'Invalid token — check the token is correct and not expired.', warnings: [] }
    if (!res.ok) return { ok: false, message: `GitHub API error: ${res.status}`, warnings: [] }

    const warnings: string[] = []
    const scopes = res.headers.get('x-oauth-scopes')
    const repoData = (await res.json()) as {
      full_name: string
      private?: boolean
      permissions?: { push?: boolean }
    }

    if (repoData.private === false) {
      warnings.push('This repository is public. Backups may expose sensitive financial data.')
    }
    if (repoData.permissions && repoData.permissions.push === false) {
      warnings.push('Token does not appear to have write access to this repository.')
    }
    if (scopes && scopes.includes('repo')) {
      warnings.push('Token has broad repo scope. Prefer a fine-grained token limited to one backup repo.')
    }
    return { ok: true, message: `Connected to ${repoData.full_name}`, warnings }
  } catch {
    return { ok: false, message: 'Network error. Check your connection.', warnings: [] }
  }
}

export async function fetchCommitHistory(
  token: string,
  owner: string,
  repo: string,
  filePath: string,
): Promise<CommitEntry[]> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?path=${encodeURIComponent(filePath)}&per_page=100`,
      { headers: apiHeaders(token) },
    )
    if (!res.ok) return []
    const commits = await res.json()
    return (commits as { sha: string; commit: { message: string; author: { date: string } }; html_url: string }[]).map(
      c => ({
        sha: (c.sha as string).slice(0, 7),
        message: c.commit.message as string,
        date: c.commit.author.date as string,
        url: c.html_url as string,
      }),
    )
  } catch {
    return []
  }
}
