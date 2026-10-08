import { json } from './auth.js';

// 返回固定提示，绝不向浏览器透出 SQL、账户、令牌或原始异常。
export function accountFailure(error) {
  const message = String(error?.message || '');
  if (/iteration.*(?:100000|100,000|not supported|limit)|(?:100000|100,000).*iteration/i.test(message)) {
    return json({ code: 'AUTH_CRYPTO_UNSUPPORTED', error: '账户加密配置与服务器运行环境不兼容，请维护者修复后再登录。本地数据不受影响。' }, 503);
  }
  if (/no such table|no such column/i.test(message)) {
    return json({ code: 'AUTH_SCHEMA_UNAVAILABLE', error: '账户数据库表结构尚未就绪，请维护者核对生产数据库迁移。本地数据不受影响。' }, 503);
  }
  return json({ code: 'AUTH_SERVICE_UNAVAILABLE', error: '账户服务暂时不可用，请稍后重试；若持续失败，请联系维护者查看服务器日志。' }, 503);
}
