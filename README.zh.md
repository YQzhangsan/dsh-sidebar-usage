# dsh-sidebar-usage

在 DeepSeek Harness 窗口底部常驻一条紧凑的用量与余额条，不用再打开
**设置 → 账号与余额 → 查询用量** 才知道这个月花了多少。

```
今日消费 ¥0.42 · 本月消费 ¥14.19 · 本月 Tokens 104,751,630      充值余额 ¥2.80 · 赠金余额 ¥3.03   查询用量 ↗
```

它占用框架级的 `shell.bottom` 槽位，横跨三栏底部，切换主面板时保持显示；
未登录账号时整条不渲染，也不占高度。

## 显示内容

| 项目 | 含义 |
|---|---|
| 今日消费 | 当前本地日期已计入的消费。 |
| 本月消费 | 当前自然月已计入的消费。 |
| 本月 Tokens | 当月 token 总量，按完整数字显示（千分位）。 |
| 充值余额 | 充值钱包余额。 |
| 赠金余额 | 赠金钱包余额，没有时不显示。 |
| 查询用量 | 打开 DeepSeek 平台用量页。 |

右侧刷新按钮可立即重读；平时约每分钟自动刷新一次。

## 数据来源

- **余额**来自 Host 的 `deepseekAccount` 服务，与「账号与余额」设置页使用的是同一组
  官方平台接口；本插件只读。
- **消费与 Tokens** 来自平台控制台自己的用量接口
  （`platform.deepseek.com/api/v0/usage/cost` 与 `…/usage/amount`），使用 DSH 已保存的
  账号授权。这两个是控制台接口而非公开 API，可能随时调整。
- 用量接口不可达或拒绝授权时，余额照常显示，今日消费改用「当日初始余额 − 当前余额」
  估算，并标注 **估算**；不会把估算值伪装成官方数字。

## 前置条件

- DeepSeek Harness **0.2.1**（依赖 `shell.bottom` 槽位与账号服务）。本插件在
  `0.2.1-rc.3` 上开发并验证。
- 已登录 DeepSeek 账号。未登录时不渲染、不占位。

## 安装

仓库：`https://github.com/YQzhangsan/dsh-sidebar-usage`

```sh
dsh plugin --profile <profile> add github:YQzhangsan/dsh-sidebar-usage
```

安装后刷新页面。DSH Desktop 请在 **设置 → 插件** 或插件市场中安装，不要用指错 profile 的 CLI。

## 隐私

- 浏览器半侧只访问本机 Host 路由 `/api/dsh-usage-bar/summary`。
- 只有 Host 会以 DSH 已保存的账号授权访问 `platform.deepseek.com`；token 不会进入页面、
  不会写日志、不会落盘到插件自己的任何位置。
- 插件是只读的：不改账号状态、不上报遥测、不保留历史。

## 常见问题

| 现象 | 可能原因 |
|---|---|
| 底部没有出现 | 未登录账号，或页面早于安装时间——刷新一次。 |
| 出现「估算」标记 | 平台用量接口不可达或拒绝授权；余额仍会正常刷新。 |
| 数字不够新 | Host 对同一份汇总有数秒缓存；点刷新按钮即可。 |
| 只有余额没有消费 | 平台控制台接口结构变化，插件退化为「余额 + 估算」。 |

## 开发

| 部分 | 文件 | 作用 |
|---|---|---|
| Host | `index.js` | 注册 `GET /api/dsh-usage-bar/summary`；读取账号状态、钱包与平台用量接口；短时缓存；余额差额估算兜底。 |
| Client | `client.js` | 注册进 `shell.bottom`，轮询 Host 路由，使用主题 token 与本地化文案渲染。 |
| 组合 | `cordis.patch.yml` | 插入 `sidebar-usage` 加载行。 |

没有构建步骤：`index.js` 与 `client.js` 就是发布用的普通 ESM / `__ModuleLoader__` 源码。
客户端样式随组件注册与卸载。

## 许可

MIT，见 [LICENSE](LICENSE)。
