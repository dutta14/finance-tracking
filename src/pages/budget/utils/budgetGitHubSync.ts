import { GitHubSyncConfig } from '../../../hooks/useGitHubSync'
import { BudgetConfigData } from '../types'

/**
 * Sync budget CSV files to/from GitHub under a `budget/` folder.
 * File naming: budget/yyyy-mm.csv
 */

const toBase64 = (str: string): string => {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  bytes.forEach(b => {
    binary += String.fromCharCode(b)
  })
  return btoa(binary)
}

const fromBase64 = (b64: string): string => {
  const bin = atob(b64)
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function apiHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  }
}

async function getFileSha(config: GitHubSyncConfig, token: string, path: string): Promise<string | null> {
  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}`
  const res = await fetch(url, { headers: apiHeaders(token) })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`)
  const data = await res.json()
  return data.sha as string
}

/** Upload a single CSV to GitHub */
export async function uploadBudgetCSV(
  config: GitHubSyncConfig,
  token: string,
  monthKey: string,
  csvContent: string,
  message?: string,
): Promise<{ ok: boolean; error?: string }> {
  const path = `budget/${monthKey}.csv`
  try {
    const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}`
    console.log('[budget-sync] PUT CSV', { url, monthKey, contentLen: csvContent.length })

    // Retry loop for 409 conflicts (concurrent commits)
    for (let attempt = 0; attempt < 3; attempt++) {
      const sha = await getFileSha(config, token, path)
      const content = toBase64(csvContent)
      const commitMessage = message || `Budget: ${monthKey}`
      const body: Record<string, string> = { message: commitMessage, content }
      if (sha) body.sha = sha
      const res = await fetch(url, { method: 'PUT', headers: apiHeaders(token), body: JSON.stringify(body) })
      if (res.ok) return { ok: true }
      if (res.status === 409 && attempt < 2) {
        console.log(`[budget-sync] 409 conflict on ${monthKey}, retrying (${attempt + 1}/3)`)
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
        continue
      }
      const err = await res.json().catch(() => ({}))
      const msg = (err as { message?: string }).message || `GitHub API error: ${res.status}`
      console.error('[budget-sync] CSV upload failed', { monthKey, status: res.status, msg })
      return { ok: false, error: msg }
    }
    return { ok: false, error: 'Max retries exceeded' }
  } catch (e) {
    console.error('[budget-sync] CSV upload exception', { monthKey, error: e })
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** List all budget CSVs from GitHub (budget/*.csv) */
export async function listBudgetCSVs(
  config: GitHubSyncConfig,
  token: string,
): Promise<{ ok: boolean; files?: { name: string; path: string; sha: string }[]; error?: string }> {
  try {
    const res = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/contents/budget`, {
      headers: apiHeaders(token),
    })
    if (res.status === 404) return { ok: true, files: [] }
    if (!res.ok) {
      return { ok: false, error: `GitHub API error: ${res.status}` }
    }
    const items = (await res.json()) as { name: string; path: string; sha: string; type: string }[]
    const csvFiles = items
      .filter(f => f.type === 'file' && f.name.endsWith('.csv'))
      .map(f => ({ name: f.name, path: f.path, sha: f.sha }))
    return { ok: true, files: csvFiles }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** Download a single budget CSV from GitHub */
export async function downloadBudgetCSV(
  config: GitHubSyncConfig,
  token: string,
  monthKey: string,
): Promise<{ ok: boolean; csv?: string; error?: string }> {
  const path = `budget/${monthKey}.csv`
  try {
    const res = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}`, {
      headers: apiHeaders(token),
    })
    if (res.status === 404) return { ok: false, error: 'File not found' }
    if (!res.ok) return { ok: false, error: `GitHub API error: ${res.status}` }
    const file = (await res.json()) as { content?: string; encoding?: string }
    if (!file.content || file.encoding !== 'base64') {
      return { ok: false, error: 'Unexpected file format' }
    }
    const csv = fromBase64(file.content.replace(/\n/g, ''))
    return { ok: true, csv }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** Download all budget CSVs from GitHub and return them keyed by month */
export async function downloadAllBudgetCSVs(
  config: GitHubSyncConfig,
  token: string,
): Promise<{ ok: boolean; csvs?: Record<string, string>; error?: string }> {
  const listResult = await listBudgetCSVs(config, token)
  if (!listResult.ok || !listResult.files) return { ok: false, error: listResult.error }

  const csvs: Record<string, string> = {}
  for (const file of listResult.files) {
    const monthKey = file.name.replace('.csv', '')
    const result = await downloadBudgetCSV(config, token, monthKey)
    if (result.ok && result.csv) {
      csvs[monthKey] = result.csv
    }
  }
  return { ok: true, csvs }
}

/** Sync all local budget CSVs to GitHub */
export async function syncAllBudgetCSVs(
  config: GitHubSyncConfig,
  token: string,
  localCsvs: Record<string, { csv: string }>,
): Promise<{ ok: boolean; synced: number; errors: string[] }> {
  const errors: string[] = []
  let synced = 0
  for (const [monthKey, data] of Object.entries(localCsvs)) {
    const result = await uploadBudgetCSV(config, token, monthKey, data.csv)
    if (result.ok) synced++
    else errors.push(`${monthKey}: ${result.error}`)
  }
  return { ok: errors.length === 0, synced, errors }
}

const CONFIG_PATH = 'budget/budget-config.json'

/** Upload budget config JSON to GitHub */
export async function uploadBudgetConfig(
  config: GitHubSyncConfig,
  token: string,
  data: BudgetConfigData,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const sha = await getFileSha(config, token, CONFIG_PATH)
    const content = toBase64(JSON.stringify(data, null, 2))
    const body: Record<string, string> = { message: 'Budget config update', content }
    if (sha) body.sha = sha
    const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${CONFIG_PATH}`
    console.log('[budget-sync] PUT config', { url, years: data.years, groups: data.categoryGroups?.length })
    const res = await fetch(url, { method: 'PUT', headers: apiHeaders(token), body: JSON.stringify(body) })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      const msg = (err as { message?: string }).message || `GitHub API error: ${res.status}`
      console.error('[budget-sync] config upload failed', { status: res.status, msg })
      return { ok: false, error: msg }
    }
    return { ok: true }
  } catch (e) {
    console.error('[budget-sync] config upload exception', e)
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** Download budget config JSON from GitHub */
export async function downloadBudgetConfig(
  config: GitHubSyncConfig,
  token: string,
): Promise<{ ok: boolean; data?: BudgetConfigData; error?: string }> {
  try {
    const res = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/contents/${CONFIG_PATH}`, {
      headers: apiHeaders(token),
    })
    if (res.status === 404) return { ok: true, data: undefined }
    if (!res.ok) return { ok: false, error: `GitHub API error: ${res.status}` }
    const file = (await res.json()) as { content?: string; encoding?: string }
    if (!file.content || file.encoding !== 'base64') {
      return { ok: false, error: 'Unexpected file format' }
    }
    const json = fromBase64(file.content.replace(/\n/g, ''))
    const data = JSON.parse(json) as BudgetConfigData
    return { ok: true, data }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
