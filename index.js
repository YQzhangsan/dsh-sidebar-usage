/**
 * Host half of the bottom usage bar.
 *
 * Serves one JSON summary for the browser half:
 *
 *   GET /api/dsh-usage-bar/summary?locale=zh&tz=-480&version=1.0.0&refresh=1
 *
 * The summary combines three sources:
 *   1. Account state + wallet balances from the Host `deepseekAccount` service
 *      (official Platform endpoints).
 *   2. Today's / this month's cost and token usage from the Platform dashboard
 *      usage endpoint, authenticated with the stored account grant.
 *   3. A local "today" estimate from the wallet-balance delta when the usage
 *      endpoint is unavailable (credentials missing, expired, or offline).
 */
const ROUTE_PATH = '/api/dsh-usage-bar/summary'
const USAGE_ORIGIN = 'https://platform.deepseek.com'
const USAGE_PATH = '/api/v0/usage/cost'
const USAGE_AMOUNT_PATH = '/api/v0/usage/amount'
const NETWORK_TIMEOUT_MS = 12000
const CACHE_MS = 15000

/** Last successful summary, reused for a few seconds by concurrent clients. */
let cache = null

/** Day-opening / last-observed wallet balance for the local estimate. */
const dayState = { date: '', opening: null, last: null }

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function round(value, digits = 4) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

/** Local calendar date as `YYYY-MM-DD`; the Platform dashboard reports local days too. */
function localDate(now = new Date()) {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Sum every token field a dashboard usage row may carry, without double counting. */
function tokenCount(entry) {
  const direct = toNumber(entry.tokens) ?? toNumber(entry.total_tokens) ?? toNumber(entry.totalTokens)
  if (direct !== null) return direct
  let sum = 0
  let seen = false
  for (const key of [
    'input_tokens', 'inputTokens', 'output_tokens', 'outputTokens',
    'cache_hit_tokens', 'cacheHitTokens', 'cache_read_tokens', 'cacheReadTokens',
    'reasoning_tokens', 'reasoningTokens',
  ]) {
    const value = toNumber(entry[key])
    if (value !== null) {
      sum += value
      seen = true
    }
  }
  return seen ? sum : 0
}

/**
 * Read the dashboard envelope `{ code, data: { biz_code, biz_data: { days: [...] } } }`.
 * @returns today's cost, the whole-month cost and token total, or null when the shape is unknown.
 */
function parseUsagePayload(payload, today) {
  if (!payload || typeof payload !== 'object' || payload.code !== 0) return null
  const data = payload.data
  if (!data || typeof data !== 'object') return null
  if (data.biz_code !== undefined && data.biz_code !== 0) return null
  const container = Array.isArray(data.biz_data) ? data.biz_data[0] : data.biz_data
  if (!container || typeof container !== 'object' || !Array.isArray(container.days)) return null

  let monthCost = 0
  let monthTokens = 0
  let todayCost = null
  let sawCost = false

  for (const day of container.days) {
    if (!day || typeof day !== 'object') continue
    let dayCost = 0
    let dayTokens = 0
    const rows = Array.isArray(day.data) ? day.data : []
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue
      const rowCost = toNumber(row.cost) ?? toNumber(row.amount)
      if (rowCost !== null) {
        dayCost += rowCost
        sawCost = true
      }
      const usage = Array.isArray(row.usage) ? row.usage : []
      for (const item of usage) {
        if (!item || typeof item !== 'object') continue
        const cost = toNumber(item.cost) ?? toNumber(item.amount)
        if (cost !== null) {
          dayCost += cost
          sawCost = true
        }
        dayTokens += tokenCount(item)
      }
    }
    monthCost += dayCost
    monthTokens += dayTokens
    if (typeof day.date === 'string' && day.date.slice(0, 10) === today) todayCost = dayCost
  }

  if (!sawCost) return null
  return {
    todayCost: todayCost === null ? null : round(todayCost, 4),
    monthCost: round(monthCost, 4),
    monthTokens,
  }
}

/**
 * Read the token amounts from the dashboard `usage/amount` envelope; the shape mirrors
 * `usage/cost`, but each usage row counts tokens instead of money.
 */
