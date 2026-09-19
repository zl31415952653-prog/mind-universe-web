# 心智宇宙 · INFINITY V2

一个本地优先的个人认知地图：经历是星尘，资料是知识晶体，关系与迁移由用户亲自确认。

## 本地运行

```powershell
npm install
npm run dev
```

访问 `http://localhost:5173`；同一局域网可使用终端显示的 `Network` 地址。生产构建：

```powershell
npm run build
```

## AI 的三种模式

- **本地引导**：无需联网或 Key，仍能把对话整理为用户可编辑的候选草案。
- **托管 AI**：适用于 Cloudflare Pages 部署；浏览器请求同站 `/api/chat/completions`，Key 不离开服务端。
- **个人 Key**：高级用户临时填写任意 OpenAI 兼容接口和 Key；Key 只保留在当前页面会话。

无论模式如何，AI 都不能自动写入记录；用户编辑并确认后才会成为星尘。

## Cloudflare Pages + D1 部署（推荐）

1. 将此目录推送到 GitHub，创建 Cloudflare Pages 项目并连接仓库。
2. 创建一个 D1 数据库，将 [wrangler.example.toml](./wrangler.example.toml) 复制为本地 `wrangler.toml` 后填入数据库 ID，并依次执行 `migrations/0001_cloud_sync.sql`、`migrations/0002_entitlements.sql`。
3. 在 Pages 项目中将 D1 绑定命名为 `DB`，设置构建命令为 `npm run build`，输出目录为 `dist`。
4. 在项目的 **Settings → Variables and Secrets** 为 Production 和 Preview 设置：
   - `DEEPSEEK_API_KEY`：DeepSeek 的服务端 Key（机密变量）；
   - `AI_BASE_URL`：`https://api.deepseek.com`；
   - `AI_MODEL`：`deepseek-flash`。
5. 部署后，在“记录此刻 → 模型设置”选择“托管 AI”。“隐私 → 账户”可注册、登录并手动同步数据快照。

`functions/api/chat/completions.js` 是 Cloudflare Pages Function：它会固定系统边界、限制输入长度，并从环境变量取得 Key。请勿把真实 Key 写进前端代码、`.dev.vars` 或 Git 仓库。

Cloudflare Pages 根据 `functions/` 的文件路径生成接口路由，环境变量可在 Pages 控制台作为密钥配置。[官方路由文档](https://developers.cloudflare.com/pages/functions/routing/) [官方变量文档](https://developers.cloudflare.com/pages/functions/bindings/)

当前版本包含邮箱登录、HTTP-only 会话、免费 AI 额度、受控 AI 代理和手动快照同步。公开推广前仍应补充：邮件验证/找回密码、速率限制、支付回调校验、服务端审计、监控告警与隐私合规审查。

## 本地与云端的边界

- 不登录时：经历、笔记、学习资料与图谱只保留在本机 IndexedDB，可导出 JSON。
- 登录后：也不会自动上传；只有在“隐私 → 账户”点击“保存到云端”时才会上传一份快照。
- 托管 AI：只在用户主动发起对话、资料分析、关系发现或回望时调用；结果均需用户确认。
- 个人 Key：仅存在当前页面会话，绝不进入备份、IndexedDB 或云端快照。

## 发布前检查

1. `npm run build` 必须通过。
2. 确认 D1 已完成两份迁移，`DB` 绑定存在。
3. 只把 `DEEPSEEK_API_KEY` 放入云端密钥，不写入 Git、前端变量或 `wrangler.toml`。
4. 使用新账户验证注册、登录、手动上传和恢复；恢复会覆盖当前设备数据，先导出备份。
5. 对托管 AI 设置额度与频率限制后，再开放外部用户。

完整决策见：[心智宇宙-V2-部署与AI架构说明.md](./心智宇宙-V2-部署与AI架构说明.md)。
