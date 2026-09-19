# 心智宇宙：Cloudflare Pages + D1 部署清单

> 本清单对应当前本地优先版本。它不要求阿里云服务器。

## 1. 云端资源

1. 创建 Cloudflare D1 数据库，例如 `mind-universe`。
2. 依次执行 `migrations/0001_cloud_sync.sql` 和 `migrations/0002_entitlements.sql`。
3. 创建或连接 Cloudflare Pages 项目，构建命令 `npm run build`，输出目录 `dist`。
4. 为 Pages Function 绑定 D1，绑定变量名必须是 `DB`。

## 2. 机密变量

只在 Cloudflare Pages 的 Variables and Secrets 中配置：

- `DEEPSEEK_API_KEY`
- `AI_BASE_URL`（例如 `https://api.deepseek.com`）
- `AI_MODEL`（例如 `deepseek-flash`）

不要将真实 Key 放进前端、仓库、备份 JSON、`.dev.vars` 或 `wrangler.toml`。

## 3. 上线验证

- 本地：笔记、学习项目、PDF 文本导入、关系图谱、授权记录均可离线工作。
- 云端：测试注册 → 登录 → 手动保存到云端 → 换浏览器恢复。
- AI：测试托管对话、资料分析、关系发现；确认额度耗尽时返回清晰提示。
- 隐私：确认未登录用户不能访问 `/api/atlas`，授权记录不会产生公开链接。

## 4. 目前不应承诺

- 不应宣称已提供医疗诊断、心理治疗或临床协作服务。
- 不应宣称第三方已能读取授权内容；当前授权中心记录用户意图，真实跨账号访问仍需身份、加密、审计和专业合规设计。
- 不应在未接入支付回调与防滥用机制前开放无限制托管 AI。
