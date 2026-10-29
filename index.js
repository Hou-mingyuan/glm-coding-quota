// glm-coding-quota — Host half
// Serves GET /api/glm-coding-quota/quota from the BigModel team monitoring API.
// The API key arrives as env ZAI_CODING_CN_API_KEY (injected by the Host from
// credentials refs). NOTE: the DSH host replaces Node's undici dispatcher, so
// every outbound fetch MUST send `accept-encoding: identity` or compressed
// bodies come back undecoded (see @linxin666/dsh-usage src/host/http.ts).

import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const API_URL = 'https://open.bigmodel.cn/api/monitor/usage/quota/limit?type=2'
const CACHE_TTL_MS = 5 * 60 * 1000

// env injection only reaches provider subprocesses, not the main host, so fall
// back to the credentials store the host itself writes.
function resolveApiKey() {
  const fromEnv = process.env.ZAI_CODING_CN_API_KEY
  if (fromEnv) return fromEnv
  try {
    const raw = readFileSync(join(homedir(), '.dsh', '.credentials.yaml'), 'utf8')
    const line = raw.split(/\r?\n/).find((l) => /^\s{2}ZAI_CODING_CN_API_KEY:/.test(l))
    const value = line?.split(':')[1]?.trim()
    if (value) return value
  } catch {}
  return null
}

// Optional user-level scope config: ~/.dsh/glm-coding-quota.json
// { "organization": "org-xxx", "project": "proj_xxx" }
function resolveScopeFromFile() {
  try {
    const raw = readFileSync(join(homedir(), '.dsh', 'glm-coding-quota.json'), 'utf8')
    const cfg = JSON.parse(raw)
    return {
      organization: typeof cfg.organization === 'string' ? cfg.organization : '',
      project: typeof cfg.project === 'string' ? cfg.project : '',
    }
  } catch {
    return { organization: '', project: '' }
  }
}

export const name = 'glm-coding-quota'
export const inject = ['webServer']

function writeJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'referrer-policy': 'no-referrer',
    'cache-control': 'no-store',
  })
  res.end(payload)
}

function windowLabel(unit, number) {
  if (unit === 3) return `${number} 小时`
  if (unit === 6) return number === 1 ? '每周' : `${number} 周`
  return `unit:${unit}x${number}`
}

function mapLimit(row) {
  const usedPct = Number(row?.percentage ?? 0)
  return {
    key: `${row?.unit ?? '?'}:${row?.number ?? '?'}`,
    type: row?.type ?? '',
    label: windowLabel(row?.unit, row?.number),
    usedPct,
    remainingPct: Math.max(0, 100 - usedPct),
    remaining: row?.remaining ?? null,
    usage: row?.usage ?? null,
    currentValue: row?.currentValue ?? null,
    resetAt: typeof row?.nextResetTime === 'number' ? row.nextResetTime : null,
  }
}

async function fetchQuota(scope) {
  const key = resolveApiKey()
  if (!key) throw new Error('ZAI_CODING_CN_API_KEY not found in env or ~/.dsh/.credentials.yaml')
  const headers = {
    authorization: key,
    'accept-encoding': 'identity',
  }
  // Scoping headers, REQUIRED for this endpoint: without them the API answers
  // 200 with an empty data object. Resolved from plugin config, env
  // (BIGMODEL_ORGANIZATION / BIGMODEL_PROJECT), or ~/.dsh/glm-coding-quota.json.
  if (scope.organization) headers['bigmodel-organization'] = scope.organization
  if (scope.project) headers['bigmodel-project'] = scope.project
  const response = await fetch(API_URL, { headers })
  const text = await response.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    throw new Error(`BigModel answered ${response.status} with a non-JSON body`)
  }
  if (body?.code !== 200 || !body?.data) {
    throw new Error(`BigModel ${body?.code ?? response.status}: ${body?.message ?? text.slice(0, 200)}`)
  }
  const limits = Array.isArray(body.data.limits)
    ? body.data.limits.filter((row) => row?.type === 'CREDIT_LIMIT').map(mapLimit)
    : []
  return { level: body.data.level ?? null, limits }
}

export function apply(ctx) {
  const cfg = (typeof ctx.config === 'object' && ctx.config) || {}
  const fileScope = resolveScopeFromFile()
  const scope = {
    organization: cfg.organization || process.env.BIGMODEL_ORGANIZATION || fileScope.organization,
    project: cfg.project || process.env.BIGMODEL_PROJECT || fileScope.project,
  }
  let cache = null
  let cacheAt = 0
  let inflight = null
  const beacons = []

  const getQuota = async (force) => {
    const fresh = cache !== null && Date.now() - cacheAt < CACHE_TTL_MS
    if (!force && fresh) {
      return { ok: true, cached: true, fetchedAt: cacheAt, ...cache }
    }
    if (inflight) return inflight
    inflight = (async () => {
      try {
        const data = await fetchQuota(scope)
        cache = data
        cacheAt = Date.now()
        return { ok: true, cached: false, fetchedAt: cacheAt, ...data }
      } finally {
        inflight = null
      }
    })()
    return inflight
  }

  const disposeRoute = ctx.webServer.register({
    kind: 'exact',
    path: '/api/glm-coding-quota/quota',
    handler: async (req, res) => {
      try {
        const url = new URL(req.url ?? '/', 'http://127.0.0.1')
        const force = url.searchParams.get('force') === '1'
        writeJson(res, 200, await getQuota(force))
      } catch (error) {
        writeJson(res, 502, { ok: false, error: String(error?.message ?? error) })
      }
    },
  })

  const disposeDiag = ctx.webServer.register({
    kind: 'exact',
    path: '/api/glm-coding-quota/diag',
    handler: async (req, res) => {
      try {
        if (req.method === 'POST') {
          const chunks = []
          for await (const c of req) chunks.push(c)
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
          beacons.push({ hostAt: Date.now(), ...body })
          if (beacons.length > 50) beacons.shift()
          writeJson(res, 200, { ok: true })
          return
        }
        writeJson(res, 200, { ok: true, count: beacons.length, beacons })
      } catch (error) {
        writeJson(res, 502, { ok: false, error: String(error?.message ?? error) })
      }
    },
  })

  ctx.effect(() => () => {
    try {
      disposeRoute()
    } catch {}
    try {
      disposeDiag()
    } catch {}
  }, 'glm-coding-quota: route')
}
