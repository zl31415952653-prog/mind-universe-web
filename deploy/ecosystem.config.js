// 心智宇宙 INFINITY — PM2 配置（方案书 7.2）
// 用法（在 /opt/infinity/app 下）：pm2 start deploy/ecosystem.config.js
// ⚠ JWT_SECRET 等密钥请勿提交到仓库：用环境变量文件或 pm2 命令行注入，
//   参考：JWT_SECRET=$(openssl rand -hex 32) pm2 start deploy/ecosystem.config.js

module.exports = {
  apps: [
    {
      name: 'infinity-api',
      script: 'dist-server/index.js',
      cwd: '/opt/infinity/app',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 8787,
        DATA_DIR: '/opt/infinity/data',
        // JWT_SECRET 必填且不能使用默认值（服务端会校验，缺失时拒绝启动）
        JWT_SECRET: process.env.JWT_SECRET || '请注入环境变量',
        // AI 模型（可选；不填则使用本地启发式，离线可用）
        AI_BASE_URL: process.env.AI_BASE_URL || '',
        AI_API_KEY: process.env.AI_API_KEY || '',
        AI_MODEL: process.env.AI_MODEL || '',
      },
      out_file: '/opt/infinity/logs/out.log',
      error_file: '/opt/infinity/logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },
  ],
};
