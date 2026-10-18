// 只有本站 /me 返回有效用户，才确认登录；配置 ready 不代表登录成功。
export async function checkAccount(fetcher = fetch, signal) {
  const request = async (path, parse) => {
    try {
      const response = await fetcher(path, { credentials: 'include', cache: 'no-store', signal });
      if (path.endsWith('/me') && response.status === 401) return { status: 'anonymous', value: null };
      if (!response.ok) throw new Error('unavailable');
      return { status: 'ready', value: parse(await response.json()) };
    } catch { return { status: 'error', value: null }; }
  };
  const [config, session] = await Promise.all([
    request('/api/auth/config', body => {
      if (!body || !['authing', 'legacy', 'invite', 'disabled'].includes(body.provider) || typeof body.ready !== 'boolean') throw new Error('config');
      return { provider: body.provider, ready: body.ready };
    }),
    request('/api/auth/me', body => {
      if (!body?.user || typeof body.user.id !== 'string' || !body.user.id) throw new Error('user');
      if (typeof body.user.username === 'string' && body.user.username) return { id: body.user.id, username: body.user.username };
      if (typeof body.user.email !== 'string' || !body.user.email) throw new Error('user');
      return { id: body.user.id, email: body.user.email };
    })
  ]);
  return { config, session };
}

export async function readAccountResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  const isJson = /(?:application|text)\/(?:[\w.+-]*\+)?json\b/i.test(contentType);
  let data = null;
  let text = '';
  if (isJson) {
    try { data = await response.json(); } catch { /* Report a safe format error below. */ }
  } else {
    try {
      const reader = response.body?.getReader();
      if (reader) {
        const first = await reader.read();
        text = new TextDecoder().decode(first.value?.subarray(0, 1024) || new Uint8Array());
        await reader.cancel();
      }
    } catch { /* Report a safe format error below. */ }
  }

  if (!response.ok) {
    if (typeof data?.error === 'string' && data.error.trim()) throw new Error(data.error);
    if (/error\s*code\s*:\s*1102/i.test(text)) {
      throw new Error('Cloudflare 已因运行资源上限（错误 1102）中止登录计算。这不是密码错误；请维护者调整云端计算资源或认证实现。本地记录不受影响。');
    }
    const reason = isJson ? 'JSON 响应中没有错误说明' : '服务器返回了非 JSON 错误页';
    throw new Error(`账户接口异常（HTTP ${response.status}，${reason}）。这不是已确认的密码错误；请维护者检查 Cloudflare 预览函数日志。本地记录不受影响。`);
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`账户接口响应格式异常（HTTP ${response.status}）。登录状态尚未确认；请维护者检查 Cloudflare 预览函数日志。本地记录不受影响。`);
  }
  return data;
}

export function accountActionError(error) {
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
    return '云端请求超时或已取消。请检查网络后重试；本地记录不受影响。';
  }
  if (error instanceof TypeError) {
    return '无法连接云端服务。请检查网络或稍后重试；本地记录不受影响，登录状态尚未确认。';
  }
  return error instanceof Error ? error.message : '网络连接失败，请重试。';
}

export function callbackMessage(params) {
  const messages = {
    success: '认证已返回，正在核对本站登录状态；尚未确认登录成功。',
    invalid: '登录校验已失效或不匹配，请重新发起登录。',
    cancelled: '登录已取消。本地资料不受影响。',
    provider: '认证服务未完成登录，请维护者核对认证配置。',
    verify_email: '请先在 Authing 验证邮箱，再重新登录。',
    existing_account: '该邮箱存在旧账户。为保护原快照，不会自动合并，请联系维护者进行迁移核对。',
    service: '本站接收登录失败，尚未登录成功。本地资料仍保留。'
  };
  const stages = {
    flow: '一次性登录校验', token: '交换认证凭证', verify: '核验身份签名',
    profile: '核验邮箱资料', identity: '读取账户映射', account: '保存账户', session: '保存登录会话'
  };
  const result = params.get('account_result');
  if (!result) return '';
  let message = messages[result] || '请重新发起登录。';
  const reasons = {
    state: '认证服务没有返回有效的登录校验值。',
    cookie: '浏览器没有带回一次性登录校验 Cookie。',
    flow: '一次性登录记录不存在、已过期或已被使用。',
    code: '认证服务没有返回有效授权码。'
  };
  const providerStatuses = {
    400: 'Authing 返回 400：授权码、回调地址或 PKCE 参数未被接受。',
    401: 'Authing 返回 401：客户端身份未通过，请核对 App ID、App Secret 与 token 认证方式。',
    403: 'Authing 返回 403：应用无权完成此次 token 交换。',
    429: 'Authing 请求过于频繁，请稍后再试。',
    500: 'Authing token 服务暂时异常（500）。',
    502: 'Authing token 服务暂时异常（502）。',
    503: 'Authing token 服务暂时异常（503）。',
    504: 'Authing token 服务暂时异常（504）。'
  };
  const providerErrors = {
    invalid_request: 'Authing 判定 token 请求参数不完整或格式不正确。',
    invalid_client: 'Authing 未认可此应用身份，重点核对 App ID、App Secret 与 token 认证方式。',
    invalid_grant: 'Authing 未接受授权码，重点核对回调地址、授权码时效与 PKCE。',
    unauthorized_client: '该应用未获准使用授权码换取 token。',
    unsupported_grant_type: 'Authing 未启用当前授权类型。',
    invalid_scope: 'Authing 未接受当前登录权限范围。'
  };
  const stage = stages[params.get('account_stage')];
  const ref = params.get('account_ref');
  const reason = reasons[params.get('account_reason')];
  const providerStatus = providerStatuses[params.get('account_status')];
  const providerError = providerErrors[params.get('account_error')];
  if (result === 'invalid' && reason) message += ` ${reason}`;
  if (result === 'provider' && providerStatus) message += ` ${providerStatus}`;
  if (result === 'provider' && providerError) message += ` OAuth 错误：${params.get('account_error')}。${providerError}`;
  if (['service', 'provider', 'invalid'].includes(result) && stage) message += ` 失败环节：${stage}。`;
  if (['service', 'provider', 'invalid'].includes(result) && /^[a-f0-9]{12}$/.test(ref || '')) message += ` 排查编号：${ref}。`;
  return message;
}