function parseAmountPayload(payload, today) {
  if (!payload || typeof payload !== 'object' || payload.code !== 0) return null
  const data = payload.data
  if (!data || typeof data !== 'object') return null
  if (data.biz_code !== undefined && data.biz_code !== 0) return null
  const container = Array.isArray(data.biz_data) ? data.biz_data[0] : data.biz_data
  if (!container || typeof container !== 'object' || !Array.isArray(container.days)) return null

  let monthTokens = 0
  let todayTokens = 0
  let sawTokens = false

  for (const day of container.days) {
    if (!day || typeof day !== 'object') continue
    let dayTokens = 0
    const rows = Array.isArray(day.data) ? day.data : []
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue
      const usage = Array.isArray(row.usage) ? row.usage : []
      for (const item of usage) {
        if (!item || typeof item !== 'object') continue
        const direct = toNumber(item.amount) ?? toNumber(item.tokens) ?? toNumber(item.total_tokens)
        if (direct !== null) {
          dayTokens += direct
          sawTokens = true
          continue
        }
        for (const key of [
          'input_tokens', 'output_tokens', 'cache_hit_tokens',
          'cache_read_tokens', 'reasoning_tokens',
        ]) {
          const value = toNumber(item[key])
          if (value !== null) {
            dayTokens += value
            sawTokens = true
          }
        }
      }
    }
    monthTokens += dayTokens
    if (typeof day.date === 'string' && day.date.slice(0, 10) === today) todayTokens = dayTokens
  }

  return sawTokens ? { monthTokens, todayTokens } : null
}

