# 心智宇宙 INFINITY — 阿里云部署手册（给小龙虾）

> 依据《心智宇宙-实施与阿里云部署方案书.md》第 6–8 节。按本手册操作可在空服务器上完成可重复部署，并在异常时 15 分钟内回滚。

## 1. 环境要求（硬性）

| 项 | 要求 | 备注 |
|----|------|------|
| Node.js | **≥ 22.5**（`node:sqlite` 最低要求） | 2G 内存服务器用 `NODE_OPTIONS=--max-old-space-size=512` 更稳 |
| 系统 | 任意 Linux（以 Ubuntu/Debian 示例） | 已有 Nginx |
| 磁盘 | 数据库很小；附件按需（首版 ≤10MB/个） | 备份目录与数据目录同盘 |
| 域名/HTTPS | 有备案域名可用 certbot 签证书；无域名则用 IP + 自签证书 | 阻断项：无 HTTPS 不允许上线 |

## 2. 目录规划（方案书 7.1）

```text
/opt/infinity/app/        # 当前发布版本（git 仓库或发布包）
/opt/infinity/releases/   # 带版本号的发布包（vYYYYMMDD-HHmm）
/opt/infinity/data/       # SQLite + uploads/（禁止 Web 直接访问，Nginx 不 root 到这里）
/opt/infinity/backups/    # 加密备份（定期同步到 OSS/异地）
/opt/infinity/logs/       # PM2 与应用日志
```

## 3. 首次部署步骤

```bash
# 1) 依赖
sudo apt-get update && sudo apt-get install -y nginx
# Node ≥22.5：用 nvm 或 NodeSource（nvm install 22 && nvm use 22）

# 2) 目录
sudo mkdir -p /opt/infinity/{app,releases,data,backups,logs}
sudo chown -R $USER /opt/infinity

# 3) 代码与构建（在 app 目录）
cd /opt/infinity/app
git clone <仓库地址> .        # 或解压发布包
npm ci                        # 锁版本依赖（含 devDeps，构建需要）
npm run build                 # tsc 类型检查 + 前端构建(含 PWA) + 服务端编译到 dist-server/
npm run migrate               # 迁移校验：应输出"✓ entries 关键列齐备"

# 4) 环境变量（密钥不写进任何文件，用 systemd 环境文件或 pm2 注入）
#    必须：JWT_SECRET（openssl rand -hex 32 生成）
#    可选：AI_BASE_URL / AI_API_KEY / AI_MODEL；CLIENT_ORIGIN（一般不需要）

# 5) Nginx
sudo cp deploy/nginx.conf /etc/nginx/conf.d/infinity.conf
# 改 server_name 与证书路径；certbot 签发证书
sudo nginx -t && sudo systemctl reload nginx

# 6) PM2
npm install -g pm2
JWT_SECRET=$(openssl rand -hex 32) pm2 start deploy/ecosystem.config.js
pm2 save && pm2 startup   # 开机自启

# 7) 备份定时任务（crontab -e）
# 每天 3:17 备份（避开整点），密码用文件权限保护的环境变量：
17 3 * * * cd /opt/infinity/app && BACKUP_PASSWORD='<强密码>' BACKUP_DIR=/opt/infinity/backups node_modules/.bin/tsx scripts/backup.ts >> /opt/infinity/logs/backup.log 2>&1
```

## 4. 发布/回滚流程（方案书 7.3）

**发布**：
1. 本地（或 CI）`npm run check` 全绿 + `npm run smoke` 全过（39+ 项断言）
2. 服务器：`npx tsx scripts/backup.ts <密码>` 备份生产数据并确认输出"✓ 备份完成"
3. `git pull`（或换新 release 目录）→ `npm ci` → `npm run build` → `npm run migrate`
4. `pm2 reload infinity-api`；`nginx -t && systemctl reload nginx`
5. 冒烟清单（下节）逐项通过

**回滚（目标：15 分钟内）**：
1. `git checkout <上一版本 tag>` → `npm ci` → `npm run build` → `pm2 reload infinity-api`
2. 若数据被破坏：`npx tsx scripts/restore.ts /opt/infinity/backups/<最新备份> <密码>` → `pm2 restart infinity-api`

## 5. 上线冒烟清单（方案书 8.2 阻断项逐条对照）

| # | 检查 | 方法 |
|---|------|------|
| 1 | HTTPS 生效，HTTP 跳转 | 浏览器访问 http 域名应 301 到 https |
| 2 | 注册/登录/隔离 | 建两个账户，A 的数据 B 看不到（冒烟测试已覆盖 404 隔离） |
| 3 | 登录限流 | 连续 10 次错误登录 → 429 |
| 4 | 离线可用 | 登录后断网 → 新建/编辑/搜索正常 → 恢复网络侧边栏"☁ 已同步" |
| 5 | PWA | 生产构建下地址栏出现安装图标；断网刷新页面可打开 |
| 6 | 附件权限 | 未登录访问 /api/attachments/<id> → 401 |
| 7 | AI 开关 | 关闭"允许 AI 分析"的条目请求建议 → 403；每次调用有 ai_runs 记录 |
| 8 | 数据库不可静态访问 | /opt/infinity/data 不在 Nginx root 下；curl https://域名/data/infinity.db → 404 |
| 9 | 密钥不泄露 | 前端包（dist/assets/*.js）grep 不到密钥；仓库不含 .env |
| 10 | 备份可恢复 | 每月演练一次：restore 到隔离目录，能登录、能搜索 |
| 11 | 审计与撤销 | 设置页能看到审计日志；分享授权可创建/撤销 |

## 6. 运维备注

- **监控**：`pm2 monit`；日志 `/opt/infinity/logs/`；SQLite WAL 已启用。
- **备份**：加密快照（AES-256-GCM）；保留策略默认 7 份（BACKUP_KEEP 可调）；建议把 backups 目录同步到 OSS（`ossutil cp -r --update`）。
- **迁移**：`npm run migrate` 幂等（建表补列），无破坏性变更；升级前必先备份。
- **性能边界**：2G/4 核适合单用户/小规模私有试用（方案书 7.1）；视频附件不存服务器，只存外链/元数据。
- **健康表达边界**（方案书 5.3）：产品文案不含诊断性结论；如未来加入分享摘要，必须附"不构成医疗建议"与求助入口。

## 7. 交付物清单（方案书 8.1 对照）

- [x] README（本地启动/构建/部署入口）
- [x] .env.example（只列变量名与说明）
- [x] 迁移：scripts/migrate.ts + 本节回滚说明
- [x] 默认知识库来源：内置原创撰写 + 用户授权素材（vault 导入 12 条）；色卡为公开传统色名汇编
- [x] API 说明：见 src/api.ts（客户端调用即为接口清单）与 server/index.ts
- [x] 隐私说明：设置页 + README
- [x] Nginx/PM2/备份配置：deploy/ 目录
- [x] 测试：npm run smoke（39 项断言：离线/同步冲突/权限隔离/导入导出/AI 回溯）
