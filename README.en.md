English | [中文](README.md)

# dsh-sidebar-usage

Keep DeepSeek usage and account balance visible in a compact bar at the bottom of the
DeepSeek Harness window — no need to open **Settings → Account & Balance → View usage**
to see where the month is going.

```
今日消费 ¥0.42 · 本月消费 ¥14.19 · 本月 Tokens 104,751,630      充值余额 ¥2.80 · 赠金余额 ¥3.03   查询用量 ↗
```

The bar spans the full width below all three columns (the `shell.bottom` slot), so it
stays put while you switch panels, and hides itself completely when no account is
signed in.

## What it shows

| Item | Meaning |
|---|---|
| 今日消费 / Today | Cost booked for the current local day. |
| 本月消费 / This month | Cost booked for the whole current month. |
| 本月 Tokens / Month tokens | Token total for the current month, as a full grouped number. |
| 充值余额 / Balance | Recharge wallet balance. |
| 赠金余额 / Bonus | Bonus wallet balance, hidden when there is none. |
| 查询用量 / View usage | Opens the DeepSeek Platform usage page. |

A refresh button on the right re-reads everything immediately; otherwise the bar
refreshes about once a minute.

## Where the numbers come from

- **Wallets** come from the Host `deepseekAccount` service — the same official Platform
  endpoints the Account settings page uses. The bar only reads them.
- **Cost and tokens** come from the Platform dashboard's own usage endpoints
  (`platform.deepseek.com/api/v0/usage/cost` and `…/usage/amount`) using the account
  grant already stored by DSH. These are dashboard endpoints, not part of the public
  API, and they can change without notice.
- If that usage endpoint cannot be reached or rejects the grant, the bar keeps showing
  the wallet balances and estimates today's spend from the day's opening balance minus
  the current balance, marked **估算 / estimate**. It never presents an estimate as an
  official figure.

## Requirements

- DeepSeek Harness **0.2.1** (the bar uses the `shell.bottom` slot and the account
  service). It was built and verified on `0.2.1-rc.3`.
- A signed-in DeepSeek account. Signed out, the bar renders nothing and reserves no
  space.

## Install

From this repository:

```sh
dsh plugin --profile <profile> add github:YQzhangsan/dsh-sidebar-usage
```

Then refresh the page. On DSH Desktop, install it through **Settings → Plugins** or the
plugin market instead of a CLI pointed at a different profile.

## Privacy

- The browser half talks only to the local Host route `/api/dsh-usage-bar/summary`.
- Only the Host contacts `platform.deepseek.com`, with the same account grant DSH
  already stores for the Account settings page. No token is ever sent to the page,
  logged, or written anywhere.
- The bar is read-only: it never changes account state, sends no telemetry, and keeps
  no history.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Bar not visible | Not signed in to a DeepSeek account, or the page predates the installation — refresh once. |
| `估算 / estimate` badge | The Platform usage endpoint was unreachable or rejected the grant; wallets still refresh normally. |
| Numbers look stale | The Host caches one summary for a few seconds; press the refresh button. |
| Only balance, no cost | The Platform dashboard endpoints changed shape; the bar degrades to wallets + estimate. |

## Development

| Part | File | Role |
|---|---|---|
| Host | `index.js` | Registers `GET /api/dsh-usage-bar/summary`; reads account state, wallets, and the Platform usage endpoints; caches one summary briefly; falls back to the balance-delta estimate. |
| Client | `client.js` | Registers into `shell.bottom`, polls the host route, renders with theme tokens and localized copy. |
| Bundle | `cordis.patch.yml` | Inserts the `sidebar-usage` loader row. |

There is no build step; `index.js` and `client.js` are shipped as plain ESM and plain
`__ModuleLoader__` bundle source. The client registers its own styles and removes them
on unload.

## License

MIT — see [LICENSE](LICENSE).