/** Query the Platform dashboard usage endpoint; throws a coded error on rejection. */
async function requestUsage(origin, token, path = USAGE_PATH) {
  const now = new Date()
  const url = `${origin}${path}?month=${now.getMonth() + 1}&year=${now.getFullYear()}`
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'error',
    signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${token}`,
      'x-dsh-auth-token': token,
      origin,
      referer: `${origin}/usage`,
    },
  })
  if (!response.ok) {
    await response.body?.cancel?.()
    const error = new Error(`usage http ${response.status}`)
    error.code = `http-${response.status}`
    throw error
  }
  const payload = await response.json()
  if (payload && typeof payload === 'object' && (payload.code === 40002 || payload.code === 40003)) {
    const error = new Error('usage token rejected')
    error.code = 'expired'
    throw error
  }
  return payload
}

/** Resolve within `ms`, or fall back to `fallback` and let the original settle unattended. */
function withTimeout(promise, ms, fallback) {
  return Promise.race([
    Promise.resolve(promise).catch(() => fallback),
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms).unref?.()),
  ])
}

/** Track the first and latest wallet balance observed today for the estimate. */
function updateDayMeter(today, amount) {
  if (dayState.date !== today) {
    dayState.date = today
    dayState.opening = amount
    dayState.last = amount
    return
  }
  if (amount === null) return
  if (dayState.opening === null) dayState.opening = amount
  dayState.last = amount
}

function todayEstimate(today) {
  if (dayState.date !== today) return null
  if (dayState.opening === null || dayState.last === null) return null
  return Math.max(0, dayState.opening - dayState.last)
}

async function buildSummary(ctx, request) {
  const summary = {
    ok: true,
    signedIn: false,
    usage: {
      source: 'none',
      todayCost: null,
      monthCost: null,
      monthTokens: null,
      currency: 'CNY',
      error: null,
    },
    balance: { normal: [], bonus: [], currency: 'CNY', error: null },
    links: { usageUrl: `${USAGE_ORIGIN}/usage` },
    fetchedAt: Date.now(),
  }

  const account = typeof ctx.get === 'function' ? ctx.get('deepseekAccount') : undefined
  if (!account) {
    summary.error = 'no-account'
    return summary
  }

  const state = await withTimeout(account.getState(), NETWORK_TIMEOUT_MS, undefined)
  if (!state || state.status !== 'credential-stored') return summary
  summary.signedIn = true
  if (state.links && typeof state.links.usageUrl === 'string') summary.links.usageUrl = state.links.usageUrl

  const metadata = {
    version: request.version || '1.0.0',
    locale: request.locale || 'en',
    timezoneOffsetSeconds: -Math.round(request.tzMinutes || 0) * 60,
  }

  const details = await withTimeout(account.getBalance(metadata), NETWORK_TIMEOUT_MS, undefined)
  if (details && details.status === 'ready') {
    summary.balance.normal = (details.value || []).map((wallet) => ({
      currency: wallet.currency,
      balance: String(wallet.balance),
    }))
    summary.balance.bonus = (details.bonusWallets || []).map((wallet) => ({
      currency: wallet.currency,
      balance: String(wallet.balance),
    }))
    summary.balance.currency = summary.balance.normal[0]?.currency || 'CNY'
  } else if (details && details.status === 'failed') {
    summary.balance.error = 'unavailable'
  } else {
    summary.balance.error = 'unavailable'
  }
  summary.usage.currency = summary.balance.currency

  const today = localDate()
  const wallet = summary.balance.normal.length === 1 ? summary.balance.normal[0] : null
  const amount = wallet ? toNumber(wallet.balance) : null
  updateDayMeter(today, amount)

  const candidates = []
  const session = await withTimeout(account.getPlatformSession(), NETWORK_TIMEOUT_MS, undefined)
  if (session && typeof session.token === 'string' && session.token.length > 0) {
    candidates.push({ origin: session.origin || USAGE_ORIGIN, token: session.token })
  } else {
    summary.usage.error = 'no-token'
  }

  const credentials = typeof ctx.get === 'function' ? ctx.get('credentials') : undefined
  if (credentials && typeof credentials.resolve === 'function') {
    try {
      const hit = await credentials.resolve('DEEPSEEK_PLATFORM_TOKEN')
      if (hit && typeof hit.value === 'string' && hit.value.length > 0) {
        candidates.push({ origin: USAGE_ORIGIN, token: hit.value })
      }
    } catch {
      // the optional platform token is simply unavailable
    }
  }

  for (const candidate of candidates) {
    if (summary.usage.source === 'official') break
    try {
      const payload = await requestUsage(candidate.origin, candidate.token)
      const parsed = parseUsagePayload(payload, today)
      if (parsed === null) {
        summary.usage.error = 'shape'
        continue
      }
      summary.usage = { source: 'official', ...parsed, currency: summary.balance.currency, error: null }
      try {
        const amountPayload = await requestUsage(candidate.origin, candidate.token, USAGE_AMOUNT_PATH)
        const amounts = parseAmountPayload(amountPayload, today)
        if (amounts !== null) summary.usage.monthTokens = amounts.monthTokens
      } catch {
        // the cost stays official; the token total simply remains unavailable
      }
    } catch (error) {
      summary.usage.error = (error && error.code) || 'network'
    }
  }

  if (summary.usage.source !== 'official') {
    const estimate = todayEstimate(today)
    if (estimate !== null) {
      summary.usage.source = 'estimate'
      summary.usage.todayCost = round(estimate, 2)
    }
  }

  return summary
}

export const inject = ['webServer']

export function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: ROUTE_PATH,
    handler: async (req, res) => {
      try {
        if (req.method !== 'GET') {
          res.writeHead(405, { allow: 'GET' })
          res.end()
          return
        }
        const url = new URL(req.url || ROUTE_PATH, 'http://127.0.0.1')
        const refresh = url.searchParams.get('refresh') === '1'
        if (!refresh && cache !== null && Date.now() - cache.at < CACHE_MS) {
          sendJson(res, 200, cache.payload)
          return
        }
        const request = {
          locale: url.searchParams.get('locale') || 'en',
          tzMinutes: Number(url.searchParams.get('tz') || '0') || 0,
          version: url.searchParams.get('version') || '1.0.0',
        }
        const payload = await buildSummary(ctx, request)
        cache = { at: Date.now(), payload }
        sendJson(res, 200, payload)
      } catch (error) {
        ctx.logger?.warn?.('dsh-sidebar-usage: failed to build the usage summary')
        ctx.logger?.warn?.(error)
        try {
          sendJson(res, 500, { ok: false, error: 'summary-failed' })
        } catch {
          // headers may already be sent
        }
      }
    },
  }), 'dsh-sidebar-usage: summary route')
}
