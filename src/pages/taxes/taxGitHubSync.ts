import { GitHubSyncConfig } from '../../hooks/useGitHubSync'
import type { TaxStore, TaxDocFile } from './types'
import { getFileContent } from '../../utils/taxFileDB'

function apiHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  }
}

async function getFileSha(
  config: GitHubSyncConfig, token: string, path: string
): Promise<string | null> {
  const res = await fetch(
    `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}`,
    { headers: apiHeaders(token) }
  )
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`)
  const data = await res.json()
  return data.sha as string
}

/** Strip data-URL prefix to get raw base64 */
function stripDataUrl(content: string): string {
  const idx = content.indexOf(',')
  return idx >= 0 ? content.slice(idx + 1) : content
}

/** Build GitHub path: taxes/<year>/<owner>_<label>.<ext> */
function filePath(year: number, ownerLabel: string, itemLabel: string, file: TaxDocFile): string {
  const safeName = `${ownerLabel}_${itemLabel}`.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_')
  return `taxes/${year}/${safeName}_${file.id}.${file.ext}`
}

/** Upload a single tax document file to GitHub */
async function uploadTaxFile(
  config: GitHubSyncConfig,
  token: string,
  path: string,
  base64Content: string,
  message: string
): Promise<{ ok: boolean; error?: string }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const sha = await getFileSha(config, token, path)
      const body: Record<string, string> = { message, content: base64Content }
      if (sha) body.sha = sha
      const res = await fetch(
        `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}`,
        { method: 'PUT', headers: apiHeaders(token), body: JSON.stringify(body) }
      )
      if (res.ok) return { ok: true }
      if (res.status === 409 && attempt < 2) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
        continue
      }
      const err = await res.json().catch(() => ({}))
      return { ok: false, error: (err as { message?: string }).message || `GitHub API error: ${res.status}` }
    } catch (e) {
      if (attempt === 2) return { ok: false, error: e instanceof Error ? e.message : String(e) }
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
    }
  }
  return { ok: false, error: 'Max retries exceeded' }
}

function ownerLabel(owner: string): string {
  try {
    const profile = JSON.parse(localStorage.getItem('user-profile') || '{}')
    if (owner === 'primary') return profile.name || 'Primary'
    if (owner === 'partner') return profile.partner?.name || 'Partner'
    return 'Joint'
  } catch { return owner }
}

/** Sync all tax document files to GitHub */
export async function syncAllTaxFiles(
  config: GitHubSyncConfig,
  token: string,
  store: TaxStore
): Promise<{ ok: boolean; synced: number; errors: string[] }> {
  const errors: string[] = []
  let synced = 0

  for (const [yearStr, yearData] of Object.entries(store.years || {})) {
    const year = parseInt(yearStr, 10)
    for (const item of yearData.items || []) {
      const oLabel = ownerLabel(item.owner)
      for (const file of item.files) {
        // Load content from IndexedDB if not inline (post-migration)
        let content = file.content
        if (!content) {
          content = await getFileContent(file.id) ?? undefined
        }
        if (!content) continue
        const path = filePath(year, oLabel, item.label, file)
        const raw = stripDataUrl(content)
        const result = await uploadTaxFile(config, token, path, raw, `Tax doc: ${file.name}`)
        if (result.ok) synced++
        else errors.push(`${file.name}: ${result.error}`)
      }
    }
  }

  return { ok: errors.length === 0, synced, errors }
}

/** Download all tax files from GitHub and return a map of fileId → base64 content */
export async function downloadAllTaxFiles(
  config: GitHubSyncConfig,
  token: string
): Promise<{ ok: boolean; files?: Map<string, string>; error?: string }> {
  try {
    // List years
    const yearsRes = await fetch(
      `https://api.github.com/repos/${config.owner}/${config.repo}/contents/taxes`,
      { headers: apiHeaders(token) }
    )
    if (yearsRes.status === 404) return { ok: true, files: new Map() }
    if (!yearsRes.ok) return { ok: false, error: `GitHub API error: ${yearsRes.status}` }

    const yearDirs = (await yearsRes.json()) as { name: string; type: string }[]
    const files = new Map<string, string>()

    for (const dir of yearDirs.filter(d => d.type === 'dir')) {
      const filesRes = await fetch(
        `https://api.github.com/repos/${config.owner}/${config.repo}/contents/taxes/${dir.name}`,
        { headers: apiHeaders(token) }
      )
      if (!filesRes.ok) continue
      const items = (await filesRes.json()) as { name: string; type: string; sha: string }[]

      for (const item of items.filter(i => i.type === 'file')) {
        // Extract fileId from filename: ..._<fileId>.<ext>
        const match = item.name.match(/_([^_]+)\.[^.]+$/)
        if (!match) continue
        const fileId = match[1]

        const contentRes = await fetch(
          `https://api.github.com/repos/${config.owner}/${config.repo}/contents/taxes/${dir.name}/${item.name}`,
          { headers: apiHeaders(token) }
        )
        if (!contentRes.ok) continue
        const fileData = await contentRes.json() as { content?: string; encoding?: string }
        if (fileData.content && fileData.encoding === 'base64') {
          files.set(fileId, fileData.content.replace(/\n/g, ''))
        }
      }
    }

    return { ok: true, files }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
