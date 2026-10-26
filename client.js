window.__ModuleLoader__.load({
  id: 'dsh-sidebar-usage',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const NS = 'dsh-sidebar-usage'
    const REFRESH_MS = 60000

    const zh = {
      label: '用量与余额',
      today: '今日消费',
      month: '本月消费',
      tokens: '本月 Tokens',
      recharge: '充值余额',
      bonus: '赠金余额',
      viewUsage: '查询用量',
      refresh: '刷新',
      unavailable: '用量暂不可用',
      estimate: '估算',
      updated: '更新于',
    }

    const en = {
      label: 'Usage and balance',
      today: 'Today',
      month: 'This month',
      tokens: 'Month tokens',
      recharge: 'Balance',
      bonus: 'Bonus',
      viewUsage: 'View usage',
      refresh: 'Refresh',
      unavailable: 'Usage unavailable',
      estimate: 'estimate',
      updated: 'Updated',
    }

    const CSS = [
      '.dsu-bar{display:flex;align-items:center;gap:10px;height:30px;flex:none;min-width:0;',
      'padding:0 14px;overflow:hidden;white-space:nowrap;',
      'border-top:1px solid var(--dsw-alias-border-l1);',
      'background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);',
      'font-family:inherit;font-size:12px;line-height:1}',
      '.dsu-item{display:flex;align-items:baseline;gap:5px;min-width:0}',
      '.dsu-key{opacity:.8}',
      '.dsu-val{color:var(--dsw-alias-label-primary);font-weight:500;font-variant-numeric:tabular-nums}',
      '.dsu-sep{width:3px;height:3px;border-radius:50%;flex:none;background:var(--dsw-alias-border-l2)}',
      '.dsu-gap{flex:1}',
      '.dsu-tag{padding:0 5px;border-radius:6px;font-size:10px;line-height:15px;',
      'color:var(--dsw-alias-state-warn-primary);border:1px solid var(--dsw-alias-state-warn-primary)}',
      '.dsu-warn{color:var(--dsw-alias-state-warn-primary)}',
      '.dsu-refresh{display:inline-flex;align-items:center;justify-content:center;flex:none;',
      'width:20px;height:20px;padding:0;border:0;border-radius:6px;background:transparent;',
      'color:var(--dsw-alias-label-secondary);cursor:pointer}',
      '.dsu-refresh:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}',
      '.dsu-refresh[data-busy=true]{opacity:.5;cursor:default}',
      '.dsu-link{flex:none;color:var(--dsw-alias-brand-primary);text-decoration:none;padding:2px 0}',
      '.dsu-link:hover{text-decoration:underline}',
      '@media (max-width:900px){.dsu-optional{display:none}}',
      '@media (prefers-reduced-motion:no-preference){.dsu-spin{animation:dsu-rotate 900ms linear infinite}}',
      '@keyframes dsu-rotate{to{transform:rotate(360deg)}}',
    ].join('')

    function money(value, currency) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
      const symbol = currency === 'USD' ? '$' : '¥'
      const abs = Math.abs(value)
      const text = abs >= 1000
        ? abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : abs.toFixed(2)
      return `${value < 0 ? '-' : ''}${symbol}${text}`
    }

    function tokenText(value) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '—'
      return Math.round(value).toLocaleString('en-US')
    }

    function walletText(wallets, currency) {
      if (!Array.isArray(wallets) || wallets.length === 0) return '—'
      const wallet = wallets[0]
      return money(Number(wallet.balance), wallet.currency || currency)
    }

    function UsageBar({ t }) {
      const tr = typeof t === 'function' ? t : (key) => (zh[key] !== undefined ? zh[key] : key)
      const [snapshot, setSnapshot] = React.useState({ phase: 'loading', data: null })
      const [busy, setBusy] = React.useState(false)
      const inFlight = React.useRef(false)

      const load = React.useCallback(async (force) => {
        if (inFlight.current) return
        inFlight.current = true
        setBusy(true)
        try {
          const params = new URLSearchParams({
            locale: String(navigator.language || 'en').toLowerCase().startsWith('zh') ? 'zh' : 'en',
            tz: String(new Date().getTimezoneOffset()),
            version: '1.0.0',
          })
          if (force) params.set('refresh', '1')
          const response = await fetch(`/api/dsh-usage-bar/summary?${params.toString()}`, {
            headers: { accept: 'application/json' },
            cache: 'no-store',
          })
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          const data = await response.json()
          setSnapshot({ phase: 'ready', data })
        } catch (error) {
          setSnapshot((previous) => ({ phase: 'error', data: previous.data }))
        } finally {
          inFlight.current = false
          setBusy(false)
        }
      }, [])

      React.useEffect(() => {
        load(false)
        const timer = setInterval(() => load(false), REFRESH_MS)
        const onVisible = () => {
          if (!document.hidden) load(false)
        }
        document.addEventListener('visibilitychange', onVisible)
        return () => {
          clearInterval(timer)
          document.removeEventListener('visibilitychange', onVisible)
        }
      }, [load])

      const data = snapshot.data

      if (data !== null && data.signedIn !== true) return null

      if (data === null) {
        if (snapshot.phase === 'error') {
          return h('div', { className: 'dsu-bar', role: 'status', 'aria-label': tr('label') },
            h('span', { className: 'dsu-warn' }, tr('unavailable')),
            h('span', { className: 'dsu-gap' }),
            h('a', {
              className: 'dsu-link',
              href: 'https://platform.deepseek.com/usage',
              target: '_blank',
              rel: 'noreferrer',
            }, `${tr('viewUsage')} ↗`))
        }
        return null
      }

      const usage = data.usage || {}
      const balance = data.balance || {}
      const currency = usage.currency || balance.currency || 'CNY'
      const estimate = usage.source === 'estimate'
      const failed = snapshot.phase === 'error'
      const usageUrl = (data.links && data.links.usageUrl) || 'https://platform.deepseek.com/usage'
      const updated = data.fetchedAt ? new Date(data.fetchedAt) : null
      const updatedText = updated && !Number.isNaN(updated.getTime())
        ? `${tr('updated')} ${String(updated.getHours()).padStart(2, '0')}:${String(updated.getMinutes()).padStart(2, '0')}`
        : undefined
      const bonusText = walletText(balance.bonus, currency)

      const refreshIcon = h('svg', {
        viewBox: '0 0 16 16', width: 13, height: 13, 'aria-hidden': true,
        className: busy ? 'dsu-spin' : undefined,
      }, h('path', {
        d: 'M13 8a5 5 0 1 1-1.7-3.8M13 2.6V5h-2.4',
        fill: 'none', stroke: 'currentColor', 'stroke-width': 1.4,
        'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      }))

      return h('div', {
        className: 'dsu-bar',
        role: 'status',
        'aria-label': tr('label'),
        title: updatedText,
      },
      h('div', { className: 'dsu-item' },
        h('span', { className: 'dsu-key' }, tr('today')),
        h('span', { className: 'dsu-val' }, money(usage.todayCost, currency)),
        estimate ? h('span', { className: 'dsu-tag' }, tr('estimate')) : null,
        failed ? h('span', { className: 'dsu-warn', title: tr('unavailable') }, '!') : null),
      h('span', { className: 'dsu-sep' }),
      h('div', { className: 'dsu-item dsu-optional' },
        h('span', { className: 'dsu-key' }, tr('month')),
        h('span', { className: 'dsu-val' }, money(usage.monthCost, currency))),
      h('span', { className: 'dsu-sep dsu-optional' }),
      h('div', { className: 'dsu-item dsu-optional' },
        h('span', { className: 'dsu-key' }, tr('tokens')),
        h('span', { className: 'dsu-val' }, tokenText(usage.monthTokens))),
      h('span', { className: 'dsu-gap' }),
      h('div', { className: 'dsu-item' },
        h('span', { className: 'dsu-key' }, tr('recharge')),
        h('span', { className: 'dsu-val' }, walletText(balance.normal, currency))),
      bonusText === '—' ? null : h('div', { className: 'dsu-item dsu-optional' },
        h('span', { className: 'dsu-key' }, tr('bonus')),
        h('span', { className: 'dsu-val' }, bonusText)),
      h('button', {
        type: 'button',
        className: 'dsu-refresh',
        'data-busy': busy ? 'true' : undefined,
        'aria-label': tr('refresh'),
        title: tr('refresh'),
        onClick: () => load(true),
      }, refreshIcon),
      h('a', {
        className: 'dsu-link',
        href: usageUrl,
        target: '_blank',
        rel: 'noreferrer',
      }, `${tr('viewUsage')} ↗`))
    }

    return {
      inject: ['slots', 'locale'],

      apply(ctx) {
        ctx.effect(() => {
          const style = document.createElement('style')
          style.dataset.dshSidebarUsage = ''
          style.textContent = CSS
          document.head.appendChild(style)
          return () => style.remove()
        }, 'dsh-sidebar-usage: styles')

        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-sidebar-usage: dictionaries')

        ctx.effect(() => ctx.slots.inject('shell.bottom', () => ctx.slots.register({
          name: 'shell.bottom',
          locale: NS,
        }, UsageBar)), 'dsh-sidebar-usage: bottom bar')
      },
    }
  },
})
